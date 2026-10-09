// The catalog a room is built from, named by day. The nightly jobs rewrite the
// movie and series catalogs between 04:00 and 06:00 UTC, so a catalog day
// starts at 06:00 UTC: every request inside it asks /api/catalog for the same
// URL and gets the same CDN copy (so both partners get the same deck), and the
// first request after it reads the fresh catalog.
export function catalogDay(at = Date.now()) {
  return new Date(at - 6 * 3600 * 1000).toISOString().slice(0, 10)
}
