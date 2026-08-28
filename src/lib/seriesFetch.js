import { SERIES } from './series'
import { SERIES_PLATFORMS } from './platforms'
import { SERIES_GENRES } from './seriesGenres'
import { supabase } from './supabase'
import { CATALOG_REGIONS } from './regions'

// Static fallback catalog (used offline / when Supabase or the catalog is empty).
const SERIES_WITH_GENRES = SERIES.map(s => ({
  ...s,
  genre: SERIES_GENRES[s.id] || '',
  platforms: SERIES_PLATFORMS[s.id] || [],
}))

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

// Filter by selected platforms + genres, never stranding the user: if a filter
// empties the pool, that filter is dropped rather than showing nothing.
function filterPool(all, platforms, genres) {
  let pool = platforms.length === 0
    ? [...all]
    : all.filter(s => s.platforms && s.platforms.some(p => platforms.includes(p)))
  if (pool.length === 0) pool = [...all]

  if (genres.length > 0) {
    const filtered = pool.filter(s => s.genre && genres.some(g => s.genre.includes(g)))
    if (filtered.length > 0) pool = filtered
  }
  return pool
}

function fetchStaticSeries(roomId, platforms, genres) {
  const pool = filterPool(SERIES_WITH_GENRES, platforms, genres)
  return shuffleSeeded(pool, roomId).slice(0, 50)
}

// Map a series_catalog row → the shape SwipeCard/MatchModal expect.
function rowToSeries(r) {
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

function detectRegion() {
  const locale = (typeof navigator !== 'undefined' && navigator.language) || 'en-US'
  return (locale.split('-')[1] || 'US').toUpperCase()
}

async function loadCatalog(region) {
  const { data, error } = await supabase
    .from('series_catalog')
    .select('*')
    .eq('region', region)
  if (error || !data || data.length === 0) return null
  return data
}

// Region-accurate TV catalog from Supabase, populated nightly from TMDB.
// Falls back to US, then the bundled static list, so it can never render empty.
// Load a region's catalog and keep only shows streamable on a tracked platform.
async function loadStreamable(region) {
  const rows = await loadCatalog(region)
  const streamable = rows ? rows.map(rowToSeries).filter(s => s.platforms.length > 0) : []
  return streamable.length ? streamable : null
}

export async function fetchTopRatedSeries(roomId, platforms = [], genres = [], region) {
  if (!supabase) return fetchStaticSeries(roomId, platforms, genres)
  try {
    // Prefer the room's pinned region so both partners swipe the SAME deck.
    const reg = (region || detectRegion())
    let streamable = await loadStreamable(CATALOG_REGIONS.includes(reg) ? reg : 'US')
    if (!streamable && reg !== 'US') streamable = await loadStreamable('US')
    if (!streamable) return fetchStaticSeries(roomId, platforms, genres)

    const pool = filterPool(streamable, platforms, genres)
    return shuffleSeeded(pool, roomId).slice(0, 50)
  } catch (e) {
    console.error('[seriesFetch] catalog read failed, using static list:', e)
    return fetchStaticSeries(roomId, platforms, genres)
  }
}
