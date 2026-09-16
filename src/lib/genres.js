// The genre chips on both create pages, and how a title's genres read on its
// card. Movies and series used to have two different lists, and half of the
// series chips matched nothing at all. The catalog build now tags every movie
// and series with these same names (api/_lib/genres.js - a test holds the two
// lists together), so a chip means the same thing on both pages.

export const GENRES = [
  { name: 'Action', emoji: '💥' },
  { name: 'Adventure', emoji: '🧭' },
  { name: 'Animation', emoji: '🧸' },
  { name: 'Anime', emoji: '🎌' },
  { name: 'Biography', emoji: '📖' },
  { name: 'Comedy', emoji: '😂' },
  { name: 'Crime', emoji: '🚔' },
  { name: 'Documentary', emoji: '🎥' },
  { name: 'Drama', emoji: '🎭' },
  { name: 'Fantasy', emoji: '🐉' },
  { name: 'History', emoji: '📜' },
  { name: 'Horror', emoji: '👻' },
  { name: 'Music', emoji: '🎵' },
  { name: 'Mystery', emoji: '🔍' },
  { name: 'Romance', emoji: '❤️' },
  { name: 'Sci-Fi', emoji: '🚀' },
  { name: 'Sport', emoji: '⚽' },
  { name: 'Thriller', emoji: '😱' },
  { name: 'War', emoji: '⚔️' },
  { name: 'Western', emoji: '🤠' },
]

// Specific before broad, so the first few genres on a card are the ones that
// say the most: "Anime · Sport · Comedy", not "Animation · Comedy · Drama".
export const LABEL_ORDER = [
  'Anime', 'Documentary', 'Biography', 'History', 'War', 'Western', 'Sport',
  'Music', 'Horror', 'Sci-Fi', 'Fantasy', 'Romance', 'Thriller', 'Mystery',
  'Crime', 'Comedy', 'Animation', 'Action', 'Adventure', 'Drama',
]

// Rooms created before the lists were merged saved "Musical"; the bundled
// fallback lists use a couple of IMDb names.
const ALIASES = { Musical: 'Music', Noir: 'Crime', 'Film Noir': 'Crime' }

const RANK = new Map(LABEL_ORDER.map((name, i) => [name, i]))

// Any list of genre names - a catalog row, a fallback-list entry, a room's saved
// filter - down to known names, once each, in label order. Names that are no
// longer offered ("Reality", "Family", "TV Movie") are dropped.
export function normalizeGenres(names = []) {
  const out = new Set()
  for (const raw of names) {
    const name = ALIASES[raw] || raw
    if (RANK.has(name)) out.add(name)
  }
  // The catalog only calls a title anime if TMDB calls it animation.
  if (out.has('Anime')) out.add('Animation')
  return [...out].sort((a, b) => RANK.get(a) - RANK.get(b))
}

// Does a title (its normalized genres) belong under any of the selected chips?
export function matchesGenres(titleGenres, selected) {
  return selected.some(g => titleGenres.includes(g))
}
