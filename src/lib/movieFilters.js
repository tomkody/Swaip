// "Time" preferences for movie rooms: runtime and release era.
//
// These are soft filters on purpose. A pair that picks "Under 90 min" wants
// short films FIRST, not a deck that runs dry after 9 cards and leaves them
// with nothing to agree on. So preferences reorder the deck (matching titles
// up front, the rest behind) instead of cutting it. Genres and platforms stay
// hard filters — "no horror" is a promise, "short" is a preference.

// A length preference means "a shorter film", not "anything short": the
// catalog carries a few 9-minute shorts and 35-minute specials that would
// otherwise lead an "Under 90 min" deck. 40 min is the usual feature floor.
export const FEATURE_MIN_MINUTES = 40

export const LENGTH_OPTIONS = [
  { id: 'any',     label: 'Any length' },
  { id: 'under2h', label: 'Under 2h',     maxMinutes: 120 },
  { id: 'under90', label: 'Under 90 min', maxMinutes: 90 },
]

export const ERA_OPTIONS = [
  { id: 'any',     label: 'Any year' },
  { id: 'recent',  label: 'Recent',   fromYear: 2018, hint: '2018 and newer' },
  { id: 'classic', label: 'Classics', toYear: 2005,   hint: 'before 2006' },
]

// Below this many close matches the create page warns that the deck will be
// topped up with similar titles.
export const FEW_MATCHES = 15

// "2h 22m" → 142, "95m" → 95, "" → null. Catalog stores runtime as display text.
export function parseRuntimeMinutes(text) {
  if (!text || typeof text !== 'string') return null
  const h = /(\d+)\s*h/.exec(text)
  const m = /(\d+)\s*m/.exec(text)
  if (!h && !m) return null
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0)
}

// Unknown ids (old rooms, hand-edited JSON) collapse to 'any'.
export function normalizePrefs(raw) {
  const length = LENGTH_OPTIONS.some(o => o.id === raw?.length) ? raw.length : 'any'
  const era = ERA_OPTIONS.some(o => o.id === raw?.era) ? raw.era : 'any'
  return { length, era }
}

export function hasPrefs(prefs) {
  const p = normalizePrefs(prefs)
  return p.length !== 'any' || p.era !== 'any'
}

// True when a title fits every chosen preference. Missing data never fits a
// chosen preference: a film with no runtime shouldn't lead an "Under 90 min" deck.
export function matchesPrefs(movie, prefs) {
  const p = normalizePrefs(prefs)
  if (p.length !== 'any') {
    const max = LENGTH_OPTIONS.find(o => o.id === p.length).maxMinutes
    const mins = parseRuntimeMinutes(movie.runtime)
    if (mins == null || mins > max || mins < FEATURE_MIN_MINUTES) return false
  }
  if (p.era !== 'any') {
    const opt = ERA_OPTIONS.find(o => o.id === p.era)
    const year = Number(movie.year)
    if (!year) return false
    if (opt.fromYear && year < opt.fromYear) return false
    if (opt.toYear && year > opt.toYear) return false
  }
  return true
}

// Predicate for buildDeck's `prefer`, or null when nothing is chosen so the
// deck is built exactly as before.
export function prefsPredicate(prefs) {
  return hasPrefs(prefs) ? (m => matchesPrefs(m, prefs)) : null
}

export function countMatches(pool, prefs) {
  return pool.filter(m => matchesPrefs(m, prefs)).length
}

// Short summary for the create page badge: "Under 2h · Recent" / "Any".
export function prefsLabel(prefs) {
  const p = normalizePrefs(prefs)
  const parts = []
  if (p.length !== 'any') parts.push(LENGTH_OPTIONS.find(o => o.id === p.length).label)
  if (p.era !== 'any') parts.push(ERA_OPTIONS.find(o => o.id === p.era).label)
  return parts.length ? parts.join(' · ') : 'Any'
}
