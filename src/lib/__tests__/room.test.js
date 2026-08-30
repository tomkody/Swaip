import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Supabase mock ─────────────────────────────────────────────────────────────
// A chainable, thenable query builder: every filter method returns itself and
// awaiting it resolves { data, error } routed by table name. Enough to exercise
// the real logic in room.js without a database.
const tables = { swipes: [], rooms: [], rankings: [], conversation_selections: [] }

function makeBuilder(table) {
  const b = {
    _table: table,
    select() { return b }, eq() { return b }, in() { return b },
    order() { return b }, limit() { return b }, maybeSingle() { return b },
    insert() { return b }, upsert() { return b }, update() { return b }, delete() { return b },
    single() { return b },
    then(resolve) { resolve({ data: tables[table] ?? [], error: null }) },
  }
  return b
}

vi.mock('../supabase', () => ({
  supabase: { from: (table) => makeBuilder(table) },
}))

const { fetchRoomMatches, fetchRoomPicks, fetchPartnerSwipeCount, MOVIE_SENTINELS, DONE_ITEM_ID } =
  await import('../room')

const right = (user, item) => ({ user_token: user, item_id: item, direction: 'right' })

beforeEach(() => { tables.swipes = [] })

// ── fetchRoomMatches ──────────────────────────────────────────────────────────
describe('fetchRoomMatches', () => {
  it('matches only items THIS user liked that reach playerCount distinct likers', async () => {
    tables.swipes = [right('me', 10), right('me', 11), right('them', 10), right('them', 12)]
    expect(await fetchRoomMatches('r', 'me', 2)).toEqual([10])
  })

  it('requires ALL playerCount players in group rooms (the 3-player bug)', async () => {
    tables.swipes = [right('a', 10), right('b', 10), right('me', 10)]
    // 3 players agreed → match at playerCount 3
    expect(await fetchRoomMatches('r', 'me', 3)).toEqual([10])
    // only 2 of 3 agreed → NOT a match at playerCount 3
    tables.swipes = [right('me', 10), right('b', 10)]
    expect(await fetchRoomMatches('r', 'me', 3)).toEqual([])
    // …but the same rows ARE a match for a 2-player room
    expect(await fetchRoomMatches('r', 'me', 2)).toEqual([10])
  })

  it('counts distinct users, not rows (double-swipes must not fake a match)', async () => {
    tables.swipes = [right('me', 10), right('me', 10), right('me', 10)]
    expect(await fetchRoomMatches('r', 'me', 2)).toEqual([])
  })

  it('filters DONE sentinels by default (activities/food)', async () => {
    tables.swipes = [right('me', 1999), right('them', 1999), right('me', DONE_ITEM_ID), right('them', DONE_ITEM_ID)]
    expect(await fetchRoomMatches('r', 'me', 2)).toEqual([])
  })

  it('treats 1999/2999 as REAL items in movie rooms (MOVIE_SENTINELS)', async () => {
    tables.swipes = [right('me', 1999), right('them', 1999), right('me', DONE_ITEM_ID)]
    expect(await fetchRoomMatches('r', 'me', 2, MOVIE_SENTINELS)).toEqual([1999])
  })

  it('never surfaces an item the user did not like themselves', async () => {
    tables.swipes = [right('a', 10), right('b', 10)]
    expect(await fetchRoomMatches('r', 'me', 2)).toEqual([])
  })
})

// ── fetchRoomPicks ────────────────────────────────────────────────────────────
describe('fetchRoomPicks', () => {
  it('splits my/partner/mutual ids and counts likers per item', async () => {
    tables.swipes = [right('me', 1), right('me', 2), right('p', 2), right('p', 3)]
    const picks = await fetchRoomPicks('r', 'me')
    expect(picks.myIds.sort()).toEqual([1, 2])
    expect(picks.partnerIds.sort()).toEqual([2, 3])
    expect(picks.mutualIds).toEqual([2])
    expect(picks.countsById[2]).toBe(2)
    expect(picks.participants).toBe(2)
  })

  it('reports partner done via the sentinel without counting it as a pick', async () => {
    tables.swipes = [right('me', 1), right('p', DONE_ITEM_ID)]
    const picks = await fetchRoomPicks('r', 'me')
    expect(picks.othersDone).toBe(1)
    expect(picks.iAmDone).toBe(false)
    expect(picks.partnerIds).toEqual([])
  })

  it('with MOVIE_SENTINELS, a like on tmdb id 2999 is a real pick', async () => {
    tables.swipes = [right('p', 2999)]
    const picks = await fetchRoomPicks('r', 'me', MOVIE_SENTINELS)
    expect(picks.partnerIds).toEqual([2999])
    expect(picks.othersDone).toBe(0)
  })
})

// ── fetchPartnerSwipeCount ────────────────────────────────────────────────────
describe('fetchPartnerSwipeCount', () => {
  it('returns the max real-swipe count among OTHER users', async () => {
    tables.swipes = [
      right('me', 1), right('me', 2), right('me', 3), right('me', 4),
      right('p', 1), right('p', 2), right('p', DONE_ITEM_ID),
    ]
    expect(await fetchPartnerSwipeCount('r', 'me')).toBe(2)
  })

  it('minItemId isolates the places phase from category swipes', async () => {
    tables.swipes = [right('p', 1002), right('p', 1005), right('p', 2000001), right('p', 2000002), right('p', 2000003)]
    expect(await fetchPartnerSwipeCount('r', 'me', 2000000)).toBe(3)
  })
})
