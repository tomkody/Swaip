import { describe, it, expect } from 'vitest'
import { buildDeck } from '../deck'

const pool = Array.from({ length: 40 }, (_, i) => ({ id: i, popularity: i, rating: '7.0' }))

describe('buildDeck', () => {
  it('opens with the most popular titles, in a seeded order', () => {
    const deck = buildDeck(pool, 'room-a', { openers: 5, size: 40 })
    const openerIds = deck.slice(0, 5).map(m => m.id).sort((a, b) => a - b)
    expect(openerIds).toEqual([35, 36, 37, 38, 39])
  })
  it('is identical for both partners (same room id) and differs across rooms', () => {
    expect(buildDeck(pool, 'r1')).toEqual(buildDeck(pool, 'r1'))
    expect(buildDeck(pool, 'r1')).not.toEqual(buildDeck(pool, 'r2'))
  })
  it('falls back to rating when popularity is missing', () => {
    const p = [{ id: 'low', rating: '6.0' }, { id: 'high', rating: '9.0' }, { id: 'mid', rating: '7.5' }]
    expect(buildDeck(p, 'r', { openers: 1 })[0].id).toBe('high')
  })
  it('respects the size cap and keeps every card once', () => {
    const deck = buildDeck(pool, 'r', { size: 25 })
    expect(deck).toHaveLength(25)
    expect(new Set(deck.map(m => m.id)).size).toBe(25)
  })
})
