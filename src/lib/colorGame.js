// Color Duel — guess the iconic colour of a movie/series poster element.
// Puzzles use the same official TMDB posters (and attribution) the rest of the
// app already displays; target colours were sampled from the posters themselves.

// Every target is a SPECIFIC element with one constant, iconic colour
// (a character's skin, a costume, a logo) — never a broad multi-shade area.
// `mask` is a per-poster alpha PNG (generated from the poster itself) that
// clips the live colourise overlay to JUST the asked-about element, so only
// e.g. the Bride's suit changes colour while the rest stays greyscale.
// Target hexes are sampled from the element's lit pixels — the colour you
// actually remember, not a shadow-skewed average.
// Curated hard: a puzzle ships only if its element can be isolated CLEANLY.
// Masks were grown from seed points inside the element (region growing follows
// the real silhouette), and every one was eyeballed — anything that leaked or
// looked ragged was cut rather than shipped looking sloppy.
// Posters that ARE one iconic colour need no mask at all (whole-image tint).
export const COLOR_PUZZLES = [
  { id: 'simpsons', media: 'series', title: 'The Simpsons',      label: "Bart's skin",                 poster: 'https://image.tmdb.org/t/p/w500/uWpG7GqfKGQqX4YMAo3nv5OrglV.jpg', mask: '/game-masks/simpsons.png', hex: '#F9D716' },
  { id: 'monsters', media: 'movie',  title: 'Monsters, Inc.',    label: "Sulley's fur",                poster: 'https://image.tmdb.org/t/p/w500/wFSpyMsp7H0ttERbxY7Trlv8xry.jpg', mask: '/game-masks/monsters.png', hex: '#278BA0' },
  { id: 'stranger', media: 'series', title: 'Stranger Things',   label: 'the STRANGER THINGS logo',    poster: 'https://image.tmdb.org/t/p/w500/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg', mask: '/game-masks/stranger.png', hex: '#C63032' },
]

// NOTE: a puzzle without a mask tints the WHOLE poster, which makes the question
// ambiguous ("which of the five yellows?"). So a mask is now mandatory — never
// add a puzzle here without one.

export const ROUNDS_PER_GAME = 3

// Same seeded PRNG as the rest of the app — both players get the same rounds.
function seededRandom(seed) {
  let h = 0x9E3779B9
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 0x9E3779B9)
    h ^= h >>> 15
  }
  let t = (h >>> 0) + 0x6D2B79F5
  return function () {
    t = (t + 0x6D2B79F5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function puzzlesForRoom(roomId) {
  const rng = roomId ? seededRandom(roomId) : Math.random
  const arr = [...COLOR_PUZZLES]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, ROUNDS_PER_GAME)
}

// ── Colour math ───────────────────────────────────────────────────────────────

export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()
}

export function hslToHex(h, s, l) {
  s /= 100; l /= 100
  const k = n => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255)
}

// sRGB → CIELAB (D65), for perceptual colour distance.
function rgbToLab(r, g, b) {
  const lin = v => { v /= 255; return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92 }
  const [R, G, B] = [lin(r), lin(g), lin(b)]
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047
  let y = (R * 0.2126 + G * 0.7152 + B * 0.0722)
  let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116
  ;[x, y, z] = [f(x), f(y), f(z)]
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}

// Perceptual distance (CIE76 ΔE) between two hex colours.
export function deltaE(hexA, hexB) {
  const [L1, a1, b1] = rgbToLab(...hexToRgb(hexA))
  const [L2, a2, b2] = rgbToLab(...hexToRgb(hexB))
  return Math.sqrt((L1 - L2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2)
}

// ΔE → 0–100 score. ΔE < 2.3 is a "just noticeable difference" → basically 100;
// ΔE 60+ is a completely different colour → 0.
//
// Lightness is down-weighted: the picker colourises the poster via
// mix-blend-mode "color", which keeps the image's own luminosity — so what the
// player actually judges by eye is hue + chroma (a/b), not L. Scoring must
// match what they can see.
export function scoreGuess(guessHex, targetHex) {
  const [L1, a1, b1] = rgbToLab(...hexToRgb(guessHex))
  const [L2, a2, b2] = rgbToLab(...hexToRgb(targetHex))
  const dE = Math.sqrt((0.35 * (L1 - L2)) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2)
  return Math.max(0, Math.min(100, Math.round(100 - dE * (100 / 60))))
}

export function scoreVerdict(score) {
  if (score >= 95) return { emoji: '🎯', text: 'Perfect eye!' }
  if (score >= 85) return { emoji: '🔥', text: 'So close!' }
  if (score >= 70) return { emoji: '👏', text: 'Pretty good' }
  if (score >= 50) return { emoji: '🙂', text: 'In the ballpark' }
  if (score >= 25) return { emoji: '😅', text: 'Not quite…' }
  return { emoji: '🙈', text: 'Way off!' }
}

// ── Duel guess encoding ───────────────────────────────────────────────────────
// Duel guesses ride on the existing rooms+swipes infrastructure: a guess is
// stored as a right-swipe whose item_id encodes (round, 24-bit colour). The
// range starts at 100M so it can never collide with the DONE sentinels
// (1999 / 2999 / 9999999) or any real deck item id.
const GUESS_BASE = 100000000
const GUESS_STRIDE = 20000000  // > 0xFFFFFF, one band per round

export function encodeGuess(round, hex) {
  return GUESS_BASE + round * GUESS_STRIDE + parseInt(hex.replace('#', ''), 16)
}

export function decodeGuess(itemId) {
  const n = Number(itemId)
  if (!Number.isFinite(n) || n < GUESS_BASE) return null
  const rel = n - GUESS_BASE
  const round = Math.floor(rel / GUESS_STRIDE)
  const colour = rel % GUESS_STRIDE
  if (colour > 0xFFFFFF || round >= ROUNDS_PER_GAME) return null
  return { round, hex: '#' + colour.toString(16).padStart(6, '0').toUpperCase() }
}
