import { it, expect, vi, beforeEach } from 'vitest'

// The daily Places cap is the only hard stop on Google spend. A food room now
// searches every matched category at once, so the counter must count each of
// those parallel calls, not just one of them.

const db = vi.hoisted(() => ({ rows: new Map() }))
const tick = () => new Promise(r => setTimeout(r, Math.random() * 4))

function builder() {
  let op = 'select'
  let values = null
  const filters = []
  let single = false
  const b = {
    select() { return b },
    maybeSingle() { single = true; return b },
    eq(col, val) { filters.push([col, val]); return b },
    insert(v) { op = 'insert'; values = v; return b },
    update(v) { op = 'update'; values = v; return b },
    upsert(v) { op = 'upsert'; values = v; return b },
    then(resolve, reject) {
      return (async () => {
        await tick()   // interleave concurrent callers like real round trips
        const match = row => filters.every(([col, val]) =>
          col === 'payload->>n' ? String(row.payload?.n) === val : row[col] === val)
        if (op === 'insert') {
          if (db.rows.has(values.cache_key)) return { data: null, error: { code: '23505' } }
          db.rows.set(values.cache_key, { ...values })
          return { data: null, error: null }
        }
        if (op === 'upsert') { db.rows.set(values.cache_key, { ...values }); return { data: null, error: null } }
        if (op === 'update') {
          const hit = [...db.rows.values()].filter(match)
          for (const row of hit) Object.assign(row, values)
          return { data: hit.map(r => ({ cache_key: r.cache_key })), error: null }
        }
        const hit = [...db.rows.values()].filter(match)
        return { data: single ? (hit[0] ? { ...hit[0] } : null) : hit, error: null }
      })().then(resolve, reject)
    },
  }
  return b
}

vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: () => builder() }) }))

const { default: places } = await import('../api/places.js')

function response() {
  return { code: 0, setHeader() {}, status(c) { this.code = c; return this }, json() { return this }, end() { return this } }
}

beforeEach(() => {
  db.rows.clear()
  vi.unstubAllEnvs()
  vi.stubEnv('GOOGLE_MAPS_API_KEY', 'fake')
  vi.stubEnv('SUPABASE_URL', 'https://example.invalid')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'fake')
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ places: [] }) })))
})

const usage = () => [...db.rows.values()].find(r => r.cache_key.startsWith('usage:nearby:'))?.payload?.n

it('counts every one of a room\'s parallel nearby searches', async () => {
  const types = ['italian_restaurant', 'sushi_restaurant', 'thai_restaurant', 'mexican_restaurant']
  await Promise.all(types.map((t, i) => places({
    method: 'GET',
    headers: { referer: 'https://swaip.app/room/abc', 'x-forwarded-for': `10.0.0.${i}` },
    query: { op: 'nearby', lat: '50.08', lng: '14.42', types: t },
  }, response())))
  expect(usage()).toBe(4)
})

it('stops at the cap even when the calls race', async () => {
  vi.stubEnv('PLACES_NEARBY_DAILY_MAX', '3')
  const res = await Promise.all([1, 2, 3, 4, 5].map(i => {
    const r = response()
    return places({
      method: 'GET',
      headers: { referer: 'https://swaip.app/room/abc', 'x-forwarded-for': `10.0.1.${i}` },
      query: { op: 'nearby', lat: '50.0' + i, lng: '14.42', types: 'cafe' },
    }, r).then(() => r.code)
  }))
  expect(res.filter(c => c === 200)).toHaveLength(3)
  expect(res.filter(c => c === 429)).toHaveLength(2)
  expect(usage()).toBe(3)
})
