import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getBestPosition, accuracyLevel, formatAccuracy, formatRadius, distanceM,
  _resetGeoForTests, RADIUS_STEPS, DEFAULT_RADIUS,
} from '../geo'

// A navigator.geolocation we can drive by hand: the test decides when the
// "OS" answers and with what.
function fakeGeolocation() {
  const g = {
    success: null,
    error: null,
    cleared: 0,
    watchPosition(onSuccess, onError) { g.success = onSuccess; g.error = onError; return 7 },
    clearWatch() { g.cleared++ },
  }
  return g
}
const fix = (accuracy, ageMs = 0) => ({
  coords: { latitude: 49.5875, longitude: 17.2515, accuracy },
  timestamp: Date.now() - ageMs,
})

describe('getBestPosition', () => {
  let geo
  beforeEach(() => {
    vi.useFakeTimers()
    _resetGeoForTests()
    geo = fakeGeolocation()
    vi.stubGlobal('navigator', { geolocation: geo })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('treats POSITION_UNAVAILABLE as "still trying", not as failure', async () => {
    const p = getBestPosition()
    geo.error({ code: 2 })
    geo.success(fix(40))
    await expect(p).resolves.toMatchObject({ accuracy: 40, approximate: false })
    expect(geo.cleared).toBe(1)
  })

  it('stops at once on a typical indoor Wi-Fi fix (~65 m)', async () => {
    const p = getBestPosition()
    geo.success(fix(65))
    await expect(p).resolves.toMatchObject({ accuracy: 65 })
  })

  it('prefers a fresh fix over a sharper cached one', async () => {
    const p = getBestPosition()
    geo.success(fix(10, 20 * 60 * 1000))   // 20 minutes old
    geo.success(fix(65))
    const r = await p
    expect(r.accuracy).toBe(65)
    expect(r.stale).toBe(false)
  })

  it('calls the same coarse point handed over twice approximate at once', async () => {
    const p = getBestPosition()
    geo.success(fix(3200))
    await vi.advanceTimersByTimeAsync(1000)
    geo.success(fix(3200))
    await expect(p).resolves.toMatchObject({ accuracy: 3200, approximate: true })
    expect(geo.cleared).toBe(1)
  })

  it('calls a single coarse fix that goes quiet approximate after 5 s', async () => {
    const p = getBestPosition()
    let settled = false
    p.then(() => { settled = true })
    geo.success(fix(3200))
    await vi.advanceTimersByTimeAsync(4900)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(200)
    await expect(p).resolves.toMatchObject({ accuracy: 3200, approximate: true })
  })

  it('waits for GPS on a precise phone whose first fixes come from cell towers', async () => {
    const p = getBestPosition()
    geo.success(fix(3200))
    await vi.advanceTimersByTimeAsync(2000)
    geo.success({ ...fix(1500), coords: { latitude: 49.59, longitude: 17.25, accuracy: 1500 } })
    await vi.advanceTimersByTimeAsync(4000)   // 6 s in: GPS still warming up
    geo.success(fix(20))
    await expect(p).resolves.toMatchObject({ accuracy: 20, approximate: false })
  })

  it('does not call it approximate when a good fix follows a cell fix late', async () => {
    const p = getBestPosition()
    geo.success(fix(1400))
    await vi.advanceTimersByTimeAsync(4000)
    geo.success(fix(30))
    await expect(p).resolves.toMatchObject({ accuracy: 30, approximate: false })
  })

  it('does not count the permission prompt against the wait', async () => {
    const p = getBestPosition()
    await vi.advanceTimersByTimeAsync(12000)   // user reads the prompt
    geo.success(fix(400))
    await vi.advanceTimersByTimeAsync(3000)
    geo.success(fix(90))
    await expect(p).resolves.toMatchObject({ accuracy: 90 })
  })

  it('settles on the best fix when nothing reaches the target', async () => {
    const p = getBestPosition()
    geo.success(fix(400))
    await vi.advanceTimersByTimeAsync(2000)
    geo.success(fix(250))
    await vi.advanceTimersByTimeAsync(8000)
    await expect(p).resolves.toMatchObject({ accuracy: 250, approximate: false })
  })

  it('reports no-response when the prompt is never answered', async () => {
    const p = getBestPosition()
    const check = expect(p).rejects.toMatchObject({ kind: 'no-response' })
    await vi.advanceTimersByTimeAsync(30000)
    await check
  })

  it('reports unavailable when only errors come back', async () => {
    const p = getBestPosition()
    const check = expect(p).rejects.toMatchObject({ kind: 'unavailable' })
    geo.error({ code: 2 })
    await vi.advanceTimersByTimeAsync(8000)
    await check
  })

  it('remembers a denial for the rest of the page when asked to (iOS)', async () => {
    const p = getBestPosition({ rememberDenial: true })
    geo.error({ code: 1 })
    await expect(p).rejects.toMatchObject({ kind: 'denied', earlier: false })
    await expect(getBestPosition({ rememberDenial: true })).rejects.toMatchObject({ kind: 'denied', earlier: true })
  })

  it('asks again after a denial elsewhere (Chrome prompts again)', async () => {
    const p = getBestPosition()
    geo.error({ code: 1 })
    await expect(p).rejects.toMatchObject({ kind: 'denied' })
    const again = getBestPosition()
    geo.success(fix(40))
    await expect(again).resolves.toMatchObject({ accuracy: 40 })
  })

  it('can be aborted', async () => {
    const ctrl = new AbortController()
    const p = getBestPosition({ signal: ctrl.signal })
    ctrl.abort()
    await expect(p).rejects.toMatchObject({ kind: 'aborted' })
    expect(geo.cleared).toBe(1)
  })

  it('says unsupported without navigator.geolocation', async () => {
    vi.stubGlobal('navigator', {})
    await expect(getBestPosition()).rejects.toMatchObject({ kind: 'unsupported' })
  })

  it('reports every better fix and never coordinates in diagnostics', async () => {
    const fixes = []
    const events = []
    const p = getBestPosition({ onFix: f => fixes.push(f.accuracy), onEvent: e => events.push(e) })
    geo.success(fix(900))
    geo.success(fix(1200))
    geo.success(fix(50))
    await p
    expect(fixes).toEqual([900, 50])
    expect(JSON.stringify(events)).not.toMatch(/49\.58|17\.25|latitude|lat/)
  })
})

describe('accuracyLevel', () => {
  it('judges accuracy against the search radius', () => {
    expect(accuracyLevel(12, 1000)).toBe('good')
    expect(accuracyLevel(150, 1000)).toBe('good')
    expect(accuracyLevel(400, 1000)).toBe('rough')
    expect(accuracyLevel(900, 1000)).toBe('bad')
    expect(accuracyLevel(900, 20000)).toBe('good')
    expect(accuracyLevel(3400, 5000)).toBe('bad')
  })
})

describe('formatting', () => {
  it('uses metres below a kilometre and km above', () => {
    expect(formatAccuracy(25)).toBe('±25 m')
    expect(formatAccuracy(3400)).toBe('±3.4 km')
    expect(formatRadius(5000)).toBe('5 km')
    expect(formatRadius(1500)).toBe('1.5 km')
  })
})

describe('radius steps', () => {
  it('stay under the Places Nearby cap and include the default', () => {
    expect(Math.max(...RADIUS_STEPS)).toBeLessThanOrEqual(50000)
    expect(RADIUS_STEPS).toContain(DEFAULT_RADIUS)
  })
})

describe('distanceM', () => {
  it('measures Olomouc to Prague as about 210 km', () => {
    const d = distanceM({ lat: 49.5938, lng: 17.2509 }, { lat: 50.0755, lng: 14.4378 })
    expect(d / 1000).toBeGreaterThan(205)
    expect(d / 1000).toBeLessThan(215)
  })
})
