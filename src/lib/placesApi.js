import { placeIdToNumId } from './activities'

// ── Chain / brand deduplication ───────────────────────────────────────────────
// Known international chain prefixes (lowercase, normalized).
// A place whose name starts with one of these gets that prefix as its brand key,
// so only the single best location of that chain survives deduplication.
const CHAIN_PREFIXES = [
  "mcdonald's", "mcdonalds", "burger king", "kfc", "subway",
  "pizza hut", "domino's", "dominos", "starbucks", "costa coffee",
  "costa", "tim hortons", "dunkin'", "dunkin", "krispy kreme",
  "papa john's", "papa johns", "little caesars", "five guys", "shake shack",
  "wendy's", "wendys", "taco bell", "popeyes", "chipotle",
  "nando's", "nandos", "wagamama", "pizza express", "leon",
  "greggs", "wingstop", "whataburger", "sonic drive-in", "sonic",
  "arby's", "arbys", "dairy queen", "jollibee", "hardee's", "carl's jr",
  "white castle", "culver's", "raising cane's", "in-n-out",
  "buffalo wild wings", "applebee's", "denny's", "ihop",
  "olive garden", "red lobster", "outback steakhouse", "texas roadhouse",
  "baskin-robbins", "haagen-dazs", "ben & jerry's",
  "moe's southwest grill", "jimmy john's", "jersey mike's",
  "firehouse subs", "potbelly", "quiznos",
  "pret a manger", "pret", "paul bakery", "paul",
  "true burger", "honest burger",
  "pizza inn", "papa murphy's",
  "church's chicken", "bojangles",
  "long john silver's", "captain d's",
  "panera bread", "panera",
  "panda express", "p.f. chang's",
  "chili's", "t.g.i. friday's", "tgi fridays",
  "red robin", "ihop", "denny's",
  "pizza 9", "kebab house", "doner shack",
]

/**
 * Return a stable brand key for a place title.
 * Two places with the same brand key are considered the same chain.
 * - Known chains: returns the matched prefix (e.g. "mcdonald's")
 * - Unknown places: returns text before the first separator (e.g. "U Fleků")
 */
export function getBrandKey(title) {
  if (!title) return ''
  const norm = title
    .toLowerCase()
    .replace(/[''´`]/g, "'")   // normalize apostrophes
    .replace(/[®™©]/g, '')     // strip trademark symbols
    .trim()

  // Check against known chain prefixes first
  for (const prefix of CHAIN_PREFIXES) {
    if (norm === prefix || norm.startsWith(prefix + ' ') ||
        norm.startsWith(prefix + '-') || norm.startsWith(prefix + '(')) {
      return prefix
    }
  }

  // Strip everything after a separator: -, –, |, (, ·, comma
  const sep = norm.match(/^(.+?)\s*[-–|·,(]/)
  if (sep && sep[1].length > 1) return sep[1].trim()

  return norm
}

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
  return `${BASE}/${photoName}/media?maxWidthPx=${maxWidth}&key=${API_KEY}`
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

  // Extract today's opening hours from weekdayDescriptions
  // Google uses Mon=0…Sun=6; JS getDay() uses Sun=0, Mon=1…Sat=6
  let todayHours = null   // full string e.g. "9:00 AM – 10:00 PM" or "9:00 – 22:00" (24h)
  let opensAt = null      // e.g. "9:00 AM" or "Tomorrow 9:00" — shown when closed
  let closesAt = null     // e.g. "10:00 PM" or "22:00" — shown when open

  // Matches both 12-hour ("9:00 AM") and 24-hour ("9:00", "22:00") time formats
  const TIME_RE = /\d{1,2}:\d{2}(?:\s*[AP]M)?/gi
  const firstTime = s => (s || '').match(/\d{1,2}:\d{2}(?:\s*[AP]M)?/i)?.[0] ?? null
  const lastTime  = s => { const m = [...(s || '').matchAll(TIME_RE)]; return m.length ? m[m.length-1][0] : null }
  const hasTime   = s => /\d{1,2}:\d{2}/.test(s || '')

  const weekday = place.currentOpeningHours?.weekdayDescriptions
  if (weekday && weekday.length > 0) {
    const jsDay = new Date().getDay()                  // 0=Sun … 6=Sat
    const googleIdx = jsDay === 0 ? 6 : jsDay - 1     // 0=Mon … 6=Sun

    // Strip the day-name prefix — works for any locale ("Monday: ", "Po ", "Lundi: " …)
    const strip = s => (s || '').replace(/^[^:]+:\s*/, '').trim()
    todayHours = strip(weekday[googleIdx] || '') || null

    if (isOpen === true && hasTime(todayHours)) {
      // Last time in the range = closing time (works for both AM/PM and 24h)
      closesAt = lastTime(todayHours)
    }

    if (isOpen === false) {
      if (hasTime(todayHours)) {
        // Place has hours today but is currently closed — show opening time
        opensAt = firstTime(todayHours)
      } else {
        // Closed all day today (or no parseable time) — scan upcoming days
        for (let d = 1; d <= 7; d++) {
          const nextHours = strip(weekday[(googleIdx + d) % 7] || '')
          if (hasTime(nextHours)) {
            opensAt = (d === 1 ? 'Tomorrow ' : '') + firstTime(nextHours)
            break
          }
        }
      }
    }
  }

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
    todayHours,
    opensAt,
    closesAt,
    lat: loc.latitude ?? null,
    lng: loc.longitude ?? null,
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

  // Primary types that should never appear in Food or Activities results
  const BLOCKED_TYPES = new Set([
    'gas_station', 'fuel', 'car_wash', 'car_dealer', 'car_rental', 'car_repair',
    'parking', 'parking_lot', 'atm', 'bank', 'post_office',
    'laundry', 'storage', 'moving_company', 'cemetery',
  ])

  const data = await res.json()
  const places = (data.places || [])
    .filter(p => !BLOCKED_TYPES.has(p.primaryType))          // no gas stations etc.
    .map(p => formatPlace(p, lat, lng))
    .filter(p => p.rating == null || p.rating >= 4)

  // Shuffle with seeded random using roomId for deterministic order
  const rng = roomId ? seededRandom(roomId) : Math.random
  for (let i = places.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[places[i], places[j]] = [places[j], places[i]]
  }

  // Open places always come first — closed ones bubble to the back
  places.sort((a, b) => {
    const rank = p => p.isOpen === true ? 0 : p.isOpen === false ? 1 : 2
    return rank(a) - rank(b)
  })

  // Deduplicate chains: keep only the first (= best: open + shuffled) per brand.
  // e.g. 8 McDonald's locations → 1 McDonald's.
  const brandSeen = new Set()
  const deduped = []
  for (const p of places) {
    const brand = getBrandKey(p.title)
    if (!brandSeen.has(brand)) {
      brandSeen.add(brand)
      deduped.push(p)
    }
  }

  return deduped.slice(0, 20)
}
