import { SERIES } from './series'
import { SERIES_PLATFORMS } from './platforms'
import { SERIES_GENRES } from './seriesGenres'

const SERIES_WITH_GENRES = SERIES.map(s => ({ ...s, genre: SERIES_GENRES[s.id] || '' }))

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

export function fetchTopRatedSeries(roomId, platforms = [], genres = []) {
  let pool = platforms.length === 0
    ? [...SERIES_WITH_GENRES]
    : SERIES_WITH_GENRES.filter(s => {
        const sp = SERIES_PLATFORMS[s.id]
        return sp && sp.some(p => platforms.includes(p))
      })

  if (genres.length > 0) {
    const filtered = pool.filter(s => s.genre && genres.some(g => s.genre.includes(g)))
    if (filtered.length >= 10) pool = filtered
  }

  const source = pool.length >= 10 ? pool : [...SERIES_WITH_GENRES]
  const shuffled = [...source]
  const rng = roomId ? seededRandom(roomId) : Math.random
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, 50)
}
