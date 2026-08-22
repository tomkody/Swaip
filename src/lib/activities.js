// numId is a stable integer used for the swipes table (item_id integer column).
// Category numIds are 1000–1011 to avoid collisions with movie/food item IDs.
export const ACTIVITY_CATEGORIES = [
  { id: 'bars',          numId: 1002, label: 'Pub',                 emoji: '🍺', desc: 'Pubs, bars and night clubs',          types: ['bar'],                              gradient: 'linear-gradient(135deg, #2C3E50, #4CA1AF)' },
  { id: 'sightseeing',   numId: 1003, label: 'Sightseeing',         emoji: '🏛️', desc: 'Landmarks, monuments, attractions',  types: ['tourist_attraction'],               gradient: 'linear-gradient(135deg, #834d9b, #d04ed6)' },
  { id: 'museums',       numId: 1004, label: 'Museums & Culture',   emoji: '🎨', desc: 'Museums, galleries, exhibitions',    types: ['museum', 'art_gallery'],            gradient: 'linear-gradient(135deg, #1a1a2e, #e94560)' },
  { id: 'nature',        numId: 1005, label: 'Parks & Nature',      emoji: '🌿', desc: 'Parks, gardens, outdoor spaces',     types: ['park'],                             gradient: 'linear-gradient(135deg, #11998e, #38ef7d)' },
  { id: 'cinema',        numId: 1006, label: 'Cinema & Movies',     emoji: '🎬', desc: 'Movie theaters and cinemas',         types: ['movie_theater'],                    gradient: 'linear-gradient(135deg, #0f0c29, #302b63)' },
  { id: 'sports',        numId: 1007, label: 'Sports & Fitness',    emoji: '🏋️', desc: 'Gyms, stadiums, sport centers',      types: ['gym', 'stadium'],                   gradient: 'linear-gradient(135deg, #f46b45, #eea849)' },
  { id: 'entertainment', numId: 1008, label: 'Entertainment',       emoji: '🎮', desc: 'Bowling, arcades, amusement',        types: ['bowling_alley', 'amusement_park'],  gradient: 'linear-gradient(135deg, #7b2ff7, #f107a3)' },
  { id: 'shopping',      numId: 1009, label: 'Shopping',            emoji: '🛍️', desc: 'Malls, markets, stores',             types: ['shopping_mall'],                    gradient: 'linear-gradient(135deg, #f953c6, #b91d73)' },
  { id: 'wellness',      numId: 1010, label: 'Wellness & Spa',      emoji: '🧘', desc: 'Spas, wellness centers',             types: ['spa'],                              gradient: 'linear-gradient(135deg, #43cea2, #185a9d)' },
  { id: 'music',         numId: 1011, label: 'Live Music',          emoji: '🎵', desc: 'Concert venues, live music bars',    types: ['night_club'],                       gradient: 'linear-gradient(135deg, #1f4037, #99f2c8)' },
]

// Generate a stable numeric ID from a Google Place ID string
// Uses a simple djb2-style hash, clamped to positive 32-bit integer range (avoiding 0–1100 used by categories/movies)
export function placeIdToNumId(placeId) {
  let h = 5381
  for (let i = 0; i < placeId.length; i++) {
    h = ((h << 5) + h) ^ placeId.charCodeAt(i)
    h = h >>> 0 // keep unsigned 32-bit
  }
  // Offset to avoid collision with categories (1000–1011) and typical movie IDs (< 1000000)
  return (h % 9000000) + 2000000
}
