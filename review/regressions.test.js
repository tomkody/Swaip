// Regression scenarios from the 2026-09-10 external code review. Real project
// functions, with Supabase / Google / TMDB / web-push replaced by an in-memory
// stand-in. Each `it` reproduced a defect at the time; keep them green.
import { beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ tables: {} }))
function builder(table) {
  const filters = []
  let operation = 'select', payload, countOnly = false, rangeFrom = null, rangeTo = null, singleRow = false
  const b = {
    select(_cols, opts) { if (opts?.head) countOnly = true; return b }, order() { return b }, limit() { return b },
    range(from, to) { rangeFrom = from; rangeTo = to; return b },
    maybeSingle() { singleRow = true; return b },
    eq(key, value) { filters.push(r => r[key] === value); return b },
    lt(key, value) { filters.push(r => r[key] < value); return b },
    in(key, values) { filters.push(r => values.includes(r[key])); return b },
    delete() { operation = 'delete'; return b },
    upsert(rows) { operation = 'upsert'; payload = rows; return b },
    insert(rows) { operation = 'insert'; payload = rows; return b },
    then(resolve, reject) {
      try {
        const rows = state.tables[table] ||= []
        if (operation === 'delete') state.tables[table] = rows.filter(r => !filters.every(f => f(r)))
        else if (operation !== 'select') rows.push(...(Array.isArray(payload) ? payload : [payload]))
        const matched = (state.tables[table] || []).filter(r => filters.every(f => f(r)))
        // Like PostgREST: plain reads stop at 1000 rows; head+count reads return only the count.
        if (countOnly) return Promise.resolve({ data: null, count: matched.length, error: null }).then(resolve, reject)
        const page = rangeFrom != null ? matched.slice(rangeFrom, rangeTo + 1) : matched
        if (singleRow) return Promise.resolve({ data: page[0] ?? null, error: null }).then(resolve, reject)
        return Promise.resolve({ data: operation === 'select' ? page.slice(0, 1000) : matched, error: null }).then(resolve, reject)
      } catch (e) { return Promise.reject(e).then(resolve, reject) }
    },
  }
  return b
}
vi.mock('../src/lib/supabase', () => ({
  supabase: { from: table => builder(table) },
  ensureSession: async () => ({ user: { id: 'test-user' } }),
}))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: table => builder(table) }) }))
vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification: vi.fn().mockResolvedValue(undefined) } }))
vi.mock('../src/lib/analytics', () => ({ track: vi.fn() }))

import { submitConversationSelections, getConversationMatches, fetchRoomPicks, fetchRoomMatches } from '../src/lib/room'
import notify from '../api/notify'
import places from '../api/places'
import refreshMovies, { writeCatalog } from '../api/refresh-movies'

beforeEach(() => { state.tables = {}; vi.unstubAllEnvs(); vi.unstubAllGlobals() })

function response() {
  return { code: 200, body: null, setHeader() {}, status(code) { this.code = code; return this }, json(body) { this.body = body; return this }, end() { return this } }
}

it('reports a partner who completed conversations with zero likes as finished', async () => {
  await submitConversationSelections('review-room', 'a', ['topic-1'])
  await submitConversationSelections('review-room', 'b', [])
  const result = await getConversationMatches('review-room', 'a')
  expect(result.partnerSubmitted).toBe(true)
  expect(result.matches).toEqual([])   // the sentinel row must never surface as a match
})

it('does not report category completion as completing restaurant swiping', async () => {
  state.tables.swipes = [{ room_id: 'review-room', user_token: 'partner', item_id: 2999, direction: 'right' }]
  const picks = await fetchRoomPicks('review-room', 'me')
  expect(picks.othersDone).toBe(0)
  expect(picks.partnerIds).toEqual([])   // …but it is not a pick either
})

it('rejects a push trigger for a match that does not exist', async () => {
  for (const [name, value] of Object.entries({ VAPID_PUBLIC_KEY: 'fake', VAPID_PRIVATE_KEY: 'fake', SUPABASE_URL: 'https://review.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fake' })) vi.stubEnv(name, value)
  state.tables.rooms = [{ id: 'review-room', type: 'movies', status: 'active', topic_id: null }]
  state.tables.push_subscriptions = [{ room_id: 'review-room', user_token: 'victim', subscription: {} }]
  const res = response()
  await notify({ method: 'POST', headers: {}, body: { roomId: 'review-room', event: 'match', itemId: 424, title: 'fabricated match' } }, res)
  expect(res.code).toBe(403)
})

it('sends a push for a real match and names the title from the catalog, not the request', async () => {
  for (const [name, value] of Object.entries({ VAPID_PUBLIC_KEY: 'fake', VAPID_PRIVATE_KEY: 'fake', SUPABASE_URL: 'https://review.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fake' })) vi.stubEnv(name, value)
  state.tables.rooms = [{ id: 'review-room', type: 'movies', status: 'active', topic_id: null }]
  state.tables.swipes = [
    { room_id: 'review-room', user_token: 'a', item_id: 424, direction: 'right' },
    { room_id: 'review-room', user_token: 'b', item_id: 424, direction: 'right' },
  ]
  state.tables.movie_catalog = [{ tmdb_id: 424, region: 'US', title: "Schindler's List" }]
  state.tables.push_subscriptions = [{ room_id: 'review-room', user_token: 'a', subscription: {} }]
  const webpush = (await import('web-push')).default
  const res = response()
  await notify({ method: 'POST', headers: {}, body: { roomId: 'review-room', event: 'match', itemId: 424, from: 'b', title: 'fabricated' } }, res)
  expect(res.code).toBe(200)
  expect(res.body.sent).toBe(1)
  const payload = JSON.parse(webpush.sendNotification.mock.calls.at(-1)[1])
  expect(payload.body).toContain("Schindler's List")
  expect(payload.body).not.toContain('fabricated')
})

it('rejects a Places request that does not come from our site before invoking Google', async () => {
  vi.stubEnv('GOOGLE_MAPS_API_KEY', 'fake')
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ places: [] }) })
  vi.stubGlobal('fetch', fetchMock)
  const res = response()
  await places({ method: 'GET', headers: {}, query: { op: 'geocode', q: 'Synthetic review location' } }, res)
  expect(res.code).toBe(403)
  expect(fetchMock).not.toHaveBeenCalled()
})

it('serves a Places request from swaip.app', async () => {
  vi.stubEnv('GOOGLE_MAPS_API_KEY', 'fake')
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ places: [] }) })
  vi.stubGlobal('fetch', fetchMock)
  const res = response()
  await places({ method: 'GET', headers: { referer: 'https://swaip.app/create/food' }, query: { op: 'geocode', q: 'Prague' } }, res)
  expect(res.code).toBe(200)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('preserves the existing catalog when all TMDB detail requests fail', async () => {
  for (const [name, value] of Object.entries({ CRON_SECRET: 'fake', TMDB_READ_TOKEN: 'fake', SUPABASE_URL: 'https://review.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fake', REGIONS: 'CZ' })) vi.stubEnv(name, value)
  state.tables.movie_catalog = [{ tmdb_id: 1, region: 'CZ', updated_at: '2020-01-01T00:00:00Z' }]
  state.tables.series_catalog = [{ tmdb_id: 2, region: 'CZ', updated_at: '2020-01-01T00:00:00Z' }]
  vi.stubGlobal('fetch', vi.fn(async url => {
    if (String(url).includes('/discover/')) return { ok: true, status: 200, json: async () => ({ results: [{ id: 1 }], total_pages: 1 }) }
    return { ok: false, status: 503 }
  }))
  const res = response()
  await refreshMovies({ headers: { authorization: 'Bearer fake' } }, res)
  expect(res.code).toBe(500)
  expect(state.tables.movie_catalog).toHaveLength(1)
  expect(state.tables.series_catalog).toHaveLength(1)
})

it('does not prune a catalog larger than the 1000-row read cap after a partial run', async () => {
  const oldStamp = '2020-01-01T00:00:00Z'
  state.tables.movie_catalog = Array.from({ length: 1500 }, (_, i) => ({ tmdb_id: 100000 + i, region: 'CZ', updated_at: oldStamp }))
  const partial = Array.from({ length: 800 }, (_, i) => ({ tmdb_id: i + 1, region: 'CZ' }))   // 800 < 70% of 1500
  const report = await writeCatalog((await import('@supabase/supabase-js')).createClient(), 'movie_catalog', partial, ['CZ'], '2026-09-16T04:00:00Z')
  expect(report.before).toBe(1500)
  expect(report.pruned).toBe(false)
  expect(state.tables.movie_catalog.filter(r => r.updated_at === oldStamp)).toHaveLength(1500)
})

// Deferred, tracked: the room deck is rebuilt per player from the live
// catalog, and an empty platform/genre filter silently widens to everything.
it.todo('keeps the shared room deck fixed across a catalog refresh')
it.todo('surfaces (rather than silently drops) a platform filter with no titles')

// A busy room (a group, or a lot of take-backs) passes 1000 swipe rows, and
// PostgREST truncates a plain select there without saying so — matches were
// then computed from a prefix of the votes.
it('reads past the 1000-row cap when matching a busy room', async () => {
  const rows = []
  for (let i = 0; i < 700; i++) {
    rows.push({ room_id: 'busy', user_token: 'me', item_id: i, direction: 'left', created_at: '2026-01-01T00:00:00Z' })
    rows.push({ room_id: 'busy', user_token: 'them', item_id: i, direction: 'left', created_at: '2026-01-01T00:00:00Z' })
  }
  // The only mutual like sits well past row 1000.
  rows.push({ room_id: 'busy', user_token: 'me', item_id: 5001, direction: 'right', created_at: '2026-01-01T00:01:00Z' })
  rows.push({ room_id: 'busy', user_token: 'them', item_id: 5001, direction: 'right', created_at: '2026-01-01T00:01:00Z' })
  state.tables.swipes = rows

  expect(await fetchRoomMatches('busy', 'me', 2)).toEqual([5001])
})

// Google's own per-day quota for the Places search SKUs is not adjustable on
// this project, so the daily cap in api/places.js is the only hard stop there
// is. It has to hold across instances, which means counting in the database.
it('stops calling Google once the day\'s place-search budget is spent', async () => {
  for (const [name, value] of Object.entries({
    GOOGLE_MAPS_API_KEY: 'fake',
    SUPABASE_URL: 'https://review.invalid',
    SUPABASE_SERVICE_ROLE_KEY: 'fake',
    PLACES_NEARBY_DAILY_MAX: '2',
  })) vi.stubEnv(name, value)
  const today = new Date().toISOString().slice(0, 10)
  state.tables.places_cache = [{ cache_key: `usage:nearby:${today}`, payload: { n: 2 }, created_at: new Date().toISOString() }]

  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ places: [] }) })
  vi.stubGlobal('fetch', fetchMock)
  const res = response()
  await places({
    method: 'GET',
    headers: { origin: 'https://swaip.app' },
    query: { op: 'nearby', lat: '50.08', lng: '14.42', radius: '1000', types: 'cafe' },
  }, res)

  expect(res.code).toBe(429)
  expect(fetchMock).not.toHaveBeenCalled()
})

// CI caught this before a user did: with row-level security on, creating a room
// inserts `created_by = auth.uid()`, and the policy compares the two. The
// anonymous sign-in is kicked off at startup but nothing waited for it, so a
// fast click on "Create Room" went out with no identity and was refused.
it('waits for the session before touching the database', async () => {
  const order = []
  vi.resetModules()
  vi.doMock('../src/lib/supabase', () => ({
    supabase: { from: table => { order.push('query'); return builder(table) } },
    ensureSession: async () => { order.push('session'); return { user: { id: 'u' } } },
  }))
  const { recordSwipe, getRoom } = await import('../src/lib/room')
  state.tables.rooms = [{ id: 'r1', type: 'movies' }]
  await recordSwipe('r1', 'me', 10, 'right')
  await getRoom('r1')
  vi.doUnmock('../src/lib/supabase')
  expect(order[0]).toBe('session')
  expect(order).not.toContain(undefined)
})
