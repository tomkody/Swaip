// Place search and naming for the area picker: Mapy.com when a key is set,
// otherwise (and whenever Mapy refuses) the public Photon server.
//
// Both are called straight from the browser. Photon (OpenStreetMap data) may
// be cached, so its answers are kept in memory while the picker is open, which
// saves repeat calls when someone deletes a letter and retypes it. Mapy's terms
// (4.6.2) forbid caching its results at all, so those are never kept.
//
// Points leave the device rounded to 3 decimals (~100 m), the same grid the
// rooms are stored on: enough to name an area or rank results, not a doorstep.
// Nominatim is not used: its policy forbids search-as-you-type.

import { MAPY_KEY, mapyAvailable, markMapyDown } from './mapConfig'

const PHOTON = 'https://photon.komoot.io'
const MAPY = 'https://api.mapy.com/v1'
const TIMEOUT_MS = 4000
const MAPY_LANGS = new Set(['cs', 'de', 'el', 'en', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'sk', 'tr', 'uk'])

const cache = new Map()
export function clearGeocoderCache() { cache.clear() }

function browserLang() {
  const l = (typeof navigator !== 'undefined' && navigator.language) || 'en'
  const primary = l.split('-')[0].toLowerCase()
  return MAPY_LANGS.has(primary) ? primary : 'en'
}

const unique = parts => {
  const seen = new Set()
  return parts.filter(p => {
    if (!p) return false
    const k = p.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// fetch with a timeout that also follows the caller's AbortSignal.
async function getJson(url, signal) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  const follow = () => ctrl.abort()
  signal?.addEventListener?.('abort', follow)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`)
      err.status = res.status
      throw err
    }
    return await res.json()
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener?.('abort', follow)
  }
}

const isAbort = e => e?.name === 'AbortError'

// ── Photon (OpenStreetMap data) ──────────────────────────────────────────────

// One result row. `name` is the first line, `detail` the second, `label` what
// the area gets called once picked ("Nové Sady, Olomouc").
export function photonResult(feature) {
  const p = feature?.properties || {}
  const [lng, lat] = feature?.geometry?.coordinates || []
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const street = [p.street, p.housenumber].filter(Boolean).join(' ')
  const name = p.name || street || p.district || p.city
  if (!name) return null
  const place = p.city || p.county
  return {
    id: `${p.osm_type || ''}${p.osm_id || ''}` || `${lat},${lng}`,
    name,
    detail: unique([p.name && street !== name ? street : null, p.district, place, p.country])
      .filter(x => x !== name).slice(0, 3).join(', '),
    label: unique([name, place]).join(', '),
    lat,
    lng,
    countryCode: p.countrycode ? String(p.countrycode).toUpperCase() : null,
  }
}

// Areas, not businesses: a reverse lookup often lands on a pub, and "U Včelek"
// is no name for a search area.
export function photonLabel(props = {}) {
  const area = props.district || props.locality || props.suburb
  const place = props.city || props.town || props.village || props.county
  const name = unique([area, place]).join(', ') || props.name || null
  return name ? { name, countryCode: props.countrycode ? String(props.countrycode).toUpperCase() : null } : null
}

async function photonSuggest(query, { near, signal }) {
  const params = new URLSearchParams({ q: query, limit: '8', lang: 'default' })
  for (const layer of ['house', 'street', 'locality', 'district', 'city', 'other']) params.append('layer', layer)
  if (near) {
    params.set('lat', near.lat.toFixed(3))
    params.set('lon', near.lng.toFixed(3))
    params.set('zoom', '12')
    params.set('location_bias_scale', '0.2')
  }
  const data = await getJson(`${PHOTON}/api/?${params}`, signal)
  return dedupe((data.features || []).map(photonResult).filter(Boolean)).slice(0, 6)
}

async function photonReverse(lat, lng, { signal }) {
  const data = await getJson(`${PHOTON}/reverse?lat=${lat.toFixed(3)}&lon=${lng.toFixed(3)}&limit=1&lang=default`, signal)
  return photonLabel(data.features?.[0]?.properties)
}

// ── Mapy.com (Seznam) ────────────────────────────────────────────────────────

const regional = (item, type) => item?.regionalStructure?.find(r => r.type === type)

export function mapyResult(item) {
  const lat = item?.position?.lat
  const lng = item?.position?.lon
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !item.name) return null
  const place = regional(item, 'regional.municipality')?.name
  return {
    id: `${item.type || ''}:${item.name}:${lat.toFixed(4)},${lng.toFixed(4)}`,
    name: item.name,
    detail: item.location || '',
    label: unique([item.name, place]).join(', '),
    lat,
    lng,
    countryCode: regional(item, 'regional.country')?.isoCode?.toUpperCase() || null,
  }
}

export function mapyLabel(item) {
  if (!item) return null
  const part = regional(item, 'regional.municipality_part')?.name
  const place = regional(item, 'regional.municipality')?.name
  const name = unique([part, place]).join(', ') || item.name || null
  return name ? { name, countryCode: regional(item, 'regional.country')?.isoCode?.toUpperCase() || null } : null
}

async function mapyCall(path, params, signal) {
  params.set('apikey', MAPY_KEY)
  params.set('lang', browserLang())
  try {
    return await getJson(`${MAPY}/${path}?${params}`, signal)
  } catch (e) {
    // Bad key or spent credits: stop asking for the rest of this page's life.
    if ([401, 403, 429].includes(e.status)) markMapyDown()
    throw e
  }
}

async function mapySuggest(query, { near, radius, signal }) {
  const params = new URLSearchParams({ query, limit: '6' })
  for (const t of ['regional.municipality', 'regional.municipality_part', 'regional.street', 'regional.address', 'poi']) params.append('type', t)
  if (near) {
    params.set('preferNear', `${near.lng.toFixed(3)},${near.lat.toFixed(3)}`)
    params.set('preferNearPrecision', String(Math.round(radius || 5000)))
  }
  const data = await mapyCall('suggest', params, signal)
  return dedupe((data.items || []).map(mapyResult).filter(Boolean))
}

async function mapyReverse(lat, lng, { signal }) {
  const params = new URLSearchParams({ lat: lat.toFixed(3), lon: lng.toFixed(3) })
  const data = await mapyCall('rgeocode', params, signal)
  return mapyLabel(data.items?.[0])
}

// ── Public API ───────────────────────────────────────────────────────────────

// Photon often returns the same place twice (a quarter and its cadastral area).
function dedupe(results) {
  const seen = new Set()
  return results.filter(r => {
    const k = `${r.name}|${r.detail}`.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// → { source: 'mapy'|'photon', results: [{ id, name, detail, label, lat, lng, countryCode }] }
export async function suggest(query, { near = null, radius, signal } = {}) {
  const q = query.trim()
  if (!q) return { source: null, results: [] }
  const nearKey = near ? `${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : '-'
  const useMapy = mapyAvailable()
  const key = `${useMapy ? 'mapy' : 'photon'}|${q.toLowerCase()}|${nearKey}`
  if (cache.has(key)) return cache.get(key)

  let out
  if (useMapy) {
    try {
      out = { source: 'mapy', results: await mapySuggest(q, { near, radius, signal }) }
    } catch (e) {
      if (isAbort(e) && signal?.aborted) throw e
    }
  }
  if (!out) out = { source: 'photon', results: await photonSuggest(q, { near, signal }) }
  if (out.source !== 'mapy') cache.set(key, out)
  return out
}

// → { name, countryCode } | null. Names the area around a point.
export async function reverse(lat, lng, { signal } = {}) {
  const key = `rev|${lat.toFixed(3)},${lng.toFixed(3)}`
  if (cache.has(key)) return cache.get(key)
  let out = null
  let fromMapy = false
  if (mapyAvailable()) {
    try {
      out = await mapyReverse(lat, lng, { signal })
      fromMapy = Boolean(out)
    } catch (e) {
      if (isAbort(e) && signal?.aborted) throw e
    }
  }
  if (!out) out = await photonReverse(lat, lng, { signal })
  if (out && !fromMapy) cache.set(key, out)
  return out
}

// Which data the last answers came from, for the credit line under results.
export function searchCredit(source) {
  return source === 'mapy'
    ? { text: 'Search by Mapy.com', href: 'https://mapy.com/' }
    : { text: 'Search by Photon, data © OpenStreetMap contributors', href: 'https://www.openstreetmap.org/copyright' }
}
