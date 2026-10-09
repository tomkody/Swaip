import { MOVIE_PLATFORMS } from './platforms'
import { MOVIE_GENRES } from './movieGenres'
import { normalizeGenres, matchesGenres } from './genres'
import { supabase } from './supabase'
import { CATALOG_REGIONS, detectRegion } from './regions'
import { catalogDay } from './catalogDay'
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

// One region of a catalog table, all of it. First from the CDN copy
// (api/catalog.js): the direct read was about half a megabyte of Supabase
// egress per player, most of the Free plan's 5 GB. `day` names the copy (the
// room pins it), so both partners get the same rows. The direct read stays as
// the fallback: PostgREST ends a plain read at 1000 rows without saying so -
// `.limit(2000)` doesn't lift that - and the US movie catalog is past 800.
// Ordered by id so both partners fetch identical rows.
export async function readCatalogRegion(table, region, day = catalogDay()) {
  try {
    const kind = table === 'series_catalog' ? 'series' : 'movies'
    const r = await fetch(`/api/catalog?kind=${kind}&region=${encodeURIComponent(region)}&d=${encodeURIComponent(day)}`)
    if (r.ok) {
      const rows = await r.json()
      if (Array.isArray(rows)) return { data: rows, error: null }
    }
  } catch { /* no endpoint (local dev) or offline: read directly */ }
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

async function loadCatalog(region, day) {
  // One failed read used to drop this player onto the static list while their
  // partner stayed on the catalog — two different decks, no real matches. A
  // blip is worth retrying before accepting that.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 400))
    const { data, error } = await readCatalogRegion('movie_catalog', region, day)
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
async function loadStreamable(region, day) {
  const rows = await loadCatalog(region, day)
  const streamable = rows ? rows.map(rowToMovie).filter(m => m.platforms.length > 0) : []
  return streamable.length ? streamable : null
}

// The full streamable pool for a region (catalog → US catalog → static list).
// Cached per region and catalog day for the session: the create page starts
// the read while people pick options, and the room reuses it without a second
// fetch. `day` is the room's pinned catalog day (today's on the create page).
const poolCache = new Map()
export async function loadMoviePool(region, day = catalogDay()) {
  const reg = region || detectRegion()
  const regionKey = CATALOG_REGIONS.includes(reg) ? reg : 'US'
  const key = `${regionKey}:${day}`
  if (poolCache.has(key)) return poolCache.get(key)
  let fellBack = false
  const promise = (async () => {
    if (!supabase) return loadStaticMovies()
    try {
      let streamable = await loadStreamable(regionKey, day)
      if (!streamable && regionKey !== 'US') streamable = await loadStreamable('US', day)
      if (streamable) return streamable
    } catch (e) {
      console.error('[tmdb] catalog read failed, using static list:', e)
    }
    fellBack = true
    return loadStaticMovies()
  })()
  poolCache.set(key, promise)
  // Keep only a catalog that loaded. A failed early read (the create page now
  // starts it) must not pin this tab to the static list while the partner's
  // phone reads the catalog: two different decks, no matches.
  const evict = () => { if (poolCache.get(key) === promise) poolCache.delete(key) }
  promise.then(() => { if (fellBack) evict() }, evict)
  return promise
}

// Hard filters (platforms, genres) narrow the pool; `prefs` (length, era)
// only reorder it — see movieFilters.js.
export function filterMoviePool(all, platforms = [], genres = []) {
  return filterPool(all, platforms, genres)
}

export async function fetchTopRatedMovies(roomId, platforms = [], genres = [], region, prefs, day) {
  // Prefer the room's pinned region and catalog day so both partners swipe the SAME deck.
  try {
    const pool = filterPool(await loadMoviePool(region, day || undefined), platforms, genres)
    return buildDeck(pool, roomId, { prefer: prefsPredicate(prefs) })
  } catch (e) {
    console.error('[tmdb] pool load failed, using static list:', e)
    return fetchStaticMovies(roomId, platforms, genres, prefs)
  }
}
