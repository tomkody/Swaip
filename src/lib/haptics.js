// Haptic feedback, such as the platform will give us.
//
// Android Chrome has the Vibration API. iOS Safari has never implemented it and
// still doesn't, including for a page added to the home screen — so the only
// way to make an iPhone tap is to borrow the feedback the system plays for its
// own switch control: since iOS 17.4 an <input type="checkbox" switch> fires a
// haptic when it toggles, and toggling a hidden one from script is enough.
//
// That is a trick, not an API, and it can stop working whenever Safari decides
// it should. Everything here is therefore best-effort and silent: on an older
// iPhone, on desktop, or if Apple closes it off, nothing happens and nothing
// breaks. It also has to run inside a user gesture, which every caller does.

let iosSwitch = null
let iosSupported = null

function supportsIosSwitch() {
  if (iosSupported === null) {
    try { iosSupported = 'switch' in document.createElement('input') }
    catch { iosSupported = false }
  }
  return iosSupported
}

function getIosSwitch() {
  if (iosSwitch) return iosSwitch
  const el = document.createElement('input')
  el.type = 'checkbox'
  el.setAttribute('switch', '')
  el.setAttribute('aria-hidden', 'true')
  el.tabIndex = -1
  // Rendered but invisible: a display:none control doesn't play the feedback.
  el.style.cssText =
    'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;border:0;margin:0;padding:0'
  document.body.appendChild(el)
  iosSwitch = el
  return el
}

function pulse(pattern) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      if (navigator.vibrate(pattern)) return
    }
  } catch { /* some browsers throw instead of returning false */ }

  if (typeof document === 'undefined' || !supportsIosSwitch()) return
  try {
    const el = getIosSwitch()
    // One toggle = one tap. iOS plays the feedback on the state change itself,
    // so the number of clicks is the only "intensity" control we have.
    const taps = Array.isArray(pattern) ? Math.min(3, Math.ceil(pattern.length / 2)) : 1
    for (let i = 0; i < taps; i++) {
      setTimeout(() => { try { el.click() } catch { /* ignore */ } }, i * 90)
    }
  } catch { /* never let feedback break an interaction */ }
}

// A committed swipe, a button press, a step back.
export function tapFeedback() {
  pulse(12)
}

// Something landed: a match, a locked-in top 3.
export function successFeedback() {
  pulse([18, 60, 28])
}
