import { seededShuffle } from './random'

// Build a swipe deck from a filtered pool. The median session swipes only ~6
// cards, so the opening cards effectively ARE the room: a random opener like an
// obscure 1957 arthouse film kills it. Front-load the most recognisable titles
// (by TMDB popularity, falling back to rating), shuffled among themselves so
// rooms still differ, then the rest shuffled. Seeded by room id → both partners
// get the identical order.
//
// `prefer` (optional predicate) splits the pool into a preferred layer and the
// rest. Each layer gets the same popular-openers-then-shuffle treatment, and
// the preferred layer goes first — so "Under 2h" leads with short, well-known
// films but the deck never runs dry if the pair can't agree on one.
export function buildDeck(pool, roomId, { openers = 12, size = 50, prefer = null } = {}) {
  const score = m => (m.popularity != null ? m.popularity : -1)
  const ranked = [...pool].sort((a, b) =>
    (score(b) - score(a)) || ((Number(b.rating) || 0) - (Number(a.rating) || 0))
  )
  const layer = (list, tag) => [
    ...seededShuffle(list.slice(0, openers), `${roomId}${tag}:openers`),
    ...seededShuffle(list.slice(openers), `${roomId}${tag}`),
  ]
  if (!prefer) return layer(ranked, '').slice(0, size)

  const preferred = ranked.filter(prefer)
  const rest = ranked.filter(m => !prefer(m))
  return [...layer(preferred, ''), ...layer(rest, ':rest')].slice(0, size)
}
