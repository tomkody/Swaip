// One region of the movie or series catalog, served from Vercel's CDN.
// Every player used to read their whole region straight from Supabase (about
// half a megabyte), which was most of the Free plan's 5 GB monthly egress and
// a hard wall: with the spend cap on, the project stops answering past it.
// Now the edge keeps one copy per catalog day and region, and this function
// runs only on a cache miss.
//   GET /api/catalog?kind=movies|series&region=CZ&d=2026-10-09
// `d` (see src/lib/catalogDay.js) only names the copy; only the current day
// and the two before it are accepted, which keeps the number of copies small.

import { createClient } from '@supabase/supabase-js'
import { catalogDay } from '../src/lib/catalogDay.js'

const TABLES = { movies: 'movie_catalog', series: 'series_catalog' }
// What the app reads from a row (rowToMovie / rowToSeries), nothing more.
const COLUMNS = 'tmdb_id,title,poster_url,rating,year,runtime,genres,overview,platforms,popularity'
const DAY_MS = 24 * 3600 * 1000

// A warm instance answers repeat misses (other edge regions) without a read.
const memo = new Map()
const MEMO_MS = 6 * 3600 * 1000

function fail(res, status, error) {
  res.setHeader('Cache-Control', 'no-store')
  return res.status(status).json({ error })
}

async function readRegion(supabase, table, region) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    // Ordered by id so every read returns the rows in the same order.
    const { data, error } = await supabase
      .from(table).select(COLUMNS).eq('region', region)
      .order('tmdb_id').range(from, from + 999)
    if (error) throw error
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return fail(res, 405, 'GET only')
  const kind = String(req.query.kind || '')
  const region = String(req.query.region || '')
  const day = String(req.query.d || '')
  const table = Object.hasOwn(TABLES, kind) ? TABLES[kind] : null
  const now = Date.now()
  // Today and the two days before (a partner joining late). Not tomorrow:
  // that copy would be filled with today's rows and served all of tomorrow.
  const days = new Set([-2, -1, 0].map(k => catalogDay(now + k * DAY_MS)))
  if (!table || !/^[A-Z]{2}$/.test(region) || !days.has(day)) {
    return fail(res, 400, 'kind (movies|series), region (two letters) and d (a recent catalog day) are required')
  }

  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  const key = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim()
  if (!url || !key) return fail(res, 503, 'catalog not configured')

  const memoKey = `${kind}:${region}:${day}`
  let rows = memo.get(memoKey)?.at > now - MEMO_MS ? memo.get(memoKey).rows : null
  if (!rows) {
    try {
      // The catalogs are public tables; the anon key is all this needs.
      const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
      rows = await readRegion(supabase, table, region)
    } catch (e) {
      return fail(res, 503, String(e?.message || e))
    }
    if (memo.size > 400) memo.clear()
    memo.set(memoKey, { at: now, rows })
  }

  // An empty region (the app falls back to US) is cached briefly only.
  const edge = rows.length ? 's-maxage=172800, stale-while-revalidate=604800' : 's-maxage=600'
  res.setHeader('Cache-Control', `public, max-age=3600, ${edge}`)
  return res.status(200).json(rows)
}
