import { MOVIES } from './movies'

// Simple seeded random number generator
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

export function fetchTopRatedMovies(roomId) {
  const shuffled = [...MOVIES]
  const rng = roomId ? seededRandom(roomId) : Math.random
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, 50)
}
