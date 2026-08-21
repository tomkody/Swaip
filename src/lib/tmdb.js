import { MOVIES } from './movies'
import { MOVIE_PLATFORMS } from './platforms'
import { MOVIE_GENRES } from './movieGenres'
import { supabase } from './supabase'

// Static fallback catalog (used offline / when Supabase or the catalog is empty).
// platforms is attached so "Where to watch" still works in fallback mode.
const MOVIES_WITH_GENRES = MOVIES.map(m => ({
  ...m,
  genre: MOVIE_GENRES[m.id] || '',
  platforms: MOVIE_PLATFORMS[m.id] || [],
}))

// Regions the nightly refresh job populates (see api/refresh-movies.js).
const CATALOG_REGIONS = ['CZ', 'US', 'GB', 'DE']

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

function shuffleSeeded(arr, roomId) {
  const out = [...arr]
  const rng = roomId ? seededRandom(roomId) : Math.random
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// Filter a movie pool by selected platforms + genres, never stranding the user:
// if a filter empties the pool, that filter is dropped rather than showing nothing.
function filterPool(all, platforms, genres) {
  let pool = platforms.length === 0
    ? [...all]
    : all.filter(m => m.platforms && m.platforms.some(p => platforms.includes(p)))
  if (pool.length === 0) pool = [...all]

  if (genres.length > 0) {
    const filtered = pool.filter(m => m.genre && genres.some(g => m.genre.includes(g)))
    if (filtered.length > 0) pool = filtered
  }
  return pool
}

function fetchStaticMovies(roomId, platforms, genres) {
  const pool = filterPool(MOVIES_WITH_GENRES, platforms, genres)
  return shuffleSeeded(pool, roomId).slice(0, 50)
}

// Map a movie_catalog row → the shape SwipeCard/MatchModal expect.
function rowToMovie(r) {
  return {
    id: r.tmdb_id,
    title: r.title,
    poster: r.poster_url,
    rating: r.rating != null ? String(r.rating) : null,
    year: r.year || '',
    runtime: r.runtime || '',
    genre: (r.genres || []).join(' · '),
    overview: r.overview || '',
    platforms: r.platforms || [],
  }
}

// Viewer's country (ISO-3166 alpha-2) from the browser locale, e.g. "cs-CZ" → "CZ".
function detectRegion() {
  const locale = (typeof navigator !== 'undefined' && navigator.language) || 'en-US'
  return (locale.split('-')[1] || 'US').toUpperCase()
}

async function loadCatalog(region) {
  const { data, error } = await supabase
    .from('movie_catalog')
    .select('*')
    .eq('region', region)
  if (error || !data || data.length === 0) return null
  return data
}

// Region-accurate catalog from Supabase, populated nightly from TMDB.
// Falls back to US, then the bundled static list, so it can never render empty.
export async function fetchTopRatedMovies(roomId, platforms = [], genres = []) {
  if (!supabase) return fetchStaticMovies(roomId, platforms, genres)
  try {
    const region = detectRegion()
    let rows = await loadCatalog(CATALOG_REGIONS.includes(region) ? region : 'US')
    if (!rows && region !== 'US') rows = await loadCatalog('US')
    if (!rows) return fetchStaticMovies(roomId, platforms, genres)

    const pool = filterPool(rows.map(rowToMovie), platforms, genres)
    return shuffleSeeded(pool, roomId).slice(0, 50)
  } catch (e) {
    console.error('[tmdb] catalog read failed, using static list:', e)
    return fetchStaticMovies(roomId, platforms, genres)
  }
}
