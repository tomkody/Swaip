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

// 100, not 60: an indoor Wi-Fi fix reports about 65 m, so a 60 m target made
// nearly every attempt indoors sit out the full wait for nothing.
const TARGET_ACCURACY_M = 100     // good enough to stop waiting
const MAX_WAIT_MS = 9000          // ceiling before we take the best we have

// `onFix` is called with the accuracy of each better fix as it arrives. A weak
// signal means waiting the full nine seconds, and nine seconds of a spinner
// with nothing said is indistinguishable from the thing being broken.
export function getBestPosition({ maxWaitMs = MAX_WAIT_MS, targetAccuracy = TARGET_ACCURACY_M, onFix } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('unsupported'))
      return
    }
    let best = null
    let watchId = null
    let timer = null
    let settled = false
    let grace = null      // after "no fix yet", how long to keep hoping
    let lastErr = null

    const finish = () => {
      if (settled) return
      settled = true
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
      clearTimeout(timer)
      clearTimeout(grace)
      if (best) resolve({ lat: best.coords.latitude, lng: best.coords.longitude, accuracy: best.coords.accuracy })
      else reject(new Error('timeout'))
    }

    timer = setTimeout(finish, maxWaitMs)

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) {
          best = pos
          if (onFix) { try { onFix(best.coords.accuracy) } catch { /* never break the fix */ } }
        }
        if (best.coords.accuracy <= targetAccuracy) finish()
      },
      (err) => {
        // POSITION_UNAVAILABLE (2) is often iOS saying "no fix yet, still
        // trying", so give it a few seconds to turn into a fix. A device that
        // simply has no location (a laptop with Wi-Fi off) still fails in 3 s,
        // not after the full wait.
        if (err?.code === 2 && !settled) {
          if (best) return               // keep improving; the timer above ends it
          lastErr = err
          if (!grace) grace = setTimeout(() => {
            if (settled || best) return
            settled = true
            if (watchId != null) navigator.geolocation.clearWatch(watchId)
            clearTimeout(timer)
            reject(lastErr)
          }, 3000)
          return
        }
        // Keep waiting if we already have something usable; otherwise fail.
        if (best) { finish(); return }
        if (settled) return
        settled = true
        if (watchId != null) navigator.geolocation.clearWatch(watchId)
        clearTimeout(timer)
        clearTimeout(grace)
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
// Desktops have no GPS at all, so they get a different reason and a different
// way out. Phones get the same one either way.
export function platformTag() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || ''
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

// Messenger, Instagram and Facebook open links in their own browser, which
// gets that app's location permission (often approximate), not Safari's.
export function inAppBrowserName() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || ''
  if (/FBAN\/Messenger|MessengerForiOS|Orca-Android/i.test(ua)) return 'Messenger'
  if (/Instagram/i.test(ua)) return 'Instagram'
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'Facebook'
  return null
}

const IOS_BROWSERS = [[/CriOS\//, 'Chrome'], [/FxiOS\//, 'Firefox'], [/EdgiOS\//, 'Edge'], [/OPiOS\/|OPT\//, 'Opera'], [/GSA\//, 'Google']]

// A phone fix of a kilometre or more is not weak GPS. It is the phone handing
// websites an approximate location on purpose (Precise Location off for
// Safari Websites, or for the app whose browser this is): the same phone shows
// the exact spot in Google Maps, which has its own permission, and stepping
// outside changes nothing.
export function isApproximate(accuracy) {
  return accuracy != null && accuracy >= 1000 && platformTag() !== 'desktop'
}

// Why the fix is poor, in three words. A number on its own reads like the app's
// fault; "weak GPS" tells people it's the building they're standing in.
export function accuracyReason(accuracy) {
  if (isApproximate(accuracy)) return 'approximate location'
  return platformTag() === 'desktop' ? 'no GPS' : 'weak GPS'
}

// What to do about it. The iOS Settings path used to be here - five levels of
// menu that nobody is going to walk through to pick a bar. Two things people
// will actually do, and the first one is right there on screen.
// For an approximate fix the one real fix is the setting, so it is named in a
// single line rather than walked through.
export function accuracyAdvice(accuracy) {
  if (isApproximate(accuracy)) {
    const app = inAppBrowserName()
    if (app) return `${app} only shares an approximate location. Open swaip.app in Safari or Chrome, or type your street.`
    const already = 'If it is already on, step outside for a minute or type your street.'
    if (platformTag() === 'ios') {
      // Each iOS browser has its own location permission; only Safari's lives
      // under "Safari Websites".
      const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || ''
      const named = IOS_BROWSERS.find(([re]) => re.test(ua))?.[1]
      if (named) return `Your iPhone may only be sharing an approximate location with ${named}. Turn on Precise Location in Settings › Privacy & Security › Location Services › ${named}. ${already}`
      if (!/Safari\//.test(ua)) return 'This app may only be sharing an approximate location. Open swaip.app in Safari, or type your street.'
      return `Your iPhone may only be sharing an approximate location with websites. Turn on Precise Location in Settings › Privacy & Security › Location Services › Safari Websites. ${already}`
    }
    return `Your phone may only be sharing an approximate location with this browser. Turn on precise location for it in your location settings. ${already}`
  }
  return platformTag() === 'desktop'
    ? 'Type where you are - computers locate by Wi-Fi, which is often kilometres off.'
    : 'Type where you are, or step outside for a minute.'
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
