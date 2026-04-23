import { placeIdToNumId } from './activities'

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
const BASE = 'https://places.googleapis.com/v1'

// Mulberry32 — same seeded PRNG as tmdb.js
function seededRandom(seed) {
  let h = 0x9E3779B9
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 0x9E3779B9)
    h ^= h >>> 15
  }
  let t = (h >>> 0) + 0x6D2B79F5
  return function () {
    t = (t + 0x6D2B79F5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

// Haversine distance in km between two lat/lng points
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Build a photo URL from a photo name (e.g. "places/xxx/photos/yyy")
export function getPhotoUrl(photoName, maxWidth = 600) {
  if (!photoName) return null
  return `${BASE}/${photoName}/media?maxWidthPx=${maxWidth}&key=${API_KEY}&skipHttpRedirect=true`
}

// Price level label
function priceLevelLabel(level) {
  const map = {
    PRICE_LEVEL_FREE: 'Free',
    PRICE_LEVEL_INEXPENSIVE: '$',
    PRICE_LEVEL_MODERATE: '$$',
    PRICE_LEVEL_EXPENSIVE: '$$$',
    PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
  }
  return map[level] || null
}

// Format a place from the API response into a SwipeCard-compatible shape
function formatPlace(place, centerLat, centerLng) {
  const loc = place.location || {}
  const distKm = loc.latitude != null
    ? haversine(centerLat, centerLng, loc.latitude, loc.longitude)
    : null

  const photoName = place.photos?.[0]?.name || null
  const poster = photoName ? getPhotoUrl(photoName, 600) : null

  const rating = place.rating ? Number(place.rating.toFixed(1)) : null
  const ratingCount = place.userRatingCount || null

  const primaryType = (place.primaryType || '').replace(/_/g, ' ')
  const priceLevel = priceLevelLabel(place.priceLevel)

  const genreParts = []
  if (primaryType) genreParts.push(primaryType)
  if (priceLevel) genreParts.push(priceLevel)

  const isOpen = place.currentOpeningHours?.openNow ?? null
  const openLabel = isOpen === true ? 'Open now' : isOpen === false ? 'Closed' : null

  const overviewParts = []
  if (place.editorialSummary?.text) overviewParts.push(place.editorialSummary.text)
  else if (place.formattedAddress) overviewParts.push(place.formattedAddress)

  if (openLabel) overviewParts.push(openLabel)

  const distLabel = distKm != null
    ? distKm < 1
      ? `${Math.round(distKm * 1000)}m away`
      : `${distKm.toFixed(1)}km away`
    : null

  return {
    id: place.id,
    numId: placeIdToNumId(place.id),
    title: place.displayName?.text || 'Unknown place',
    poster,
    rating,
    ratingCount,
    genre: genreParts.join(' · ') || null,
    overview: overviewParts.join(' · ') || null,
    address: place.formattedAddress || null,
    distance: distLabel,
    priceLevel,
    isOpen,
  }
}

// Geocode a city/address text → { lat, lng, name }
export async function geocodeLocation(query) {
  if (!API_KEY) throw new Error('Google Maps API key not configured')

  const res = await fetch(`${BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.location',
    },
    body: JSON.stringify({ textQuery: query }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Geocode failed: ${res.status}`)
  }

  const data = await res.json()
  const place = data.places?.[0]
  if (!place) throw new Error(`No results found for "${query}"`)

  return {
    lat: place.location.latitude,
    lng: place.location.longitude,
    name: place.displayName?.text || query,
  }
}

// Fetch nearby places for given lat/lng, radius (meters), and array of place types
// Returns array of place objects shaped for SwipeCard
export async function fetchNearbyPlaces(lat, lng, radius, types, roomId) {
  if (!API_KEY) throw new Error('Google Maps API key not configured')

  const res = await fetch(`${BASE}/places:searchNearby`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.rating',
        'places.userRatingCount',
        'places.photos',
        'places.editorialSummary',
        'places.types',
        'places.location',
        'places.currentOpeningHours',
        'places.priceLevel',
        'places.primaryType',
      ].join(','),
    },
    body: JSON.stringify({
      includedTypes: types,
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radius,
        },
      },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Nearby search failed: ${res.status}`)
  }

  const data = await res.json()
  const places = (data.places || []).map(p => formatPlace(p, lat, lng))

  // Shuffle with seeded random using roomId for deterministic order
  const rng = roomId ? seededRandom(roomId) : Math.random
  for (let i = places.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[places[i], places[j]] = [places[j], places[i]]
  }

  return places.slice(0, 20)
}
