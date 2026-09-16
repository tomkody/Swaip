import { buildTvCatalog } from './_lib/catalog.js'
import { createClient } from '@supabase/supabase-js'
import { writeCatalog, EMIT_REGIONS, DETAILS_DEADLINE_MS } from './_lib/catalogWrite.js'

// Series only. Split out of refresh-movies on 2026-09-16: the two ran in one
// function, the series write came second, and the run had been exceeding the
// 60s budget for long enough that the series catalog was 16 days stale.
//
// It runs an hour after the movies (vercel.json). On the Hobby plan a daily job
// fires anywhere inside its hour - the movies' 04:00 job wrote at 04:33 - so a
// 04:30 slot could land on top of it, and the two would split TMDB's ~45
// requests a second between them.
export const config = { maxDuration: 60 }

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
    const started = Date.now()
    const stats = {}
    const rows = await buildTvCatalog({
      token, regions: EMIT_REGIONS,
      pages: 10, minVotes: 1500, freshPages: 3, genrePages: 2, concurrency: 32,
      deadline: started + DETAILS_DEADLINE_MS, stats,
    })

    const supabase = createClient(url, key, { auth: { persistSession: false } })
    const report = await writeCatalog(supabase, 'series_catalog', rows, EMIT_REGIONS, new Date().toISOString(), { allowPrune: !stats.skipped })

    return res.status(report.pruned ? 200 : 500).json({
      ok: report.pruned,
      error: report.pruned ? undefined : 'incomplete refresh, prune skipped',
      series: rows.length, regions: EMIT_REGIONS.length,
      build: { ...stats, seconds: Math.round((Date.now() - started) / 1000) },
      catalog: report,
    })
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) })
  }
}
