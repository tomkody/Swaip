import { SERIES } from './series'
import { SERIES_PLATFORMS } from './platforms'
import { SERIES_GENRES } from './seriesGenres'

const SERIES_WITH_GENRES = SERIES.map(s => ({ ...s, genre: SERIES_GENRES[s.id] || '' }))

// Mulberry32 — reliable 32-bit seeded PRNG using Math.imul
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

export function fetchTopRatedSeries(roomId, platforms = [], genres = []) {
  let pool = platforms.length === 0
    ? [...SERIES_WITH_GENRES]
    : SERIES_WITH_GENRES.filter(s => {
        const sp = SERIES_PLATFORMS[s.id]
        return sp && sp.some(p => platforms.includes(p))
      })

  if (genres.length > 0) {
    const filtered = pool.filter(s => s.genre && genres.some(g => s.genre.includes(g)))
    if (filtered.length > 0) pool = filtered
  }

  const source = pool.length > 0 ? pool : [...SERIES_WITH_GENRES]
  const shuffled = [...source]
  const rng = roomId ? seededRandom(roomId) : Math.random
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, 50)
}
