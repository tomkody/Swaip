import { buildCatalog, buildTvCatalog } from './_lib/catalog.js'
import { createClient } from '@supabase/supabase-js'

// Allow up to 60s — movie + TV catalogs each fetch hundreds of titles' providers.
export const config = { maxDuration: 60 }

// A run that comes back much smaller than what's already stored is a TMDB
// outage (5xx, rate limit, partial failure — detail fetches fail soft to null),
// not a catalog that genuinely shrank. Nightly churn is a few percent; anything
// past this is treated as incomplete: upsert what we got, never prune.
const MIN_COMPLETE_RATIO = 0.7

// Upsert rows into a catalog table, then prune rows in the refreshed regions
// that this run didn't touch (titles that dropped out of the top list) — but
// only when the run looks complete. Returns a small report for the response.
async function writeCatalog(supabase, table, rows, regions, runStamp) {
  const { data: existing, error: countErr } = await supabase
    .from(table).select('tmdb_id').in('region', regions)
  if (countErr) throw countErr
  const before = existing?.length ?? 0
  const complete = rows.length >= Math.max(1, Math.floor(before * MIN_COMPLETE_RATIO))

  const stamped = rows.map(r => ({ ...r, updated_at: runStamp }))
  const CHUNK = 500
  // `popularity` was added later (supabase/catalog_popularity.sql). If the column
  // isn't there yet, drop it and retry rather than failing the whole refresh.
  let dropPopularity = false
  const strip = rows => rows.map(({ popularity, ...r }) => r)   // eslint-disable-line no-unused-vars
  for (let i = 0; i < stamped.length; i += CHUNK) {
    let chunk = stamped.slice(i, i + CHUNK)
    if (dropPopularity) chunk = strip(chunk)
    let { error } = await supabase.from(table).upsert(chunk, { onConflict: 'tmdb_id,region' })
    if (error && !dropPopularity && /popularity/i.test(error.message || '')) {
      dropPopularity = true
      ;({ error } = await supabase.from(table).upsert(strip(chunk), { onConflict: 'tmdb_id,region' }))
    }
    if (error) throw error
  }
  if (!complete) return { table, before, written: rows.length, pruned: false }
  const { error: pruneErr } = await supabase
    .from(table).delete().in('region', regions).lt('updated_at', runStamp)
  if (pruneErr) throw pruneErr
  return { table, before, written: rows.length, pruned: true }
}

// Delete decision-room data older than RETENTION_DAYS. Rooms are ephemeral
// (one sitting), so old rows are pure dead weight — and since the rooms/swipes
// tables are readable with the public anon key, pruning them also shrinks what's
// ever exposed. All four tables carry created_at, so each is a simple cutoff
// delete. Runs inside its own try/catch at the call site so it can never break
// the catalog refresh.
async function cleanupOldData(supabase) {
  const days = Number(process.env.RETENTION_DAYS) || 30
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const counts = {}
  // Children before parents (rooms). A missing table is skipped, not fatal.
  for (const table of ['swipes', 'rankings', 'conversation_selections', 'push_subscriptions', 'rooms']) {
    try {
      const { count, error } = await supabase
        .from(table).delete({ count: 'exact' }).lt('created_at', cutoff)
      if (error) { counts[table] = `err:${error.code || error.message}`; continue }
      counts[table] = count ?? 0
    } catch (e) {
      counts[table] = `err:${String(e?.message || e)}`
    }
  }
  return { cutoff, days, deleted: counts }
}

// Nightly cron (see vercel.json). Rebuilds the movie + TV catalogs from TMDB and
// upserts them into Supabase. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`
// when the CRON_SECRET env var is set — that's the only way in.
export default async function handler(req, res) {
  const expected = process.env.CRON_SECRET
  if (!expected || req.headers.authorization !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const token = process.env.TMDB_READ_TOKEN
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!token || !url || !key) {
    return res.status(500).json({ error: 'missing TMDB_READ_TOKEN / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' })
  }

  const regions = (process.env.REGIONS || 'US,GB,CA,AU,IE,DE,FR,ES,IT,NL,BR,MX,IN,CZ,PL,SE').split(',')
  try {
    // Build both catalogs in parallel to stay well within the time budget.
    const [movieRows, tvRows] = await Promise.all([
      buildCatalog({ token, regions, pages: 16, minVotes: 3500, freshPages: 3, providerPages: 3, concurrency: 20, providerRegions: regions }),
      buildTvCatalog({ token, regions, pages: 10, minVotes: 1500, freshPages: 3, concurrency: 12 }),
    ])

    const supabase = createClient(url, key, { auth: { persistSession: false } })
    const runStamp = new Date().toISOString()
    const reports = [
      await writeCatalog(supabase, 'movie_catalog', movieRows, regions, runStamp),
      await writeCatalog(supabase, 'series_catalog', tvRows, regions, runStamp),
    ]

    // Housekeeping — never let it fail the catalog refresh.
    let cleanup = null
    try { cleanup = await cleanupOldData(supabase) }
    catch (e) { cleanup = { error: String(e?.message || e) } }

    // An incomplete run is a failure as far as the cron is concerned (Vercel
    // surfaces non-2xx), even though the partial data was still written.
    const incomplete = reports.filter(r => !r.pruned)
    return res.status(incomplete.length ? 500 : 200).json({
      ok: incomplete.length === 0,
      error: incomplete.length ? `incomplete refresh, prune skipped for: ${incomplete.map(r => r.table).join(', ')}` : undefined,
      movies: movieRows.length, series: tvRows.length, regions, catalogs: reports, cleanup,
    })
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) })
  }
}
