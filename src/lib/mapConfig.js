// Map tiles and place search for the area picker.
//
// Two modes, decided by one env var so switching needs no code change:
// - No key (default): OpenStreetMap tiles and the public Photon geocoder. Both
//   free and keyless, both fair-use with no SLA - fine for a picker opened a
//   few thousand times a month.
// - VITE_MAPY_API_KEY set: Mapy.com (Seznam) tiles and search. Czech
//   cartography and address data, 250,000 free credits a month on the Basic
//   tariff, commercial use allowed, and it stops rather than bills when the
//   credits run out. Photon and OSM remain the fallback if Mapy refuses.
//
// Google is deliberately absent. Under the Google Maps Platform EEA terms its
// place names and addresses may not be shown next to any map, and nothing here
// needs Google: the picked point is our own data, handed to Places Nearby
// Search only when the room is created.
//
// Trimmed: a pasted env value with a trailing newline broke realtime once.
export const MAPY_KEY = (import.meta.env.VITE_MAPY_API_KEY || '').trim()

// Retina tiles cost the same one credit on Mapy; Leaflet's detectRetina would
// instead fetch four tiles per tile.
export function mapyTileUrl() {
  const size = (typeof window !== 'undefined' && (window.devicePixelRatio || 1) > 1) ? '256@2x' : '256'
  return `https://api.mapy.com/v1/maptiles/basic/${size}/{z}/{x}/{y}?apikey=${encodeURIComponent(MAPY_KEY)}&lang=en`
}

export const TILES = {
  mapy: {
    url: () => mapyTileUrl(),
    options: {
      minZoom: 5,
      maxZoom: 19,
      attribution: '<a href="https://api.mapy.com/copyright" target="_blank" rel="noopener">&copy; Seznam.cz a.s. and others</a>',
    },
  },
  osm: {
    url: () => 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      minZoom: 3,
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    },
  },
}

// Mapy said no (bad key, spent credits): use the free providers for the rest of
// the page's life. Shared by the tiles and the geocoder.
let mapyDown = false
const listeners = new Set()
export function mapyAvailable() { return Boolean(MAPY_KEY) && !mapyDown }
export function markMapyDown() {
  if (mapyDown) return
  mapyDown = true
  for (const fn of listeners) { try { fn() } catch { /* keep going */ } }
}
export function onMapyDown(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
