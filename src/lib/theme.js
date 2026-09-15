// One source of truth for the colour theme. New visitors get light; a saved
// choice is honoured. index.html applies the saved theme before first paint,
// these helpers keep React in sync afterwards.
const KEY = 'swaip-theme'

export function getSavedDark() {
  try { return localStorage.getItem(KEY) === 'dark' } catch { return false }
}

export function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
}

// Only called on an explicit toggle, so we never persist a choice nobody made.
export function saveTheme(dark) {
  applyTheme(dark)
  try { localStorage.setItem(KEY, dark ? 'dark' : 'light') } catch { /* storage blocked */ }
  window.dispatchEvent(new CustomEvent('swaip-theme', { detail: { dark } }))
}
