import { MOVIE_PLATFORMS } from './platforms'
import { MOVIE_GENRES } from './movieGenres'
import { normalizeGenres, matchesGenres } from './genres'
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

  const wanted = normalizeGenres(genres)
  if (wanted.length > 0) {
    const filtered = pool.filter(m => matchesGenres(m.genres, wanted))
    if (filtered.length > 0) pool = filtered
  }
  return pool
}

// The static list is numbered 1..N, which overlaps real TMDB ids — id 12 is
// "Forrest Gump" here and "Finding Nemo" there. If one player fell back to it
// and the other didn't, a "match" showed each of them a different film. Shifting
// the fallback into its own id range turns that into no match at all, which is
// wrong but honest, and visible.
export const STATIC_ID_OFFSET = 90000000

// Loaded on demand — the static list is a fallback, not a dependency.
async function loadStaticMovies() {
  const { MOVIES } = await import('./movies')
  return MOVIES.map(m => {
    const genres = normalizeGenres((MOVIE_GENRES[m.id] || '').split(' · '))
    return {
      ...m,
      id: m.id + STATIC_ID_OFFSET,
      genres,
      genre: genres.join(' · '),
      platforms: MOVIE_PLATFORMS[m.id] || [],
    }
  })
}

async function fetchStaticMovies(roomId, platforms, genres, prefs) {
  const pool = filterPool(await loadStaticMovies(), platforms, genres)
  return buildDeck(pool, roomId, { prefer: prefsPredicate(prefs) })
}

// Map a movie_catalog row → the shape SwipeCard/MatchModal expect.
function rowToMovie(r) {
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

// One region of a catalog table, all of it. PostgREST ends a plain read at 1000
// rows without saying so - `.limit(2000)` doesn't lift that - and the US movie
// catalog is past 800. Ordered by id so both partners fetch identical rows.
export async function readCatalogRegion(table, region) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table).select('*').eq('region', region)
      .order('tmdb_id').range(from, from + 999)
    if (error) return { data: null, error }
    rows.push(...data)
    if (data.length < 1000) return { data: rows, error: null }
  }
}

async function loadCatalog(region) {
  // One failed read used to drop this player onto the static list while their
  // partner stayed on the catalog — two different decks, no real matches. A
  // blip is worth retrying before accepting that.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 400))
    const { data, error } = await readCatalogRegion('movie_catalog', region)
    if (!error && data && data.length > 0) return data
    if (!error) return null           // genuinely empty — retrying won't help
  }
  return null
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
