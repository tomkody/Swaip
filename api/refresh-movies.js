import { buildCatalog } from './_lib/catalog.js'
import { createClient } from '@supabase/supabase-js'

// Nightly cron (see vercel.json). Rebuilds the movie catalog from TMDB and
// upserts it into Supabase. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`
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

  const regions = (process.env.REGIONS || 'CZ,US,GB,DE').split(',')
  try {
    const rows = await buildCatalog({ token, regions, pages: 5, minVotes: 3000 })
    const supabase = createClient(url, key, { auth: { persistSession: false } })

    const stamped = rows.map(r => ({ ...r, updated_at: new Date().toISOString() }))
    const CHUNK = 500
    for (let i = 0; i < stamped.length; i += CHUNK) {
      const { error } = await supabase
        .from('movie_catalog')
        .upsert(stamped.slice(i, i + CHUNK), { onConflict: 'tmdb_id,region' })
      if (error) throw error
    }
    return res.status(200).json({ ok: true, rows: rows.length, regions })
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) })
  }
}
