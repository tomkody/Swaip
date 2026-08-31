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
