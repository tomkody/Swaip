import { prefersReducedMotion } from './motion'

// Switching the theme plays the way an old TV changes picture: the image
// collapses into a bright line, the line pinches to a dot, and the new one
// opens back out. The swap itself happens while the screen is dark, so the
// colours never cross-fade - they're just suddenly the other ones.
//
// Decorative, so it gets out of the way completely when the system asks for
// reduced motion: the theme still changes, just instantly.

const COLLAPSE = 130   // picture squashes to a line
const PINCH = 110      // line pinches to a dot
const OPEN = 120       // dot stretches back to a line
const EXPAND = 180     // line opens into a picture

// ── Sound ────────────────────────────────────────────────────────────────────
// Synthesised rather than shipped as a file: it's a few oscillators, and an
// audio asset for a 200ms blip isn't worth the download. One context, created
// on the first toggle - a click is a user gesture, which is what browsers
// require before any audio can start.
let audio = null
function ctx() {
  if (audio) return audio
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  try { audio = new AC() } catch { return null }
  return audio
}

function thunk(down) {
  const ac = ctx()
  if (!ac) return
  try {
    if (ac.state === 'suspended') ac.resume()
    const t = ac.currentTime
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sine'
    // Falling for off, rising for on - the pitch is the whole character of it.
    osc.frequency.setValueAtTime(down ? 620 : 90, t)
    osc.frequency.exponentialRampToValueAtTime(down ? 70 : 520, t + 0.13)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.05, t + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    osc.connect(gain).connect(ac.destination)
    osc.start(t)
    osc.stop(t + 0.2)
  } catch { /* audio is a bonus, never a requirement */ }
}

// ── The animation ────────────────────────────────────────────────────────────

const ease = 'cubic-bezier(0.4, 0, 0.2, 1)'
const run = (el, frames, ms) =>
  el.animate(frames, { duration: ms, easing: ease, fill: 'forwards' }).finished

export async function crtSwitch(swap, { sound = true } = {}) {
  if (typeof document === 'undefined' || prefersReducedMotion() || !document.body.animate) {
    swap()
    return
  }

  const stage = document.createElement('div')
  stage.className = 'crt-switch'
  stage.setAttribute('aria-hidden', 'true')
  stage.innerHTML =
    '<div class="crt-bar crt-bar--top"></div>' +
    '<div class="crt-bar crt-bar--bottom"></div>' +
    '<div class="crt-line"></div>'
  document.body.appendChild(stage)

  const top = stage.querySelector('.crt-bar--top')
  const bottom = stage.querySelector('.crt-bar--bottom')
  const line = stage.querySelector('.crt-line')

  try {
    if (sound) thunk(true)

    // Picture squashes: the bars close in and the line brightens between them.
    await Promise.all([
      run(top, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], COLLAPSE),
      run(bottom, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], COLLAPSE),
      run(line, [{ opacity: 0 }, { opacity: 1 }], COLLAPSE),
    ])
    // And pinches to a dot.
    await run(line, [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0.015)' }], PINCH)

    swap()   // the screen is dark; nothing is seen to change

    await run(line, [{ transform: 'scaleX(0.015)' }, { transform: 'scaleX(1)' }], OPEN)
    if (sound) thunk(false)
    await Promise.all([
      run(top, [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], EXPAND),
      run(bottom, [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], EXPAND),
      run(line, [{ opacity: 1 }, { opacity: 0 }], EXPAND),
    ])
  } catch {
    swap()   // an interrupted animation must never leave the old theme on screen
  } finally {
    stage.remove()
  }
}
