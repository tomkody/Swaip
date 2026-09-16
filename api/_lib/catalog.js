// Shared TMDB → catalog logic. Used by scripts/refresh-movies.mjs (local) and
// api/refresh-movies.js / api/refresh-series.js (Vercel cron). Files under
// api/_lib are not routes.
import { categorize, GENRE_DISCOVERY } from './genres.js'

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

const sleep = ms => new Promise(r => setTimeout(r, ms))

// TMDB starts answering 429 at roughly 45 requests a second (measured
// 2026-09-16: 40 calls in flight drew 67 of them over 850 requests). A 429 used
// to throw like any other error, and the title silently fell out of the
// catalog. Rate limits and server hiccups are now waited out and retried.
async function tmdb(path, token, params = {}) {
  const url = new URL(TMDB + path)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    })
    if (res.ok) return res.json()
    const limited = res.status === 429
    if (!(limited ? attempt < 4 : res.status >= 500 && attempt < 1)) {
      throw new Error(`TMDB ${path} -> ${res.status}`)
    }
    const after = Number(res.headers?.get?.('retry-after'))
    await sleep(after > 0 ? Math.min(after, 3) * 1000 : 300 * 2 ** attempt)
  }
}

// `fn` over `items` with at most `limit` in flight, results in input order.
// Replaces fixed batches, which held every batch back to its slowest call.
async function mapPool(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

const DAY = 24 * 60 * 60 * 1000
const isoDaysAgo = days => new Date(Date.now() - days * DAY).toISOString().slice(0, 10)

// Run a list of /discover queries ({ path, params, pages }) and return the ids
// in query order. Every query's first page goes out together, then the pages
// that exist beyond it - one query's 16 pages used to be fetched one by one.
// A query that fails contributes nothing rather than failing the run.
async function discoverAll(token, queries, concurrency) {
  const fetchPage = (q, page) =>
    tmdb(q.path, token, { ...q.params, include_adult: 'false', language: 'en-US', page })
      .catch(() => ({ results: [], total_pages: 0 }))

  const first = await mapPool(queries, concurrency, q => fetchPage(q, 1))
  const rest = queries.flatMap((q, qi) => {
    const last = Math.min(q.pages, first[qi].total_pages || 0)
    return Array.from({ length: Math.max(0, last - 1) }, (_, i) => ({ q, qi, page: i + 2 }))
  })
  const later = await mapPool(rest, concurrency, t => fetchPage(t.q, t.page))

  const pages = queries.map((_, qi) => [first[qi]])
  rest.forEach((t, i) => { pages[t.qi][t.page - 1] = later[i] })
  return pages.flatMap(list => list.flatMap(d => (d?.results || []).map(m => m.id)))
}

// One detail call per title, with every country's providers and the keywords
// categorize() reads, in the same response. Past `deadline` the remaining calls
// are skipped instead of made: Vercel kills the function at 60s, and a run
// killed halfway through its write leaves nothing in the log but a timeout.
// Skipped and failed titles are counted in `stats` - see writeCatalog.
async function fetchDetails(token, kind, ids, { concurrency, deadline, stats }) {
  return mapPool(ids, concurrency, async id => {
    if (deadline && Date.now() > deadline) { stats.skipped = (stats.skipped || 0) + 1; return null }
    try {
      const d = await tmdb(`/${kind}/${id}`, token, { append_to_response: 'watch/providers,keywords', language: 'en-US' })
      return [id, d]
    } catch {
      stats.failed = (stats.failed || 0) + 1
      return null   // skip a failing title rather than aborting the run
    }
  })
}

// The same filter for every platform and genre query: streamable on one of our
// platforms, in the US as the reference region. Providers are resolved per
// region afterwards, so availability stays accurate everywhere.
const PLATFORM_FLATRATE_PROVIDERS = { netflix: 8, disney: 337, max: 1899, prime: 9, apple: 350, paramount: 531 }
const ANY_PLATFORM = Object.values(PLATFORM_FLATRATE_PROVIDERS).join('|')

// Pull each genre's own popular titles, so a genre chip has a deck behind it.
// See GENRE_DISCOVERY in genres.js.
function genreQueries(kind, { pages, minVotes }) {
  return Object.values(GENRE_DISCOVERY[kind]).map(params => ({
    path: `/discover/${kind}`,
    pages,
    params: {
      ...params,
      sort_by: 'popularity.desc',
      'vote_count.gte': minVotes,
      with_watch_providers: ANY_PLATFORM,
      watch_monetization_types: 'flatrate',
      watch_region: 'US',
    },
  }))
}

// Keywords come back as `keywords.keywords` for movies, `keywords.results` for TV.
const keywordNames = detail =>
  (detail.keywords?.keywords || detail.keywords?.results || []).map(k => k.name)

function fmtRuntime(min) {
  if (!min) return ''
  const h = Math.floor(min / 60), m = min % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

// One row per region where the title is actually on one of our platforms. A row
// with an empty platforms array is dead weight: loadStreamable drops it on the
// way in, so it was 39% of the movie table doing nothing but cost write time.
function rowsPerRegion(base, detail, regions) {
  const provByRegion = detail['watch/providers']?.results || {}
  return regions.flatMap(region => {
    const flatrate = provByRegion[region]?.flatrate || []
    const platforms = [...new Set(flatrate.map(providerToPlatform).filter(Boolean))]
    if (platforms.length === 0) return []
    return { ...base, region, platforms }
  })
}

// Map a TMDB detail response (with appended watch/providers) → one row per region.
function detailToRows(id, detail, regions) {
  return rowsPerRegion({
    tmdb_id: id,
    title: detail.title,
    year: (detail.release_date || '').slice(0, 4),
    rating: detail.vote_average ? Number(detail.vote_average.toFixed(1)) : null,
    runtime: fmtRuntime(detail.runtime),
    genres: categorize({
      kind: 'movie',
      genres: (detail.genres || []).map(g => g.name),
      keywords: keywordNames(detail),
      language: detail.original_language,
    }),
    poster_url: detail.poster_path ? `https://image.tmdb.org/t/p/w500${detail.poster_path}` : null,
    overview: detail.overview || '',
    popularity: detail.popularity != null ? Number(Number(detail.popularity).toFixed(2)) : null,
  }, detail, regions)
}

// Build one row per (movie, region). Combines established classics with recent
// popular releases, each platform's own top titles, and each genre's popular
// titles. One /movie/{id} call per title returns full detail AND all-region
// watch providers AND keywords (append_to_response).
export async function buildCatalog({
  token, regions, pages = 12, minVotes = 5000, freshPages = 3, providerPages = 2,
  genrePages = 2, concurrency = 16, providerRegions, deadline, stats = {},
}) {
  const queries = [
    // Established top-rated films: high vote floor + released >=6 months ago,
    // so ratings have settled (keeps out vote-gamed fresh titles).
    { path: '/discover/movie', pages, params: {
      sort_by: 'vote_average.desc',
      'vote_count.gte': minVotes,
      'primary_release_date.lte': isoDaysAgo(180),
    } },
    // Recent popular releases (last ~2 years) with enough votes to be real -
    // this is what surfaces new/trending hits alongside the classics.
    { path: '/discover/movie', pages: freshPages, params: {
      sort_by: 'popularity.desc',
      'vote_count.gte': 300,
      'primary_release_date.gte': isoDaysAgo(730),
      'primary_release_date.lte': isoDaysAgo(0),
    } },
    // Each platform's top titles per region, so thin regional catalogs (e.g.
    // CZ Prime/Apple) get stocked with titles actually streamable there - not
    // just whatever the US top list happens to also carry.
    ...(providerRegions?.length ? providerRegions : ['US']).flatMap(region =>
      Object.values(PLATFORM_FLATRATE_PROVIDERS).map(pid => ({ path: '/discover/movie', pages: providerPages, params: {
        sort_by: 'vote_average.desc',
        'vote_count.gte': 300,
        with_watch_providers: String(pid),
        watch_monetization_types: 'flatrate',
        watch_region: region,
      } }))
    ),
    ...genreQueries('movie', { pages: genrePages, minVotes: 200 }),
  ]

  const ids = [...new Set(await discoverAll(token, queries, concurrency))]
  stats.titles = ids.length
  const details = await fetchDetails(token, 'movie', ids, { concurrency, deadline, stats })
  return details.flatMap(entry => (entry ? detailToRows(entry[0], entry[1], regions) : []))
}

// ─── TV series ────────────────────────────────────────────────────────────────

function fmtSeasons(n) {
  if (!n) return ''
  return n === 1 ? '1 season' : `${n} seasons`
}

// Map a TMDB /tv/{id} detail (with appended watch/providers) → one row per region.
function tvDetailToRows(id, detail, regions) {
  return rowsPerRegion({
    tmdb_id: id,
    title: detail.name,
    year: (detail.first_air_date || '').slice(0, 4),
    rating: detail.vote_average ? Number(detail.vote_average.toFixed(1)) : null,
    runtime: fmtSeasons(detail.number_of_seasons),
    genres: categorize({
      kind: 'tv',
      genres: (detail.genres || []).map(g => g.name),
      keywords: keywordNames(detail),
      language: detail.original_language,
    }),
    poster_url: detail.poster_path ? `https://image.tmdb.org/t/p/w500${detail.poster_path}` : null,
    overview: detail.overview || '',
    popularity: detail.popularity != null ? Number(Number(detail.popularity).toFixed(2)) : null,
  }, detail, regions)
}

// Same shape/strategy as buildCatalog, for TV series.
export async function buildTvCatalog({
  token, regions, pages = 10, minVotes = 1500, freshPages = 3, providerPages = 2,
  genrePages = 2, concurrency = 16, deadline, stats = {},
}) {
  const queries = [
    // Established top-rated shows (first aired >=1 year ago). TV vote counts
    // run much lower than film, so the floor is lower.
    { path: '/discover/tv', pages, params: {
      sort_by: 'vote_average.desc',
      'vote_count.gte': minVotes,
      'first_air_date.lte': isoDaysAgo(365),
    } },
    // Recent popular shows (first aired in the last ~2 years).
    { path: '/discover/tv', pages: freshPages, params: {
      sort_by: 'popularity.desc',
      'vote_count.gte': 300,
      'first_air_date.gte': isoDaysAgo(730),
      'first_air_date.lte': isoDaysAgo(0),
    } },
    // Per platform: sort by popularity (what people actually watch) with a real
    // vote floor, so we get a platform's known shows - not obscure oddities.
    ...Object.values(PLATFORM_FLATRATE_PROVIDERS).map(pid => ({ path: '/discover/tv', pages: providerPages, params: {
      sort_by: 'popularity.desc',
      'vote_count.gte': 300,
      with_watch_providers: String(pid),
      watch_monetization_types: 'flatrate',
      watch_region: 'US',
    } })),
    ...genreQueries('tv', { pages: genrePages, minVotes: 50 }),
  ]

  const ids = [...new Set(await discoverAll(token, queries, concurrency))]
  stats.titles = ids.length
  const details = await fetchDetails(token, 'tv', ids, { concurrency, deadline, stats })
  return details.flatMap(entry => (entry ? tvDetailToRows(entry[0], entry[1], regions) : []))
}
