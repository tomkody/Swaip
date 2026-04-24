import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

// Configure once — safe to call multiple times (idempotent)
setOptions({
  apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  version: 'weekly',
})

// Lazy-load a Maps library by name and return it
// e.g. loadLib('maps') → { Map, ... }
//      loadLib('places') → { AutocompleteService, PlacesService, ... }
export async function loadLib(name) {
  return importLibrary(name)
}

