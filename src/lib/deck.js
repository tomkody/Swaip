import { seededShuffle } from './random'

// Build a swipe deck from a filtered pool. The median session swipes only ~6
// cards, so the opening cards effectively ARE the room: a random opener like an
// obscure 1957 arthouse film kills it. Front-load the most recognisable titles
// (by TMDB popularity, falling back to rating), shuffled among themselves so
// rooms still differ, then the rest shuffled. Seeded by room id → both partners
// get the identical order.
export function buildDeck(pool, roomId, { openers = 12, size = 50 } = {}) {
  const score = m => (m.popularity != null ? m.popularity : -1)
  const ranked = [...pool].sort((a, b) =>
    (score(b) - score(a)) || ((Number(b.rating) || 0) - (Number(a.rating) || 0))
  )
  const top = ranked.slice(0, openers)
  const rest = ranked.slice(openers)
  return [...seededShuffle(top, `${roomId}:openers`), ...seededShuffle(rest, roomId)].slice(0, size)
}
