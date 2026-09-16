// One source of truth for the colour theme. New visitors get light; a saved
// choice is honoured. index.html applies the saved theme before first paint,
// these helpers keep React in sync afterwards.
import { crtSwitch } from './crtSwitch'

const KEY = 'swaip-theme'

export function getSavedDark() {
  try { return localStorage.getItem(KEY) === 'dark' } catch { return false }
}

export function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
}

// Only called on an explicit toggle, so we never persist a choice nobody made.
// The swap itself happens inside crtSwitch, at the moment the screen is dark -
// the colours change behind the black, the way a TV changes picture. The event
// goes out at the same moment so every toggle's icon turns with it, unseen.
export function saveTheme(dark) {
  try { localStorage.setItem(KEY, dark ? 'dark' : 'light') } catch { /* storage blocked */ }
  crtSwitch(() => {
    applyTheme(dark)
    window.dispatchEvent(new CustomEvent('swaip-theme', { detail: { dark } }))
  })
}
