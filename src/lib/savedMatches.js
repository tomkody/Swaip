const KEY = 'swaip_saved_matches'

export function getSavedMatches() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function saveMatch({ id, title, category, image, year, rating }) {
  const matches = getSavedMatches()
  // Avoid duplicates
  if (matches.some(m => m.id === id && m.category === category)) return
  const entry = { id, title, category, image: image || null, year: year || null, rating: rating || null, dateMatched: new Date().toISOString() }
  localStorage.setItem(KEY, JSON.stringify([entry, ...matches]))
}

export function removeMatch(id, category) {
  const matches = getSavedMatches()
  localStorage.setItem(KEY, JSON.stringify(matches.filter(m => !(String(m.id) === String(id) && m.category === category))))
}
