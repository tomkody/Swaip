import { describe, expect, it } from 'vitest'
import { reconcileMatches } from '../useMatchMoments'

const deck = [{ id: 1, title: 'A' }, { id: 2, title: 'B' }, { id: 3, title: 'C' }]

describe('reconcileMatches', () => {
  it('adds a match the realtime event missed and drops one the partner took back', () => {
    const next = reconcileMatches([deck[0]], deck, [2])
    expect(next.map(m => m.id)).toEqual([2])
  })

  it('returns the same array when nothing changed, so React skips the render', () => {
    const prev = [deck[1]]
    expect(reconcileMatches(prev, deck, [2])).toBe(prev)
  })

  it('keeps a match this player made seconds ago even if the read predates it', () => {
    const recent = new Map([[3, 1000]])
    const next = reconcileMatches([], deck, [], { recent, now: 5000 })
    expect(next.map(m => m.id)).toEqual([3])
    expect(reconcileMatches([], deck, [], { recent, now: 20000 })).toEqual([])
  })

  it('never brings back a like that is being taken back', () => {
    const next = reconcileMatches([deck[0]], deck, [1, 2], { takingBack: new Set([1]) })
    expect(next.map(m => m.id)).toEqual([2])
  })

  it('matches places by numId while keeping the place id as the key', () => {
    const places = [{ id: 'g-1', numId: 2500001 }, { id: 'g-2', numId: 2500002 }]
    const next = reconcileMatches([], places, [2500002], { keyOf: p => p.numId })
    expect(next.map(p => p.id)).toEqual(['g-2'])
  })
})
