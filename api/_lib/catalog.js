// Shared TMDB → catalog logic. Used by scripts/refresh-movies.mjs (local) and
// api/refresh-movies.js (Vercel cron). Files under api/_lib are not routes.

const TMDB = 'https://api.themoviedb.org/3'

// TMDB provider id → our platform id. Ids are stable; the name fallback below
// covers rebrands (HBO Max ↔ Max) and regional provider variants.
const PROVIDER_IDS = {
  8: 'netflix',
  337: 'disney',
  9: 'prime', 119: 'prime', 10: 'prime',
  350: 'apple', 2: 'apple',
  1899: 'max', 384: 'max',
  531: 'paramount',
}

// Align TMDB genre names with the app's genre-chip vocabulary (CreateMovieRoom
// GENRE_OPTIONS) so genre filtering and card labels match exactly.
const GENRE_ALIASES = { 'Science Fiction': 'Sci-Fi', 'Music': 'Musical' }
function normalizeGenre(name) {
  return GENRE_ALIASES[name] || name
}

function providerToPlatform(p) {
  if (PROVIDER_IDS[p.provider_id]) return PROVIDER_IDS[p.provider_id]
  const n = (p.provider_name || '').toLowerCase()
  if (n.includes('netflix')) return 'netflix'
  if (n.includes('disney')) return 'disney'
  if (n.includes('hbo') || n === 'max' || n.startsWith('max ')) return 'max'
  if (n.includes('prime') || n.includes('amazon')) return 'prime'
  if (n.includes('apple tv+') || n.includes('apple tv plus')) return 'apple'
  if (n.includes('paramount')) return 'paramount'
  return null
}

async function tmdb(path, token, params = {}) {
  const url = new URL(TMDB + path)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`TMDB ${path} -> ${res.status}`)
  return res.json()
}

const DAY = 24 * 60 * 60 * 1000
const isoDaysAgo = days => new Date(Date.now() - days * DAY).toISOString().slice(0, 10)

// Page through a /discover/movie query, collecting ids.
async function discoverPages(token, params, pages) {
  const ids = []
  for (let page = 1; page <= pages; page++) {
    const d = await tmdb('/discover/movie', token, { ...params, include_adult: 'false', language: 'en-US', page })
    for (const m of d.results) ids.push(m.id)
    if (page >= d.total_pages) break
  }
  return ids
}

// Established top-rated films: high vote floor + released >=6 months ago, so
// ratings have settled (keeps out vote-gamed fresh titles).
function discoverTopRated(token, { pages, minVotes }) {
  return discoverPages(token, {
    sort_by: 'vote_average.desc',
    'vote_count.gte': minVotes,
    'primary_release_date.lte': isoDaysAgo(180),
  }, pages)
}

// Recent popular releases (last ~2 years) with enough votes to be real — this
// is what surfaces new/trending hits alongside the classics.
function discoverFresh(token, { pages }) {
  return discoverPages(token, {
    sort_by: 'popularity.desc',
    'vote_count.gte': 300,
    'primary_release_date.gte': isoDaysAgo(730),
    'primary_release_date.lte': isoDaysAgo(0),
  }, pages)
}

// TMDB flatrate provider ids for our platforms. Pulling each platform's own top
// titles guarantees thin catalogs (e.g. Apple TV+, ~58 titles) are well
// represented rather than relying on them showing up in the global top lists.
// Uses US as a reference region; providers are still resolved per-region later,
// so availability stays accurate everywhere.
const PLATFORM_FLATRATE_PROVIDERS = { netflix: 8, disney: 337, max: 1899, prime: 9, apple: 350, paramount: 531 }

function discoverByProvider(token, providerId, { pages, region = 'US' }) {
  return discoverPages(token, {
    sort_by: 'vote_average.desc',
    'vote_count.gte': 300,
    with_watch_providers: String(providerId),
    watch_monetization_types: 'flatrate',
    watch_region: region,
  }, pages)
}

function fmtRuntime(min) {
  if (!min) return ''
  const h = Math.floor(min / 60), m = min % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

// Map a TMDB detail response (with appended watch/providers) → one row per region.
function detailToRows(id, detail, regions) {
  const base = {
    tmdb_id: id,
    title: detail.title,
    year: (detail.release_date || '').slice(0, 4),
    rating: detail.vote_average ? Number(detail.vote_average.toFixed(1)) : null,
    runtime: fmtRuntime(detail.runtime),
    genres: (detail.genres || []).map(g => normalizeGenre(g.name)),
    poster_url: detail.poster_path ? `https://image.tmdb.org/t/p/w500${detail.poster_path}` : null,
    overview: detail.overview || '',
  }
  const provByRegion = detail['watch/providers']?.results || {}
  return regions.map(region => {
    const flatrate = provByRegion[region]?.flatrate || []
    const platforms = [...new Set(flatrate.map(providerToPlatform).filter(Boolean))]
    return { ...base, region, platforms }
  })
}

// Build one row per (movie, region). Combines established classics with recent
// popular releases. One /movie/{id} call per movie returns full detail AND
// all-region watch providers (append_to_response); those calls run in parallel
// batches so a larger catalog still finishes well within the function timeout.
export async function buildCatalog({ token, regions, pages = 12, minVotes = 5000, freshPages = 3, providerPages = 2, concurrency = 16 }) {
  const [classics, fresh, ...byProvider] = await Promise.all([
    discoverTopRated(token, { pages, minVotes }),
    discoverFresh(token, { pages: freshPages }),
    ...Object.values(PLATFORM_FLATRATE_PROVIDERS).map(pid =>
      discoverByProvider(token, pid, { pages: providerPages })
    ),
  ])
  const ids = [...new Set([...classics, ...fresh, ...byProvider.flat()])]

  const rows = []
  for (let i = 0; i < ids.length; i += concurrency) {
    const batch = ids.slice(i, i + concurrency)
    const details = await Promise.all(
      batch.map(id =>
        tmdb(`/movie/${id}`, token, { append_to_response: 'watch/providers', language: 'en-US' })
          .then(d => [id, d])
          .catch(() => null)  // skip a failing title rather than aborting the run
      )
    )
    for (const entry of details) {
      if (entry) rows.push(...detailToRows(entry[0], entry[1], regions))
    }
  }
  return rows
}
