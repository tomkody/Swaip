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

const BASE = 'https://places.googleapis.com/v1'

const NEARBY_MASK = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.rating',
  'places.userRatingCount', 'places.photos', 'places.editorialSummary', 'places.types',
  'places.location', 'places.currentOpeningHours', 'places.priceLevel', 'places.primaryType',
].join(',')

function key() {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || ''
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

  const q = req.query || {}
  const op = q.op
  const lang = (q.lang || 'en').toString().slice(0, 5)

  try {
    // ── Nearby search (POST to Google, GET from the client so it edge-caches) ──
    if (op === 'nearby') {
      const lat = Number(q.lat), lng = Number(q.lng), radius = Number(q.radius) || 5000
      const types = (q.types || '').toString().split(',').filter(Boolean)
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || types.length === 0) {
        return send(res, 400, 0, { error: 'nearby needs lat, lng and types' })
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
      // 15 min: fresh enough for open/closed, still collapses repeat searches.
      return send(res, r.ok ? 200 : r.status, 900, data)
    }

    // ── Text search → geocode a city/address (city coords are stable) ──
    if (op === 'geocode') {
      const query = (q.q || '').toString()
      if (!query) return send(res, 400, 0, { error: 'geocode needs q' })
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
