// Local runner to build + inspect the TMDB catalog without touching Supabase.
//   node --env-file=.env.local scripts/refresh-movies.mjs
// Env: REGIONS (csv, default CZ,US,GB), PAGES (default 1), MIN_VOTES (default 3000)
import { buildCatalog } from '../api/_lib/catalog.js'
import { writeFileSync } from 'node:fs'

const token = process.env.TMDB_READ_TOKEN
if (!token) {
  console.error('Set TMDB_READ_TOKEN (e.g. run with --env-file=.env.local)')
  process.exit(1)
}

const regions = (process.env.REGIONS || 'CZ,US,GB').split(',')
const pages = Number(process.env.PAGES || 1)
const minVotes = Number(process.env.MIN_VOTES || 3000)

console.log(`Building catalog: regions=${regions.join(',')} pages=${pages} minVotes=${minVotes}`)
const rows = await buildCatalog({ token, regions, pages, minVotes })

writeFileSync('scratch-catalog.json', JSON.stringify(rows, null, 2))
console.log(`\n${rows.length} rows written to scratch-catalog.json\n`)

const r0 = regions[0]
console.log(`Sample (${r0}):`)
for (const r of rows.filter(x => x.region === r0).slice(0, 10)) {
  console.log(`  ${r.title} (${r.year}) ⭐${r.rating} → ${r.platforms.join(', ') || '(not streaming)'}`)
}
