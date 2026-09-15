import { describe, it, expect } from 'vitest'
import { parseRuntimeMinutes, matchesPrefs, normalizePrefs, hasPrefs, countMatches, prefsLabel, prefsPredicate } from '../movieFilters'
import { buildDeck } from '../deck'

describe('parseRuntimeMinutes', () => {
  it('reads the catalog display format', () => {
    expect(parseRuntimeMinutes('2h 22m')).toBe(142)
    expect(parseRuntimeMinutes('1h 0m')).toBe(60)
    expect(parseRuntimeMinutes('95m')).toBe(95)
    expect(parseRuntimeMinutes('3h')).toBe(180)
  })
  it('returns null for missing or unparsable text', () => {
    expect(parseRuntimeMinutes('')).toBeNull()
    expect(parseRuntimeMinutes(undefined)).toBeNull()
    expect(parseRuntimeMinutes('2 seasons')).toBeNull()
  })
})

describe('normalizePrefs / hasPrefs', () => {
  it('collapses unknown or missing values to any', () => {
    expect(normalizePrefs(undefined)).toEqual({ length: 'any', era: 'any' })
    expect(normalizePrefs({ length: 'bogus', era: 'recent' })).toEqual({ length: 'any', era: 'recent' })
    expect(hasPrefs({})).toBe(false)
    expect(hasPrefs({ length: 'under2h' })).toBe(true)
  })
})

describe('matchesPrefs', () => {
  const short = { runtime: '1h 28m', year: '2021' }
  const long = { runtime: '2h 49m', year: '1999' }
  const unknown = { runtime: '', year: '' }
  it('applies length and era together', () => {
    expect(matchesPrefs(short, { length: 'under90', era: 'recent' })).toBe(true)
    expect(matchesPrefs(short, { length: 'under90', era: 'classic' })).toBe(false)
    expect(matchesPrefs(long, { length: 'any', era: 'classic' })).toBe(true)
    expect(matchesPrefs(long, { length: 'under2h', era: 'classic' })).toBe(false)
  })
  it('keeps shorts and specials out of a length-filtered deck', () => {
    expect(matchesPrefs({ runtime: '9m', year: '2023' }, { length: 'under90' })).toBe(false)
    expect(matchesPrefs({ runtime: '35m', year: '2022' }, { length: 'under2h' })).toBe(false)
    expect(matchesPrefs({ runtime: '58m', year: '2024' }, { length: 'under90' })).toBe(true)
    expect(matchesPrefs({ runtime: '9m', year: '2023' }, {})).toBe(true) // no preference, no floor
  })
  it('never lets missing data lead a filtered deck', () => {
    expect(matchesPrefs(unknown, { length: 'under2h' })).toBe(false)
    expect(matchesPrefs(unknown, { era: 'recent' })).toBe(false)
    expect(matchesPrefs(unknown, {})).toBe(true)
  })
  it('summarises for the badge', () => {
    expect(prefsLabel({})).toBe('Any')
    expect(prefsLabel({ length: 'under2h', era: 'recent' })).toBe('Under 2h · Recent')
  })
})

describe('buildDeck with preferences', () => {
  const pool = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    popularity: i,
    rating: '7.0',
    runtime: i % 4 === 0 ? '1h 25m' : '2h 10m',   // 10 short films
    year: '2020',
  }))
  const prefs = { length: 'under90', era: 'any' }

  it('puts every matching title before any non-matching one, then keeps full size', () => {
    const deck = buildDeck(pool, 'room', { prefer: prefsPredicate(prefs) })
    const n = countMatches(pool, prefs)
    expect(n).toBe(10)
    expect(deck.slice(0, n).every(m => matchesPrefs(m, prefs))).toBe(true)
    expect(deck.slice(n).some(m => matchesPrefs(m, prefs))).toBe(false)
    expect(deck).toHaveLength(40)
    expect(new Set(deck.map(m => m.id)).size).toBe(40)
  })
  it('still front-loads the popular titles inside the non-preferred layer', () => {
    const deck = buildDeck(pool, 'room', { openers: 5, prefer: prefsPredicate(prefs) })
    const restOpeners = deck.slice(10, 15).map(m => m.id).sort((a, b) => a - b)
    expect(restOpeners).toEqual([37, 38, 39, 35, 34].sort((a, b) => a - b)) // top-5 popularity among long films
  })
  it('is unchanged without a predicate', () => {
    expect(buildDeck(pool, 'r1')).toEqual(buildDeck(pool, 'r1', { prefer: null }))
    expect(buildDeck(pool, 'r1')).toEqual(buildDeck(pool, 'r1'))
  })
})
