import { describe, it, expect } from 'vitest'
import { encodeGuess, decodeGuess, scoreGuess, puzzlesForRoom, COLOR_PUZZLES, ROUNDS_PER_GAME } from '../colorGame'

describe('guess encoding', () => {
  it('round-trips every corner of the colour space across all rounds', () => {
    for (let round = 0; round < ROUNDS_PER_GAME; round++) {
      for (const hex of ['#000000', '#FFFFFF', '#FF00FF', '#123456']) {
        const decoded = decodeGuess(encodeGuess(round, hex))
        expect(decoded).toEqual({ round, hex })
      }
    }
  })

  it('never collides with DONE sentinels or real deck ids', () => {
    const min = encodeGuess(0, '#000000')
    expect(min).toBeGreaterThan(9999999)          // above every sentinel
    expect(decodeGuess(1999)).toBeNull()
    expect(decodeGuess(2999)).toBeNull()
    expect(decodeGuess(9999999)).toBeNull()
    expect(decodeGuess(603)).toBeNull()           // a TMDB id
  })

  it('rejects out-of-range payloads', () => {
    expect(decodeGuess(encodeGuess(ROUNDS_PER_GAME, '#FFFFFF'))).toBeNull()
  })
})

describe('scoring', () => {
  it('a perfect guess scores 100', () => {
    expect(scoreGuess('#C63032', '#C63032')).toBe(100)
  })
  it('an opposite colour scores 0', () => {
    expect(scoreGuess('#00FFFF', '#C63032')).toBe(0)
  })
  it('close beats far', () => {
    const close = scoreGuess('#D04040', '#C63032')
    const far = scoreGuess('#3050D0', '#C63032')
    expect(close).toBeGreaterThan(far)
  })
})

describe('puzzle deck', () => {
  it('is deterministic per room and differs between rooms', () => {
    const a1 = puzzlesForRoom('room-a').map(p => p.id)
    const a2 = puzzlesForRoom('room-a').map(p => p.id)
    expect(a1).toEqual(a2)
  })
  it('every puzzle ships a mask (maskless rounds are ambiguous)', () => {
    for (const p of COLOR_PUZZLES) expect(p.mask, `${p.id} has no mask`).toBeTruthy()
  })
})
