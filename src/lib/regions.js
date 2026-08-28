// Regions the nightly refresh job populates (see api/refresh-movies.js).
// Single source of truth — tmdb.js and seriesFetch.js both import this so the
// list can never drift out of sync between movies and series.
export const CATALOG_REGIONS = ['US', 'GB', 'CA', 'AU', 'IE', 'DE', 'FR', 'ES', 'IT', 'NL', 'BR', 'MX', 'IN', 'CZ', 'PL', 'SE']
