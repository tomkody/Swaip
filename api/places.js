// Server-side proxy for Google Places (New) + Geocoding.
//
// Why: the browser must never carry the Maps API key — a key shipped in the
// bundle can be lifted and billed against by anyone. This function holds the
// key server-side (GOOGLE_MAPS_API_KEY, falling back to the existing
// VITE_GOOGLE_MAPS_API_KEY so no new env var is required) and the client calls
// /api/places?op=… instead of Google directly.
//
// Everything is GET so Vercel's edge cache can serve identical lookups for free
// (Cache-Control s-maxage below) — repeat searches in the same area cost nothing.

import { createClient } from '@supabase/supabase-js'

const BASE = 'https://places.googleapis.com/v1'

// ── Nearby-search cache ───────────────────────────────────────────────────────
// Identical searches (same rounded coords + radius + types + language) are
// answered from Supabase for 3h instead of paying Google again. Coordinates
// are already coarsened to ~110m client-side, so nearby rooms in the same area
// share entries. Fails open: without the table (see supabase/places_cache.sql)
// or the service key, every lookup just goes to Google as before.
const CACHE_TTL_MS = 3 * 60 * 60 * 1000   // 3h: open/closed info must stay reasonably fresh
let cacheDead = false

function cacheClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (cacheDead || !url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

async function cacheGet(key) {
  const sb = cacheClient()
  if (!sb) return null
  try {
    const { data, error } = await sb
      .from('places_cache').select('payload, created_at').eq('cache_key', key).maybeSingle()
    if (error) { if (error.code === 'PGRST205') cacheDead = true; return null }
    if (!data) return null
    if (Date.now() - new Date(data.created_at).getTime() > CACHE_TTL_MS) return null
    return data.payload
  } catch { return null }
}

async function cachePut(key, payload) {
  const sb = cacheClient()
  if (!sb) return
  try {
    await sb.from('places_cache').upsert(
      { cache_key: key, payload, created_at: new Date().toISOString() },
      { onConflict: 'cache_key' }
    )
  } catch { /* cache is best-effort */ }
}

// ── Daily spend cap ───────────────────────────────────────────────────────────
// Google's own per-day quota for these SKUs is greyed out on this project
// ("Quota is not adjustable"), so the only hard stop we can actually enforce
// lives here. Unlike the per-IP limit this one is shared: it counts in the
// places_cache table, so it survives an instance recycling and every instance
// sees the same number.
//
// Only the two search SKUs are capped — they are the expensive ones. Photos and
// reverse geocoding are an order of magnitude cheaper, and a photo can only be
// requested with a name that came from a search that was already counted.
//
// Tune without a deploy: PLACES_NEARBY_DAILY_MAX / PLACES_GEOCODE_DAILY_MAX.
// Read per call, not at module load: a changed value on Vercel then takes
// effect without waiting for a cold start.
const dailyMax = op => ({
  nearby: Number(process.env.PLACES_NEARBY_DAILY_MAX || 500),
  geocode: Number(process.env.PLACES_GEOCODE_DAILY_MAX || 200),
}[op] || 0)

const usageKey = op => `usage:${op}:${new Date().toISOString().slice(0, 10)}`

// Reserve one paid call against today's budget. Returns false when the budget
// is spent. Counts before calling Google, so a failed call still costs a slot —
// for a safety cap, erring high is the right direction.
//
// Read-then-write, so two simultaneous calls can both read the same number and
// undercount by one. That doesn't matter for a cap whose job is to stop a
// runaway, and avoiding it would mean a database function to install.
async function reserveDailyCall(op) {
  const max = dailyMax(op)
  if (!max) return true
  const sb = cacheClient()
  if (!sb) return true              // no counter available — the per-IP limit still applies
  try {
    const key = usageKey(op)
    const { data, error } = await sb
      .from('places_cache').select('payload').eq('cache_key', key).maybeSingle()
    if (error) { if (error.code === 'PGRST205') cacheDead = true; return true }
    const used = Number(data?.payload?.n || 0)
    if (used >= max) return false
    await sb.from('places_cache').upsert(
      { cache_key: key, payload: { n: used + 1 }, created_at: new Date().toISOString() },
      { onConflict: 'cache_key' }
    )
    return true
  } catch {
    return true                     // never let the meter take the feature down
  }
}

const NEARBY_MASK = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.rating',
  'places.userRatingCount', 'places.photos', 'places.editorialSummary', 'places.types',
  'places.location', 'places.currentOpeningHours', 'places.priceLevel', 'places.primaryType',
].join(',')

function key() {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || ''
}

// This proxy spends our Google budget, so only serve our own pages. Same-origin
// fetches carry a Referer (Referrer-Policy is strict-origin-when-cross-origin),
// cross-origin ones an Origin; a bare script carries neither. Spoofable, but it
// turns away the casual drive-by — the hard cap lives in the Google quota.
const ALLOWED_SITES = [
  'https://swaip.app', 'https://www.swaip.app',
  'http://localhost:5173', 'http://127.0.0.1:5173',
  process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
  process.env.VERCEL_BRANCH_URL && `https://${process.env.VERCEL_BRANCH_URL}`,
].filter(Boolean)

function fromOurSite(req) {
  const src = String(req.headers?.origin || req.headers?.referer || '')
  return ALLOWED_SITES.some(site => src === site || src.startsWith(site + '/'))
}

// ── Per-IP rate limit ─────────────────────────────────────────────────────────
// The referer check turns away a bare script, but anything that sets a Referer
// could still loop this endpoint and spend the Google budget. Only the ops that
// actually cost money are limited; cached hits are counted too, since the point
// is to cap abuse rather than to meter spend exactly. In-memory, so it resets
// when a serverless instance recycles and doesn't see other instances — it
// blunts a burst from one client, it is not the hard cap. That one belongs in
// the Google Cloud console as a daily quota.
const PAID_OPS = new Set(['nearby', 'geocode', 'revgeo', 'photo'])
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 60             // per IP per minute, across all paid ops
const hits = new Map()

function overRateLimit(req, op) {
  if (!PAID_OPS.has(op)) return false
  const ip = String(
    req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'] || 'unknown'
  ).split(',')[0].trim()
  const now = Date.now()
  const seen = hits.get(ip)
  if (!seen || now - seen.start > RATE_WINDOW_MS) {
    hits.set(ip, { start: now, n: 1 })
    // Opportunistic cleanup so one instance can't grow the map without bound.
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (now - v.start > RATE_WINDOW_MS) hits.delete(k)
    }
    return false
  }
  seen.n++
  return seen.n > RATE_MAX
}

function send(res, status, cacheSeconds, payload) {
  if (cacheSeconds && status === 200) {
    res.setHeader('Cache-Control', `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`)
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.status(status).json(payload)
}

export default async function handler(req, res) {
  const API_KEY = key()
  if (!API_KEY) return send(res, 500, 0, { error: 'Maps key not configured on the server' })
  if (!fromOurSite(req)) return send(res, 403, 0, { error: 'forbidden' })

  const q = req.query || {}
  const op = q.op
  const lang = (q.lang || 'en').toString().slice(0, 5)
  if (overRateLimit(req, op)) {
    res.setHeader('Retry-After', '60')
    return send(res, 429, 0, { error: 'too many requests' })
  }

  try {
    // ── Nearby search (POST to Google, GET from the client so it edge-caches) ──
    if (op === 'nearby') {
      const lat = Number(q.lat), lng = Number(q.lng), radius = Number(q.radius) || 5000
      const types = (q.types || '').toString().split(',').filter(Boolean)
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || types.length === 0) {
        return send(res, 400, 0, { error: 'nearby needs lat, lng and types' })
      }
      // Durable cache first (3h) — the edge cache only lasts minutes.
      const cacheKey = `nearby:${lat.toFixed(3)}:${lng.toFixed(3)}:${radius}:${[...types].sort().join('+')}:${lang}`
      const cached = await cacheGet(cacheKey)
      if (cached) return send(res, 200, 900, cached)
      if (!(await reserveDailyCall('nearby'))) {
        res.setHeader('Retry-After', '3600')
        return send(res, 429, 0, { error: "Today's place searches are used up. Try again tomorrow." })
      }
      const r = await fetch(`${BASE}/places:searchNearby`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': NEARBY_MASK,
        },
        body: JSON.stringify({
          includedTypes: types,
          maxResultCount: 20,
          languageCode: lang,
          locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius } },
        }),
      })
      const data = await r.json().catch(() => ({}))
      if (r.ok) await cachePut(cacheKey, data)   // awaited: serverless may kill post-response work
      // 15 min: fresh enough for open/closed, still collapses repeat searches.
      return send(res, r.ok ? 200 : r.status, 900, data)
    }

    // ── Text search → geocode a city/address (city coords are stable) ──
    if (op === 'geocode') {
      const query = (q.q || '').toString()
      if (!query) return send(res, 400, 0, { error: 'geocode needs q' })
      if (!(await reserveDailyCall('geocode'))) {
        res.setHeader('Retry-After', '3600')
        return send(res, 429, 0, { error: "Today's location lookups are used up. Try again tomorrow." })
      }
      const r = await fetch(`${BASE}/places:searchText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.location',
        },
        body: JSON.stringify({ textQuery: query, languageCode: lang }),
      })
      const data = await r.json().catch(() => ({}))
      return send(res, r.ok ? 200 : r.status, 604800, data) // 1 week
    }

    // ── Reverse geocode (coords → area name + country) ──
    if (op === 'revgeo') {
      const lat = Number(q.lat), lng = Number(q.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return send(res, 400, 0, { error: 'revgeo needs lat, lng' })
      const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=${lang}&key=${API_KEY}`)
      const data = await r.json().catch(() => ({}))
      return send(res, r.ok ? 200 : r.status, 86400, data) // 1 day
    }

    // ── Photo → resolve to the keyless googleusercontent URL, then redirect ──
    if (op === 'photo') {
      const name = (q.name || '').toString()
      const w = Math.min(1600, Number(q.w) || 600)
      if (!name.startsWith('places/')) return send(res, 400, 0, { error: 'photo needs a valid name' })
      const r = await fetch(`${BASE}/${name}/media?maxWidthPx=${w}&skipHttpRedirect=true&key=${API_KEY}`)
      const data = await r.json().catch(() => ({}))
      if (r.ok && data.photoUri) {
        res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=1209600')
        res.setHeader('Location', data.photoUri)
        return res.status(302).end()
      }
      return send(res, r.status || 502, 0, data)
    }

    return send(res, 400, 0, { error: 'unknown op' })
  } catch (e) {
    return send(res, 502, 0, { error: String(e?.message || e) })
  }
}
