// Getting a location that's actually usable for a 1 km search.
//
// getCurrentPosition() resolves on the FIRST fix the OS hands over. On iOS that
// is typically a coarse Wi-Fi/cell estimate (often ±1–5 km) — GPS needs a few
// seconds to warm up. Accepting that first fix is why a place shown as "600 m
// away" could really be 3 km away: every distance is measured from the room's
// stored centre, so a bad centre poisons the whole room.
//
// So: watch the position for a few seconds, keep the most accurate fix seen,
// and return early once it's good enough.

const TARGET_ACCURACY_M = 60      // good enough to stop waiting
const MAX_WAIT_MS = 9000          // ceiling before we take the best we have

export function getBestPosition({ maxWaitMs = MAX_WAIT_MS, targetAccuracy = TARGET_ACCURACY_M } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('unsupported'))
      return
    }
    let best = null
    let watchId = null
    let timer = null
    let settled = false

    const finish = () => {
      if (settled) return
      settled = true
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
      clearTimeout(timer)
      if (best) resolve({ lat: best.coords.latitude, lng: best.coords.longitude, accuracy: best.coords.accuracy })
      else reject(new Error('timeout'))
    }

    timer = setTimeout(finish, maxWaitMs)

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos
        if (best.coords.accuracy <= targetAccuracy) finish()
      },
      (err) => {
        // Keep waiting if we already have something usable; otherwise fail.
        if (best) { finish(); return }
        if (settled) return
        settled = true
        if (watchId != null) navigator.geolocation.clearWatch(watchId)
        clearTimeout(timer)
        reject(err)
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: maxWaitMs }
    )
  })
}

// How much to trust a fix. 'good' → search away; 'rough' → usable but say so;
// 'bad' → distances would be meaningless, push the user to type a city.
export function accuracyLevel(accuracy) {
  if (accuracy == null) return 'good'
  if (accuracy <= 250) return 'good'
  if (accuracy <= 1200) return 'rough'
  return 'bad'
}

export function formatAccuracy(accuracy) {
  if (accuracy == null) return ''
  return accuracy >= 1000
    ? `±${Math.round(accuracy / 100) / 10} km`
    : `±${Math.round(accuracy)} m`
}

// ── Platform-aware guidance ───────────────────────────────────────────────────
// The "turn on Precise Location" path only exists on iOS; showing it on Android
// or desktop is just confusing, and desktops have no GPS at all.
export function platformTag() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || ''
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

export function accuracyAdvice() {
  switch (platformTag()) {
    case 'ios':
      return 'Turn on Settings → Privacy & Security → Location Services → Safari Websites → Precise Location, step outside for a moment, or type your city below.'
    case 'android':
      return 'Make sure precise location is allowed for your browser, step outside for a moment, or type your city below.'
    default:
      return 'Desktop browsers locate by Wi-Fi/IP, which is often kilometres off — type your city below for accurate results.'
  }
}

// Coarse buckets for analytics: enough to see the real-world distribution of fix
// quality without recording anything about where anyone actually is.
export function accuracyBucket(accuracy) {
  if (accuracy == null) return 'unknown'
  if (accuracy <= 50) return '0-50m'
  if (accuracy <= 250) return '50-250m'
  if (accuracy <= 1000) return '250m-1km'
  if (accuracy <= 5000) return '1-5km'
  return '5km+'
}
