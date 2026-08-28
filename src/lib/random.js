// Mulberry32 — reliable 32-bit seeded PRNG (Math.imul based). One shared copy;
// this used to be pasted into six files, which is how implementations drift.
export function seededRandom(seed) {
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

// Fisher-Yates with an optional seed. With the same seed (e.g. the room id)
// every player shuffles an identical list into an identical order — that's what
// keeps both partners on the same deck.
export function seededShuffle(arr, seed) {
  const out = [...arr]
  const rng = seed ? seededRandom(seed) : Math.random
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
