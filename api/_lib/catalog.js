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

// Quality-filtered, released, well-voted movie ids (avoids vote-gamed upcoming titles).
async function discoverIds(token, { pages, minVotes }) {
  const today = new Date().toISOString().slice(0, 10)
  const ids = []
  for (let page = 1; page <= pages; page++) {
    const d = await tmdb('/discover/movie', token, {
      sort_by: 'vote_average.desc',
      'vote_count.gte': minVotes,
      'release_date.lte': today,
      include_adult: 'false',
      language: 'en-US',
      page,
    })
    for (const m of d.results) ids.push(m.id)
    if (page >= d.total_pages) break
  }
  return [...new Set(ids)]
}

function fmtRuntime(min) {
  if (!min) return ''
  const h = Math.floor(min / 60), m = min % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

// Build one row per (movie, region). One /movie/{id} call per movie returns
// full detail AND all-region watch providers via append_to_response.
export async function buildCatalog({ token, regions, pages = 3, minVotes = 3000 }) {
  const ids = await discoverIds(token, { pages, minVotes })
  const rows = []

  for (const id of ids) {
    let detail
    try {
      detail = await tmdb(`/movie/${id}`, token, { append_to_response: 'watch/providers', language: 'en-US' })
    } catch {
      continue // skip a title that fails rather than aborting the whole run
    }

    const base = {
      tmdb_id: id,
      title: detail.title,
      year: (detail.release_date || '').slice(0, 4),
      rating: detail.vote_average ? Number(detail.vote_average.toFixed(1)) : null,
      runtime: fmtRuntime(detail.runtime),
      genres: (detail.genres || []).map(g => g.name),
      poster_url: detail.poster_path ? `https://image.tmdb.org/t/p/w500${detail.poster_path}` : null,
      overview: detail.overview || '',
    }

    const provByRegion = detail['watch/providers']?.results || {}
    for (const region of regions) {
      const flatrate = provByRegion[region]?.flatrate || []
      const platforms = [...new Set(flatrate.map(providerToPlatform).filter(Boolean))]
      rows.push({ ...base, region, platforms })
    }
  }
  return rows
}
