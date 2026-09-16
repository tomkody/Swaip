import { prefersReducedMotion } from './motion'

// Switching the theme plays the way an old TV changes picture: the image
// collapses into a bright line, the line pinches to a dot, and the new one
// opens back out. The swap itself happens while the screen is dark, so the
// colours never cross-fade - they're just suddenly the other ones.
//
// Decorative, so it gets out of the way completely when the system asks for
// reduced motion: the theme still changes, just instantly.

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

// An exponential ramp can only approach zero, never reach it, so every voice
// ends on a short linear slide to true silence before it is stopped. Without
// it the node is still moving when it's cut, and a cut mid-waveform is a click.
const TAIL = 0.03
function silence(gain, from) {
  gain.gain.linearRampToValueAtTime(0, from + TAIL)
}

// The bed the whole thing sits on: low-passed noise, brought in and taken away
// gently. This is the soft crackle of a tube, and it's what stops the effect
// from being a bare tone - the piercing version had the sweep and nothing
// underneath it.
function hiss(ac, at, dur, peak = 0.02, cutoff = 900) {
  const src = ac.createBufferSource()
  src.buffer = noise(ac)
  src.loop = true
  const low = ac.createBiquadFilter()
  low.type = 'lowpass'
  low.frequency.setValueAtTime(cutoff, at)
  low.Q.value = 0.4
  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + dur * 0.28)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  silence(gain, at + dur)
  src.connect(low).connect(gain).connect(ac.destination)
  src.start(at)
  src.stop(at + dur + TAIL)
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
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.014)   // not instant: a click, not a spike
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay)
  silence(gain, at + decay)
  src.connect(band).connect(gain).connect(ac.destination)
  src.start(at)
  src.stop(at + decay + TAIL)
}

// The flyback whine. The real one sits around 15kHz, which is either piercing
// or inaudible depending on your ears and your speakers, so this sweeps across
// a range everyone can actually hear.
function whine(ac, at, from, to, dur, peak = 0.028) {
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'sine'          // triangle's upper harmonics were the shrill part
  osc.frequency.setValueAtTime(from, at)
  osc.frequency.exponentialRampToValueAtTime(to, at + dur)
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  silence(gain, at + dur)
  osc.connect(gain).connect(ac.destination)
  osc.start(at)
  osc.stop(at + dur + TAIL)
}

// The degauss: a low hum that swells and dies, wobbling as it goes. That
// wobble is the whole character of it, so it gets its own oscillator driving
// the gain rather than a plain envelope.
function degauss(ac, at, dur, peak, lfoFrom, lfoTo) {
  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(62, at)
  osc.frequency.exponentialRampToValueAtTime(44, at + dur)

  // Two gains, not one. The wobble is modulation, which ADDS to whatever the
  // parameter already is - so an LFO wired straight onto the envelope's gain
  // meant the hum never reached silence, it settled into a steady ±0.022
  // wobble and then got chopped off when the oscillator stopped. That cut was
  // the click at the end. Modulate first, then put the envelope after it, so
  // the envelope multiplies the wobble and takes it all the way down.
  const wobble = ac.createGain()
  wobble.gain.value = 0.62
  const lfo = ac.createOscillator()
  const lfoDepth = ac.createGain()
  lfo.type = 'sine'
  lfo.frequency.setValueAtTime(lfoFrom, at)
  lfo.frequency.linearRampToValueAtTime(lfoTo, at + dur)
  lfoDepth.gain.value = 0.38
  lfo.connect(lfoDepth).connect(wobble.gain)

  const env = ac.createGain()
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(peak, at + 0.05)
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  silence(env, at + dur)

  osc.connect(wobble).connect(env).connect(ac.destination)
  osc.start(at); lfo.start(at)
  osc.stop(at + dur + TAIL); lfo.stop(at + dur + TAIL)
}

function tvSound(off) {
  const ac = ctx()
  if (!ac) return
  try {
    if (ac.state === 'suspended') ac.resume()
    const t = ac.currentTime
    // These are the "Quick" settings off the comparison bench: about half the
    // length of the others, a snap rather than a sigh, which is what a control
    // people press often should sound like. Levels look high because a narrow
    // band-pass throws most of the noise away - measured output peaks near 0.05.
    if (off) {
      hiss(ac, t, 0.20, 0.10, 820)                             // the tube crackling
      crack(ac, t, { peak: 0.18, decay: 0.045, freq: 820, q: 2.0 })   // charge letting go
      whine(ac, t, 1400, 90, 0.17, 0.040)                      // flyback sliding down
      crack(ac, t + 0.14, { peak: 0.24, decay: 0.07, freq: 580, q: 2.2 })  // the picture dying
    } else {
      hiss(ac, t, 0.26, 0.022, 900)                            // the tube waking up
      degauss(ac, t, 0.24, 0.090, 22, 11)                      // the coil, the sound you remember
      crack(ac, t + 0.03, { peak: 0.024, decay: 0.05, freq: 1000, q: 1.3 })
      whine(ac, t + 0.04, 130, 860, 0.18, 0.016)               // flyback spinning up
    }
  } catch { /* audio is a bonus, never a requirement */ }
}

// ── The animation ────────────────────────────────────────────────────────────

// One uninterrupted animation per element rather than four awaited phases.
// Awaiting between phases costs a frame at every boundary — the promise
// resolves after the frame that finished the previous animation, so the next
// one starts a beat late. Four boundaries, four visible hitches. Everything
// below runs as a single timeline with keyframe offsets, so the compositor
// never has to stop and be told what to do next.
const COLLAPSE = 130   // picture squashes to a line
const PINCH = 110      // line pinches to a dot
const DARK = 90        // held dark: room for the repaint the theme swap causes
const OPEN = 130       // dot stretches back to a line
const EXPAND = 200     // line opens into a picture
const TOTAL = COLLAPSE + PINCH + DARK + OPEN + EXPAND

const at = ms => ms / TOTAL
const T_PINCHED = at(COLLAPSE + PINCH)
const T_OPENING = at(COLLAPSE + PINCH + DARK)
const T_OPEN = at(COLLAPSE + PINCH + DARK + OPEN)

const timeline = el => (frames) =>
  el.animate(frames, { duration: TOTAL, fill: 'forwards' })

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

  const soft = 'cubic-bezier(0.32, 0, 0.16, 1)'
  const bars = [
    { transform: 'scaleY(0)', offset: 0, easing: soft },
    { transform: 'scaleY(1)', offset: at(COLLAPSE) },
    { transform: 'scaleY(1)', offset: T_OPEN, easing: soft },
    { transform: 'scaleY(0)', offset: 1 },
  ]

  try {
    if (sound) tvSound(true)

    const running = [
      timeline(top)(bars),
      timeline(bottom)(bars),
      timeline(line)([
        { opacity: 0, transform: 'scaleX(1)', offset: 0, easing: soft },
        { opacity: 1, transform: 'scaleX(1)', offset: at(COLLAPSE), easing: soft },
        { opacity: 1, transform: 'scaleX(0.012)', offset: T_PINCHED },
        { opacity: 1, transform: 'scaleX(0.012)', offset: T_OPENING, easing: soft },
        { opacity: 1, transform: 'scaleX(1)', offset: T_OPEN, easing: soft },
        { opacity: 0, transform: 'scaleX(1)', offset: 1 },
      ]),
    ]

    // The swap repaints the whole document, so it goes in the middle of the
    // dark hold where there is nothing on screen to stutter.
    const swapAt = setTimeout(swap, COLLAPSE + PINCH + DARK / 2)
    const soundAt = sound ? setTimeout(() => tvSound(false), COLLAPSE + PINCH + DARK) : null

    try {
      await Promise.all(running.map(a => a.finished))
    } finally {
      clearTimeout(swapAt)
      clearTimeout(soundAt)
    }
  } catch (err) {
    // Swallowing this silently once hid a broken half of the sequence, so it
    // gets said out loud even though it's never fatal.
    console.warn('[crtSwitch] interrupted:', err)
    swap()   // an interrupted animation must never leave the old theme on screen
  } finally {
    stage.remove()
  }
}
