import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { accuracyLevel, formatAccuracy, accuracyBucket, getBestPosition } from '../geo'

describe('accuracyLevel', () => {
  it('treats a normal GPS fix as good', () => {
    expect(accuracyLevel(12)).toBe('good')
    expect(accuracyLevel(250)).toBe('good')
  })
  it('flags a Wi-Fi-grade fix as rough', () => {
    expect(accuracyLevel(251)).toBe('rough')
    expect(accuracyLevel(1200)).toBe('rough')
  })
  it('flags a cell-tower fix as bad — distances would be meaningless', () => {
    expect(accuracyLevel(1201)).toBe('bad')
    expect(accuracyLevel(3400)).toBe('bad')
  })
})

describe('formatAccuracy', () => {
  it('uses metres below a kilometre and km above', () => {
    expect(formatAccuracy(25)).toBe('±25 m')
    expect(formatAccuracy(3400)).toBe('±3.4 km')
  })
})

describe('accuracyBucket', () => {
  it('buckets fixes for analytics without leaking a position', () => {
    expect(accuracyBucket(20)).toBe('0-50m')
    expect(accuracyBucket(200)).toBe('50-250m')
    expect(accuracyBucket(900)).toBe('250m-1km')
    expect(accuracyBucket(3000)).toBe('1-5km')
    expect(accuracyBucket(20000)).toBe('5km+')
    expect(accuracyBucket(null)).toBe('unknown')
  })
})

describe('getBestPosition', () => {
  let geo
  beforeEach(() => {
    vi.useFakeTimers()
    geo = { watchPosition(ok, err) { geo.ok = ok; geo.err = err; return 1 }, clearWatch: vi.fn() }
    vi.stubGlobal('navigator', { geolocation: geo })
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
  const fix = accuracy => ({ coords: { latitude: 50, longitude: 14, accuracy } })

  it('stops at once on a typical indoor Wi-Fi fix (~65 m)', async () => {
    const p = getBestPosition()
    geo.ok(fix(65))
    await expect(p).resolves.toMatchObject({ accuracy: 65 })
  })

  it('treats "no fix yet" (code 2) as still trying when a fix follows', async () => {
    const p = getBestPosition()
    geo.err({ code: 2 })
    await vi.advanceTimersByTimeAsync(1500)
    geo.ok(fix(40))
    await expect(p).resolves.toMatchObject({ accuracy: 40 })
  })

  it('gives up on a device with no location after 3 s, not the full wait', async () => {
    const p = getBestPosition()
    const check = expect(p).rejects.toMatchObject({ code: 2 })
    geo.err({ code: 2 })
    await vi.advanceTimersByTimeAsync(3000)
    await check
    expect(geo.clearWatch).toHaveBeenCalled()
  })

  it('still fails at once when location is refused', async () => {
    const p = getBestPosition()
    geo.err({ code: 1 })
    await expect(p).rejects.toMatchObject({ code: 1 })
  })
})
