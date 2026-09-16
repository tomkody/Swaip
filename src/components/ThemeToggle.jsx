import { useEffect, useState } from 'react'
import Icon from './Icon'
import { getSavedDark, applyTheme, saveTheme } from '../lib/theme'
import './ThemeToggle.css'

// Inline icon button — lives inside a header row (AppHeader, the in-room
// headers), never floats over content.
export default function ThemeToggle({ className = '' }) {
  const [dark, setDark] = useState(getSavedDark)

  // Apply once on mount only. Applying on every change would swap the colours
  // before the switch animation reaches its dark moment, which is the whole
  // point of it - see saveTheme.
  useEffect(() => { applyTheme(getSavedDark()) }, [])
  // The theme event lands at that dark moment, for this toggle and any other.
  useEffect(() => {
    const on = e => setDark(Boolean(e.detail?.dark))
    window.addEventListener('swaip-theme', on)
    return () => window.removeEventListener('swaip-theme', on)
  }, [])

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={() => saveTheme(!dark)}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <Icon name={dark ? 'sun' : 'moon'} size={18} />
    </button>
  )
}
