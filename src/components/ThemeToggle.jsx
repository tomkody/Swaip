import { useEffect, useState } from 'react'
import Icon from './Icon'
import { getSavedDark, applyTheme, saveTheme } from '../lib/theme'
import './ThemeToggle.css'

// Inline icon button — lives inside a header row (AppHeader, the in-room
// headers), never floats over content.
export default function ThemeToggle({ className = '' }) {
  const [dark, setDark] = useState(getSavedDark)

  useEffect(() => { applyTheme(dark) }, [dark])
  // Stay in sync if another toggle on the page flips the theme.
  useEffect(() => {
    const on = e => setDark(Boolean(e.detail?.dark))
    window.addEventListener('swaip-theme', on)
    return () => window.removeEventListener('swaip-theme', on)
  }, [])

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={() => { const next = !dark; setDark(next); saveTheme(next) }}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <Icon name={dark ? 'sun' : 'moon'} size={18} />
    </button>
  )
}
