// Local runner to build the TMDB catalog. Writes to Supabase when the
// service-role env vars are present, otherwise dumps JSON for inspection.
//   node --env-file=.env.local scripts/refresh-movies.mjs
// Env: REGIONS (csv, default CZ,US,GB), PAGES (default 3), MIN_VOTES (default 3000)
//   To write to Supabase, also set (in .env.local, kept local — never commit):
//   VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
import { buildCatalog } from '../api/_lib/catalog.js'
import { writeFileSync } from 'node:fs'

const token = process.env.TMDB_READ_TOKEN
if (!token) {
  console.error('Set TMDB_READ_TOKEN (e.g. run with --env-file=.env.local)')
  process.exit(1)
}

const regions = (process.env.REGIONS || 'CZ,US,GB').split(',')
const pages = Number(process.env.PAGES || 16)
const minVotes = Number(process.env.MIN_VOTES || 3500)

console.log(`Building catalog: regions=${regions.join(',')} pages=${pages} minVotes=${minVotes}`)
const rows = await buildCatalog({ token, regions, pages, minVotes, providerPages: 3, concurrency: 20, providerRegions: regions })
console.log(`Built ${rows.length} rows.`)

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (url && serviceKey) {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })
  const runStamp = new Date().toISOString()
  const stamped = rows.map(r => ({ ...r, updated_at: runStamp }))
  const CHUNK = 500
  for (let i = 0; i < stamped.length; i += CHUNK) {
    const { error } = await supabase
      .from('movie_catalog')
      .upsert(stamped.slice(i, i + CHUNK), { onConflict: 'tmdb_id,region' })
    if (error) { console.error('Supabase upsert failed:', error.message); process.exit(1) }
  }
  // Prune stale rows for the refreshed regions (see api/refresh-movies.js).
  const { error: pruneErr } = await supabase
    .from('movie_catalog').delete().in('region', regions).lt('updated_at', runStamp)
  if (pruneErr) { console.error('Supabase prune failed:', pruneErr.message); process.exit(1) }
  console.log(`✓ Upserted ${rows.length} rows and pruned stale entries.`)
} else {
  writeFileSync('scratch-catalog.json', JSON.stringify(rows, null, 2))
  console.log('No Supabase creds — wrote scratch-catalog.json instead.')
}

const r0 = regions[0]
console.log(`\nSample (${r0}):`)
for (const r of rows.filter(x => x.region === r0).slice(0, 10)) {
  console.log(`  ${r.title} (${r.year}) ⭐${r.rating} → ${r.platforms.join(', ') || '(not streaming)'}`)
}
