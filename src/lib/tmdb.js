import { MOVIES } from './movies'
import { MOVIE_PLATFORMS } from './platforms'
import { MOVIE_GENRES } from './movieGenres'

const MOVIES_WITH_GENRES = MOVIES.map(m => ({ ...m, genre: MOVIE_GENRES[m.id] || '' }))

function seededRandom(seed) {
  let s = 0
  for (let i = 0; i < seed.length; i++) {
    s = ((s << 5) - s + seed.charCodeAt(i)) | 0
  }
  return function () {
    s = (s * 1664525 + 1013904223) | 0
    return ((s >>> 0) / 0xffffffff)
  }
}

export function fetchTopRatedMovies(roomId, platforms = []) {
  const pool = platforms.length === 0
    ? [...MOVIES_WITH_GENRES]
    : MOVIES_WITH_GENRES.filter(m => {
        const mp = MOVIE_PLATFORMS[m.id]
        return mp && mp.some(p => platforms.includes(p))
      })

  const source = pool.length >= 10 ? pool : [...MOVIES_WITH_GENRES] // fallback if too few
  const shuffled = [...source]
  const rng = roomId ? seededRandom(roomId) : Math.random
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, 50)
}
