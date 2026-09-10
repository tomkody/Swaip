// Regression scenarios from the 2026-09-10 external code review. Real project
// functions, with Supabase / Google / TMDB / web-push replaced by an in-memory
// stand-in. Each `it` reproduced a defect at the time; keep them green.
import { beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ tables: {} }))
function builder(table) {
  const filters = []
  let operation = 'select', payload
  const b = {
    select() { return b }, order() { return b }, limit() { return b },
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
        return Promise.resolve({ data: rows.filter(r => filters.every(f => f(r))), error: null }).then(resolve, reject)
      } catch (e) { return Promise.reject(e).then(resolve, reject) }
    },
  }
  return b
}
vi.mock('../src/lib/supabase', () => ({ supabase: { from: table => builder(table) } }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: table => builder(table) }) }))
vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification: vi.fn().mockResolvedValue(undefined) } }))
vi.mock('../src/lib/analytics', () => ({ track: vi.fn() }))

import { submitConversationSelections, getConversationMatches, fetchRoomPicks } from '../src/lib/room'
import notify from '../api/notify'
import places from '../api/places'
import refreshMovies from '../api/refresh-movies'

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

// Deferred, tracked: the room deck is rebuilt per player from the live
// catalog, and an empty platform/genre filter silently widens to everything.
it.todo('keeps the shared room deck fixed across a catalog refresh')
it.todo('surfaces (rather than silently drops) a platform filter with no titles')
