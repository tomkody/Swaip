import { SERIES_PLATFORMS } from './platforms'
import { SERIES_GENRES } from './seriesGenres'
import { normalizeGenres, matchesGenres } from './genres'
import { supabase } from './supabase'
import { CATALOG_REGIONS, detectRegion } from './regions'
import { buildDeck } from './deck'

// Static fallback catalog (used offline / when Supabase or the catalog is empty).

// Filter by selected platforms + genres, never stranding the user: if a filter
// empties the pool, that filter is dropped rather than showing nothing.
function filterPool(all, platforms, genres) {
  let pool = platforms.length === 0
    ? [...all]
    : all.filter(s => s.platforms && s.platforms.some(p => platforms.includes(p)))
  if (pool.length === 0) pool = [...all]

  const wanted = normalizeGenres(genres)
  if (wanted.length > 0) {
    const filtered = pool.filter(s => matchesGenres(s.genres, wanted))
    if (filtered.length > 0) pool = filtered
  }
  return pool
}

// The static list is numbered 1..N, which overlaps real TMDB ids. If one player
// fell back to it and the other stayed on the catalog, a "match" showed each of
// them a different show — see STATIC_ID_OFFSET in tmdb.js.
import { STATIC_ID_OFFSET, readCatalogRegion } from './tmdb'

// Loaded on demand — the static list is a fallback, not a dependency.
async function fetchStaticSeries(roomId, platforms, genres) {
  const { SERIES } = await import('./series')
  const all = SERIES.map(s => {
    const genres = normalizeGenres((SERIES_GENRES[s.id] || '').split(' · '))
    return {
      ...s,
      id: s.id + STATIC_ID_OFFSET,
      genres,
      genre: genres.join(' · '),
      platforms: SERIES_PLATFORMS[s.id] || [],
    }
  })
  const pool = filterPool(all, platforms, genres)
  return buildDeck(pool, roomId)
}

// Map a series_catalog row → the shape SwipeCard/MatchModal expect.
function rowToSeries(r) {
  const genres = normalizeGenres(r.genres || [])
  return {
    id: r.tmdb_id,
    title: r.title,
    poster: r.poster_url,
    rating: r.rating != null ? String(r.rating) : null,
    year: r.year || '',
    runtime: r.runtime || '',
    genres,
    genre: genres.join(' · '),
    overview: r.overview || '',
    platforms: r.platforms || [],
    popularity: r.popularity ?? null,
  }
}

async function loadCatalog(region) {
  // A single failed read used to drop this player onto the static list while
  // their partner stayed on the catalog — two different decks. Retry a blip.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 400))
    const { data, error } = await readCatalogRegion('series_catalog', region)
    if (!error && data && data.length > 0) return data
    if (!error) return null           // genuinely empty — retrying won't help
  }
  return null
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
    return buildDeck(pool, roomId)
  } catch (e) {
    console.error('[seriesFetch] catalog read failed, using static list:', e)
    return fetchStaticSeries(roomId, platforms, genres)
  }
}
