import { buildCatalog } from './_lib/catalog.js'
import { createClient } from '@supabase/supabase-js'
import { writeCatalog, cleanupOldData, EMIT_REGIONS, DISCOVERY_REGIONS } from './_lib/catalogWrite.js'

// Movies only. The series catalog has its own endpoint and its own budget —
// they used to share this one and the series half was the part that got cut
// off when the run ran long.
export const config = { maxDuration: 60 }

// Re-exported for review/regressions.test.js, which exercises the prune guard.
export { writeCatalog }

// Nightly cron (see vercel.json). Vercel Cron sends
// `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set — the only way in.
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

  try {
    // concurrency 40: the run is dominated by waiting on TMDB, ~1,100 calls at
    // 20 at a time was ~56s of a 60s budget. TMDB allows well over this rate.
    const rows = await buildCatalog({
      token,
      regions: EMIT_REGIONS,
      providerRegions: DISCOVERY_REGIONS,
      pages: 16, minVotes: 3500, freshPages: 3, providerPages: 3, concurrency: 40,
    })

    const supabase = createClient(url, key, { auth: { persistSession: false } })
    const runStamp = new Date().toISOString()
    const report = await writeCatalog(supabase, 'movie_catalog', rows, EMIT_REGIONS, runStamp)

    // Housekeeping lives with the movie job — never let it fail the refresh.
    let cleanup = null
    try { cleanup = await cleanupOldData(supabase) }
    catch (e) { cleanup = { error: String(e?.message || e) } }

    return res.status(report.pruned ? 200 : 500).json({
      ok: report.pruned,
      error: report.pruned ? undefined : 'incomplete refresh, prune skipped',
      movies: rows.length, regions: EMIT_REGIONS.length, discoveryRegions: DISCOVERY_REGIONS.length,
      catalog: report, cleanup,
    })
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) })
  }
}
