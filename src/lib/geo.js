// Where the phone thinks it is - as a hint that moves the map pin, never as the
// answer. The pin on the map is what a room is created from; this only saves
// the user some panning when the fix is good.
//
// Why it can't be the answer on an iPhone: with Precise Location off (for
// "Safari Websites", or for the app hosting an in-app browser such as Messenger
// or Instagram) iOS hands websites a snapped point that is usually 1-20 km off
// and only moves a few times an hour. enableHighAccuracy and waiting longer
// change nothing, and no API reveals the setting. What code CAN do is notice
// the pattern quickly and say so, instead of waiting out a timer and calling it
// "weak GPS".
//
// What the old version got wrong (found 2026-09-30):
// - POSITION_UNAVAILABLE (code 2) was fatal. On iOS it is Core Location's
//   "don't know yet, still trying", which Apple says to ignore.
// - Its 9 s timer started before the permission prompt was answered, so a slow
//   tap on Allow used up the whole wait.
// - It kept the most accurate fix without looking at its age, and Core
//   Location can hand back a cached one first.
// - The 60 m target sat just under the ~65 m a typical indoor Wi-Fi fix
//   reports, so most attempts waited the full nine seconds.

export const RADIUS_STEPS = [1000, 2000, 3000, 5000, 10000, 15000, 20000]
export const DEFAULT_RADIUS = 5000

export class LocateError extends Error {
  constructor(kind, { earlier = false } = {}) {
    super(kind)
    this.name = 'LocateError'
    // 'unsupported' | 'denied' | 'unavailable' | 'no-response' | 'aborted'
    this.kind = kind
    this.earlier = earlier   // denied before on this page, not asked again
  }
}

// WebKit keeps a denial for the life of the document: asking again gets an
// instant "denied" with no prompt. Remember it (on iOS only: Chrome asks again
// and applies a changed site setting at once) so the message can say "reload".
let deniedThisDocument = false
export function _resetGeoForTests() { deniedThisDocument = false }

export function getBestPosition({
  targetAccuracy = 100,     // fresh fix this good: stop straight away
  settleMs = 8000,          // after the first answer, how long to keep improving
  promptCapMs = 30000,      // no answer at all by then: prompt ignored or never shown
  maxAgeMs = 60000,         // older fixes are cached, ranked below fresh ones
  approxAccuracyM = 1000,   // at or above this and not improving: approximate mode
  approxQuietMs = 5000,     // a coarse fix that stops improving for this long
  rememberDenial = false,   // pass true on iOS, where WebKit keeps a denial per page
  onFix,                    // ({ lat, lng, accuracy, stale }) on every better fix
  onEvent,                  // diagnostics, never coordinates
  signal,
} = {}) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now()
    const emit = (e) => {
      if (!onEvent) return
      try { onEvent({ tMs: Date.now() - t0, ...e }) } catch { /* diagnostics only */ }
    }
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : null
    if (!geo) { reject(new LocateError('unsupported')); return }
    if (deniedThisDocument) { reject(new LocateError('denied', { earlier: true })); return }
    if (signal?.aborted) { reject(new LocateError('aborted')); return }

    let best = null            // { pos, ageMs, stale }
    let fixCount = 0
    let sawUnavailable = false
    let answered = false       // permission is settled once anything comes back
    let watchId = null
    let done = false
    let promptTimer = null
    let settleTimer = null
    let quietTimer = null

    const cleanup = () => {
      done = true
      if (watchId != null) geo.clearWatch(watchId)
      clearTimeout(promptTimer)
      clearTimeout(settleTimer)
      clearTimeout(quietTimer)
      signal?.removeEventListener?.('abort', onAbort)
    }
    const succeed = (approximate) => {
      if (done) return
      cleanup()
      const c = best.pos.coords
      const out = {
        lat: c.latitude, lng: c.longitude, accuracy: c.accuracy,
        ageMs: best.ageMs, stale: best.stale, fixCount, approximate: Boolean(approximate),
      }
      emit({ type: 'done', accuracy: out.accuracy, ageMs: out.ageMs, approximate: out.approximate })
      resolve(out)
    }
    const fail = (kind) => {
      if (done) return
      cleanup()
      emit({ type: 'done', kind })
      reject(new LocateError(kind))
    }
    function onAbort() { fail('aborted') }
    signal?.addEventListener?.('abort', onAbort)

    promptTimer = setTimeout(() => fail(sawUnavailable ? 'unavailable' : 'no-response'), promptCapMs)

    const onAnswer = () => {
      if (answered) return
      answered = true
      clearTimeout(promptTimer)
      settleTimer = setTimeout(() => {
        if (best) succeed(best.pos.coords.accuracy >= approxAccuracyM)
        else fail(sawUnavailable ? 'unavailable' : 'no-response')
      }, settleMs)
    }

    const onPosition = (pos) => {
      if (done) return
      onAnswer()
      fixCount++
      const acc = pos.coords.accuracy
      const ageMs = Math.max(0, Date.now() - (pos.timestamp || Date.now()))
      const stale = ageMs > maxAgeMs
      emit({ type: 'fix', accuracy: acc, ageMs })

      const better = !best
        || (best.stale && !stale)
        || (best.stale === stale && acc < best.pos.coords.accuracy)
      if (better) {
        best = { pos, ageMs, stale }
        if (onFix) {
          try { onFix({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: acc, stale }) } catch { /* never break the fix */ }
        }
      }
      if (!stale && acc <= targetAccuracy) { succeed(false); return }

      // Reduced accuracy hands over one coarse point and then repeats it (or
      // goes quiet for minutes). Three tells, strongest first: the same coarse
      // point again, a first fix that is coarse and old, and a coarse best that
      // stops improving. A coarse fix that keeps getting better is a precise
      // phone warming up GPS, so each improvement restarts the wait.
      if (best.pos.coords.accuracy >= approxAccuracyM) {
        const b = best.pos.coords
        const c = pos.coords
        if (!better && !stale && c.latitude === b.latitude && c.longitude === b.longitude) { succeed(true); return }
        if (stale && fixCount === 1) { succeed(true); return }
        if (better || !quietTimer) {
          clearTimeout(quietTimer)
          quietTimer = setTimeout(() => succeed(true), approxQuietMs)
        }
      } else if (quietTimer) {
        clearTimeout(quietTimer)
        quietTimer = null
      }
    }

    const onError = (err) => {
      if (done) return
      const code = err?.code
      emit({ type: 'error', code })
      if (code === 1) {
        if (rememberDenial) deniedThisDocument = true
        fail('denied')
        return
      }
      // Code 2 means "still trying" on iOS; code 3 needs a timeout option, which
      // isn't passed. Either way, keep waiting.
      if (code === 2) sawUnavailable = true
      onAnswer()
    }

    emit({ type: 'start' })
    // No timeout option: WebKit starts that clock only after permission, and
    // the deadlines above already cover both halves of the wait.
    watchId = geo.watchPosition(onPosition, onError, { enableHighAccuracy: true, maximumAge: 0 })
    if (done && watchId != null) geo.clearWatch(watchId)
  })
}

// How much to trust a fix for a search of this radius. 'good': search away;
// 'rough': usable but say so; 'bad': the pin needs moving.
export function accuracyLevel(accuracy, radius = DEFAULT_RADIUS) {
  if (accuracy == null) return 'good'
  if (accuracy <= Math.max(150, radius * 0.1)) return 'good'
  if (accuracy <= radius * 0.5) return 'rough'
  return 'bad'
}

export function formatAccuracy(accuracy) {
  if (accuracy == null) return ''
  return accuracy >= 1000
    ? `±${Math.round(accuracy / 100) / 10} km`
    : `±${Math.round(accuracy)} m`
}

export function formatRadius(radius) {
  return radius >= 1000 ? `${Math.round(radius / 100) / 10} km` : `${radius} m`
}

// Great-circle distance in metres.
export function distanceM(a, b) {
  const R = 6371000
  const toRad = d => d * Math.PI / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}
