import { describe, it, expect } from 'vitest'
import { seededShuffle, seededRandom } from '../random'
import { getBrandKey } from '../placesApi'
import { placeIdToNumId } from '../activities'

describe('seeded random', () => {
  it('same seed → identical order (both partners get the same deck)', () => {
    const arr = Array.from({ length: 50 }, (_, i) => i)
    expect(seededShuffle(arr, 'room-x')).toEqual(seededShuffle(arr, 'room-x'))
  })
  it('different seed → different order', () => {
    const arr = Array.from({ length: 50 }, (_, i) => i)
    expect(seededShuffle(arr, 'room-x')).not.toEqual(seededShuffle(arr, 'room-y'))
  })
  it('shuffle keeps every element exactly once', () => {
    const arr = Array.from({ length: 30 }, (_, i) => i)
    expect([...seededShuffle(arr, 's')].sort((a, b) => a - b)).toEqual(arr)
  })
  it('generator output is stable across calls with the same seed', () => {
    const a = seededRandom('seed'), b = seededRandom('seed')
    for (let i = 0; i < 5; i++) expect(a()).toBe(b())
  })
})

describe('getBrandKey (chain dedup)', () => {
  it('recognises known chains regardless of suffix', () => {
    expect(getBrandKey("McDonald's Wenceslas Square")).toBe("mcdonald's")
    expect(getBrandKey('KFC - Anděl')).toBe('kfc')
  })
  it('groups unknown places by the part before a separator', () => {
    expect(getBrandKey('U Fleků - Restaurant & Brewery')).toBe('u fleků')
  })
  it('distinct places stay distinct', () => {
    expect(getBrandKey('Café Louvre')).not.toBe(getBrandKey('Café Savoy'))
  })
})

describe('placeIdToNumId', () => {
  it('is stable and stays clear of category ids and DONE sentinels', () => {
    const id = placeIdToNumId('ChIJl1eBmMWUC0cR6kUXbLprwWk')
    expect(id).toBe(placeIdToNumId('ChIJl1eBmMWUC0cR6kUXbLprwWk'))
    expect(id).toBeGreaterThanOrEqual(2000000)
    expect(id).toBeLessThan(11000000)
    expect([1999, 2999, 9999999]).not.toContain(id)
  })
})
