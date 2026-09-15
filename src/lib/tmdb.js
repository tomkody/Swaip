import { MOVIE_PLATFORMS } from './platforms'
import { MOVIE_GENRES } from './movieGenres'
import { supabase } from './supabase'
import { CATALOG_REGIONS, detectRegion } from './regions'
import { buildDeck } from './deck'
import { prefsPredicate } from './movieFilters'

export { detectRegion }

// Static fallback catalog (used offline / when Supabase or the catalog is empty).
// platforms is attached so "Where to watch" still works in fallback mode.

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

// Loaded on demand — the static list is a fallback, not a dependency.
async function loadStaticMovies() {
  const { MOVIES } = await import('./movies')
  return MOVIES.map(m => ({ ...m, genre: MOVIE_GENRES[m.id] || '', platforms: MOVIE_PLATFORMS[m.id] || [] }))
}

async function fetchStaticMovies(roomId, platforms, genres, prefs) {
  const pool = filterPool(await loadStaticMovies(), platforms, genres)
  return buildDeck(pool, roomId, { prefer: prefsPredicate(prefs) })
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
    popularity: r.popularity ?? null,
  }
}

async function loadCatalog(region) {
  const { data, error } = await supabase
    .from('movie_catalog')
    .select('*')
    .eq('region', region)
    .order('tmdb_id')   // deterministic set — both partners must fetch identical rows
    .limit(2000)        // explicit; the default 1000-row cap would truncate silently
  if (error || !data || data.length === 0) return null
  return data
}

// Region-accurate catalog from Supabase, populated nightly from TMDB.
// Falls back to US, then the bundled static list, so it can never render empty.
// Load a region's catalog and keep only titles actually streamable on one of
// our tracked platforms — we tell users they'll find it on one of them, so we
// don't surface titles that aren't on any. Returns null if none.
async function loadStreamable(region) {
  const rows = await loadCatalog(region)
  const streamable = rows ? rows.map(rowToMovie).filter(m => m.platforms.length > 0) : []
  return streamable.length ? streamable : null
}

// The full streamable pool for a region (catalog → US catalog → static list).
// Cached per region for the session: the create page loads it for the live
// "N titles" count and the room reuses it seconds later without a second fetch.
const poolCache = new Map()
export async function loadMoviePool(region) {
  const reg = region || detectRegion()
  const key = CATALOG_REGIONS.includes(reg) ? reg : 'US'
  if (poolCache.has(key)) return poolCache.get(key)
  const promise = (async () => {
    if (!supabase) return loadStaticMovies()
    try {
      let streamable = await loadStreamable(key)
      if (!streamable && key !== 'US') streamable = await loadStreamable('US')
      return streamable || loadStaticMovies()
    } catch (e) {
      console.error('[tmdb] catalog read failed, using static list:', e)
      return loadStaticMovies()
    }
  })()
  poolCache.set(key, promise)
  promise.catch(() => poolCache.delete(key))
  return promise
}

// Hard filters (platforms, genres) narrow the pool; `prefs` (length, era)
// only reorder it — see movieFilters.js.
export function filterMoviePool(all, platforms = [], genres = []) {
  return filterPool(all, platforms, genres)
}

export async function fetchTopRatedMovies(roomId, platforms = [], genres = [], region, prefs) {
  // Prefer the room's pinned region so both partners swipe the SAME deck.
  try {
    const pool = filterPool(await loadMoviePool(region), platforms, genres)
    return buildDeck(pool, roomId, { prefer: prefsPredicate(prefs) })
  } catch (e) {
    console.error('[tmdb] pool load failed, using static list:', e)
    return fetchStaticMovies(roomId, platforms, genres, prefs)
  }
}
