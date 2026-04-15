import { MOVIES } from './movies'
import { MOVIE_PLATFORMS } from './platforms'
import { MOVIE_GENRES } from './movieGenres'

const MOVIES_WITH_GENRES = MOVIES.map(m => ({ ...m, genre: MOVIE_GENRES[m.id] || '' }))

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

export function fetchTopRatedMovies(roomId, platforms = [], genres = []) {
  let pool = platforms.length === 0
    ? [...MOVIES_WITH_GENRES]
    : MOVIES_WITH_GENRES.filter(m => {
        const mp = MOVIE_PLATFORMS[m.id]
        return mp && mp.some(p => platforms.includes(p))
      })

  if (genres.length > 0) {
    const filtered = pool.filter(m => m.genre && genres.some(g => m.genre.includes(g)))
    if (filtered.length > 0) pool = filtered
  }

  const source = pool.length > 0 ? pool : [...MOVIES_WITH_GENRES] // fallback only if completely empty
  const shuffled = [...source]
  const rng = roomId ? seededRandom(roomId) : Math.random
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, 50)
}
