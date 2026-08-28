import { placeIdToNumId } from './activities'
import { seededRandom } from './random'

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

// Production: the browser calls the /api/places proxy and the Maps key stays on
// the server (never in the shipped bundle). Local `vite` dev has no serverless
// runtime, so we call Google directly with the VITE key — that branch is behind
// `import.meta.env.DEV` and is compiled out of the production build, so the key
// is not present in dist/ at all.
const DEV_KEY = import.meta.env.DEV ? import.meta.env.VITE_GOOGLE_MAPS_API_KEY : null
const PROXY = '/api/places'
const BASE = 'https://places.googleapis.com/v1'

const NEARBY_FIELD_MASK = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.rating',
  'places.userRatingCount', 'places.photos', 'places.editorialSummary', 'places.types',
  'places.location', 'places.currentOpeningHours', 'places.priceLevel', 'places.primaryType',
].join(',')

// Language for Places results — matches the user's browser so descriptions and
// types come back in one consistent language instead of the place's local one
// (e.g. Czech text for a Prague search in an English UI).
function placesLang() {
  return (typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en').split('-')[0]
}

// Turn coordinates into a short place name + country code for display. Tries
// Google Geocoding (needs the Geocoding API enabled on the key), then falls back
// to OpenStreetMap Nominatim, then to a safe default. Never blocks room creation.
// Returns { name, countryCode }.
export async function reverseGeocode(lat, lng) {
  const lang = placesLang()
  // 1) Google Geocoding (direct in dev, via proxy in prod — same response shape)
  {
    try {
      const r = DEV_KEY
        ? await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=${lang}&key=${DEV_KEY}`)
        : await fetch(`${PROXY}?op=revgeo&lat=${lat}&lng=${lng}&lang=${lang}`)
      const d = await r.json()
      if (d.status === 'OK' && d.results?.length) {
        const comps = d.results[0].address_components || []
        const find = (...types) => comps.find(c => types.some(t => c.types.includes(t)))?.long_name
        const country = comps.find(c => c.types.includes('country'))?.short_name || null
        const name = find('neighborhood') || find('sublocality', 'sublocality_level_1') ||
          find('locality') || find('postal_town') || find('administrative_area_level_2')
        if (name) return { name, countryCode: country ? country.toUpperCase() : null }
      }
    } catch { /* fall through to Nominatim */ }
  }
  // 2) Nominatim fallback
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 6000)
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': lang }, signal: ctrl.signal }
    )
    clearTimeout(t)
    const d = await r.json()
    const a = d.address || {}
    return {
      name: a.neighbourhood || a.suburb || a.city_district || a.city || a.town || a.village || 'My Location',
      countryCode: (a.country_code || '').toUpperCase() || null,
    }
  } catch {
    return { name: 'My Location', countryCode: null }
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

// Build a photo URL from a photo name (e.g. "places/xxx/photos/yyy").
// Prod: hit the proxy, which 302-redirects to the keyless googleusercontent URL.
export function getPhotoUrl(photoName, maxWidth = 600) {
  if (!photoName) return null
  return DEV_KEY
    ? `${BASE}/${photoName}/media?maxWidthPx=${maxWidth}&key=${DEV_KEY}`
    : `${PROXY}?op=photo&name=${encodeURIComponent(photoName)}&w=${maxWidth}`
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
  const res = DEV_KEY
    ? await fetch(`${BASE}/places:searchText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': DEV_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.location',
        },
        body: JSON.stringify({ textQuery: query, languageCode: placesLang() }),
      })
    : await fetch(`${PROXY}?op=geocode&q=${encodeURIComponent(query)}&lang=${placesLang()}`)

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
  const res = DEV_KEY
    ? await fetch(`${BASE}/places:searchNearby`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': DEV_KEY,
          'X-Goog-FieldMask': NEARBY_FIELD_MASK,
        },
        body: JSON.stringify({
          includedTypes: types,
          maxResultCount: 20,
          languageCode: placesLang(),
          locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius } },
        }),
      })
    : await fetch(`${PROXY}?op=nearby&lat=${lat}&lng=${lng}&radius=${radius}&types=${encodeURIComponent(types.join(','))}&lang=${placesLang()}`)

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
