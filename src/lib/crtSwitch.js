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
// A CRT switching off is three things at once: the crack of static as the
// charge lets go, the flyback whine sliding down as it loses power, and a soft
// thump when the picture finally dies. Switching on runs it backwards and adds
// the degauss - that low wobbling hum the coil makes as it demagnetises the
// shadow mask, which is the sound people actually remember.
//
// Synthesised rather than shipped as a file: it's a few oscillators and a
// buffer of noise, and an audio asset for half a second of blip isn't worth
// the download. One context, created on the first toggle - a click is a user
// gesture, which is what browsers require before any audio can start.
let audio = null
let noiseBuffer = null

function ctx() {
  if (audio) return audio
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  try { audio = new AC() } catch { return null }
  return audio
}

// White noise, made once and reused. The real thing is a broadband crackle;
// a band-pass over noise is a close enough impression of it.
function noise(ac) {
  if (noiseBuffer) return noiseBuffer
  const len = Math.floor(ac.sampleRate * 0.4)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  noiseBuffer = buf
  return buf
}

// A burst of static: sharp attack, quick decay, band-passed so it reads as an
// electrical crack rather than a hiss.
function crack(ac, at, { peak = 0.05, decay = 0.05, freq = 3200, q = 0.8 } = {}) {
  const src = ac.createBufferSource()
  src.buffer = noise(ac)
  const band = ac.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = freq
  band.Q.value = q
  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.006)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay)
  src.connect(band).connect(gain).connect(ac.destination)
  src.start(at)
  src.stop(at + decay + 0.05)
}

// The flyback whine. The real one sits around 15kHz, which is either piercing
// or inaudible depending on your ears and your speakers, so this sweeps across
// a range everyone can actually hear.
function whine(ac, at, from, to, dur, peak = 0.028) {
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(from, at)
  osc.frequency.exponentialRampToValueAtTime(to, at + dur)
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  osc.connect(gain).connect(ac.destination)
  osc.start(at)
  osc.stop(at + dur + 0.05)
}

// The degauss: a low hum that swells and dies, wobbling as it goes. That
// wobble is the whole character of it, so it gets its own oscillator driving
// the gain rather than a plain envelope.
function degauss(ac, at, dur = 0.42) {
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(62, at)
  osc.frequency.exponentialRampToValueAtTime(44, at + dur)
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(0.055, at + 0.05)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur)

  const lfo = ac.createOscillator()
  const lfoGain = ac.createGain()
  lfo.type = 'sine'
  lfo.frequency.setValueAtTime(18, at)
  lfo.frequency.linearRampToValueAtTime(7, at + dur)
  lfoGain.gain.value = 0.022
  lfo.connect(lfoGain).connect(gain.gain)

  osc.connect(gain).connect(ac.destination)
  osc.start(at); lfo.start(at)
  osc.stop(at + dur + 0.05); lfo.stop(at + dur + 0.05)
}

function tvSound(off) {
  const ac = ctx()
  if (!ac) return
  try {
    if (ac.state === 'suspended') ac.resume()
    const t = ac.currentTime
    if (off) {
      crack(ac, t, { peak: 0.06, decay: 0.045, freq: 3600 })   // the charge letting go
      whine(ac, t, 3800, 140, 0.24)                            // flyback sliding down
      crack(ac, t + 0.2, { peak: 0.03, decay: 0.09, freq: 700, q: 1.6 })  // the picture dying
    } else {
      degauss(ac, t)                                           // the coil, the sound you remember
      crack(ac, t + 0.04, { peak: 0.035, decay: 0.06, freq: 2600 })
      whine(ac, t + 0.06, 170, 3400, 0.26, 0.022)              // flyback spinning up
    }
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
    if (sound) tvSound(true)

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
    if (sound) tvSound(false)
    await Promise.all([
      run(top, [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], EXPAND),
      run(bottom, [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], EXPAND),
      run(line, [{ opacity: 1 }, { opacity: 0 }], EXPAND),
    ])
  } catch (err) {
    // Swallowing this silently once hid a broken half of the sequence, so it
    // gets said out loud even though it's never fatal.
    console.warn('[crtSwitch] interrupted:', err)
    swap()   // an interrupted animation must never leave the old theme on screen
  } finally {
    stage.remove()
  }
}
