import { buildCatalog, buildTvCatalog } from './_lib/catalog.js'
import { createClient } from '@supabase/supabase-js'

// Allow up to 60s — movie + TV catalogs each fetch hundreds of titles' providers.
export const config = { maxDuration: 60 }

// Upsert rows into a catalog table, then prune rows in the refreshed regions
// that this run didn't touch (titles that dropped out of the top list).
async function writeCatalog(supabase, table, rows, regions, runStamp) {
  const stamped = rows.map(r => ({ ...r, updated_at: runStamp }))
  const CHUNK = 500
  for (let i = 0; i < stamped.length; i += CHUNK) {
    const { error } = await supabase
      .from(table)
      .upsert(stamped.slice(i, i + CHUNK), { onConflict: 'tmdb_id,region' })
    if (error) throw error
  }
  const { error: pruneErr } = await supabase
    .from(table).delete().in('region', regions).lt('updated_at', runStamp)
  if (pruneErr) throw pruneErr
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
    await writeCatalog(supabase, 'movie_catalog', movieRows, regions, runStamp)
    await writeCatalog(supabase, 'series_catalog', tvRows, regions, runStamp)

    // Housekeeping — never let it fail the catalog refresh.
    let cleanup = null
    try { cleanup = await cleanupOldData(supabase) }
    catch (e) { cleanup = { error: String(e?.message || e) } }

    return res.status(200).json({ ok: true, movies: movieRows.length, series: tvRows.length, regions, cleanup })
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) })
  }
}
