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
    range(from, to) { b._range = [from, to]; return b },
    insert() { return b }, upsert() { return b }, update() { return b }, delete() { return b },
    single() { return b },
    then(resolve) {
      const all = tables[table] ?? []
      resolve({ data: b._range ? all.slice(b._range[0], b._range[1] + 1) : all, error: null })
    },
  }
  return b
}

vi.mock('../supabase', () => ({
  supabase: { from: (table) => makeBuilder(table) },
  // room.js waits for this before every read and write; the policies need an
  // identity, and without one the request goes out as nobody.
  ensureSession: async () => ({ user: { id: 'test-user' } }),
}))

const { fetchRoomMatches, fetchRoomPicks, fetchPartnerSwipeCount, countItemLikers, getRankings, combineRankings, currentVotes, MOVIE_SENTINELS, DONE_ITEM_ID } =
  await import('../room')

const right = (user, item) => ({ user_token: user, item_id: item, direction: 'right' })
const left = (user, item) => ({ user_token: user, item_id: item, direction: 'left' })

beforeEach(() => { tables.swipes = []; tables.rankings = [] })

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

// ── Undo: latest vote wins ────────────────────────────────────────────────────
describe('currentVotes (undo support)', () => {
  it('a newer left row takes back an earlier like', async () => {
    tables.swipes = [right('me', 10), right('them', 10), left('me', 10)]
    expect(await fetchRoomMatches('r', 'me', 2)).toEqual([])
    const picks = await fetchRoomPicks('r', 'me')
    expect(picks.myIds).toEqual([])
    expect(picks.mutualIds).toEqual([])
  })

  it('changing a pass into a like after undo counts as a like', async () => {
    tables.swipes = [left('me', 10), right('them', 10), right('me', 10)]
    expect(await fetchRoomMatches('r', 'me', 2)).toEqual([10])
  })

  it('orders by created_at when present, not by array position', () => {
    const rows = [
      { ...left('me', 7), created_at: '2026-09-15T10:00:02Z' },
      { ...right('me', 7), created_at: '2026-09-15T10:00:01Z' },
    ]
    expect(currentVotes(rows).map(r => r.direction)).toEqual(['left'])
  })

  it('counts a re-voted card once for the partner position', async () => {
    tables.swipes = [left('them', 1), left('them', 1), right('them', 2)]
    expect(await fetchPartnerSwipeCount('r', 'me')).toBe(2)
  })
})

// ── countItemLikers ───────────────────────────────────────────────────────────
// Drives the category-phase takeover: "has everyone confirmed?" must be
// answerable by any client, not only the one whose insert happened to be last.
describe('countItemLikers', () => {
  it('counts distinct players whose current vote on the item is a like', async () => {
    tables.swipes = [right('a', 1999), right('b', 1999), right('b', 1999)]
    expect(await countItemLikers('r', 1999)).toBe(2)
  })

  it('does not count a player who took their confirmation back', async () => {
    tables.swipes = [
      { ...right('a', 1999), created_at: '2026-01-01T10:00:00Z' },
      { ...right('b', 1999), created_at: '2026-01-01T10:00:01Z' },
      { ...left('b', 1999), created_at: '2026-01-01T10:00:02Z' },
    ]
    expect(await countItemLikers('r', 1999)).toBe(1)
  })
})

// ── getRankings ───────────────────────────────────────────────────────────────
// Someone who ranks nothing still writes a skip marker; without it the partner
// could never tell "locked in with nothing" from "hasn't locked in yet".
describe('getRankings', () => {
  const rank = (user, item, r) => ({ user_token: user, item_id: item, rank: r })

  it('reports a partner who skipped as submitted, with an empty list', async () => {
    tables.rankings = [rank('them', DONE_ITEM_ID, 1)]
    const { partnerRanking, partnerSubmitted } = await getRankings('r', 'me')
    expect(partnerSubmitted).toBe(true)
    expect(partnerRanking).toEqual([])
  })

  it('keeps real picks and drops the skip marker', async () => {
    tables.rankings = [rank('them', 10, 1), rank('them', 11, 2)]
    const { partnerRanking } = await getRankings('r', 'me')
    expect(partnerRanking).toEqual([10, 11])
  })

  it('reports no partner submission when only this user has ranked', async () => {
    tables.rankings = [rank('me', 10, 1)]
    const { partnerSubmitted, myRanking } = await getRankings('r', 'me')
    expect(partnerSubmitted).toBe(false)
    expect(myRanking).toEqual([10])
  })
})

// ── combineRankings ───────────────────────────────────────────────────────────
// A group's "top 3" used to be one arbitrary player's list.
describe('combineRankings', () => {
  it('weights slots (#1=3, #2=2, #3=1) across every list', () => {
    // b: 2+3 = 5, a: 3+1 = 4, c: 1+2 = 3
    expect(combineRankings([[ 'a', 'b', 'c' ], [ 'b', 'c', 'a' ]])).toEqual(['b', 'a', 'c'])
  })

  it('is stable for everyone combining the same lists', () => {
    const lists = [[10, 20], [20, 10]]          // a perfect tie on points and slot
    expect(combineRankings(lists)).toEqual(combineRankings([...lists].reverse()))
  })

  it('survives a player who ranked nothing', () => {
    expect(combineRankings([[], [7, 8]])).toEqual([7, 8])
  })
})
