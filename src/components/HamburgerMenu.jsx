import { useState, useEffect, useRef } from 'react'
import './HamburgerMenu.css'

export default function HamburgerMenu({ onSavedMatches, dark, onToggleDark }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open])

  return (
    <div className="hamburger-wrap" ref={menuRef}>
      <button
        className={`hamburger-btn ${open ? 'is-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="Menu"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="3" y1="7" x2="21" y2="7"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="17" x2="21" y2="17"/>
          </svg>
        )}
      </button>

      {open && (
        <div className="hm-panel">
          {/* Theme toggle */}
          <button className="hm-item" onClick={onToggleDark}>
            <span className="hm-icon">{dark ? '☀️' : '🌙'}</span>
            {dark ? 'Light mode' : 'Dark mode'}
          </button>

          {/* Saved matches */}
          <button className="hm-item" onClick={() => { setOpen(false); onSavedMatches(); }}>
            <span className="hm-icon">🔖</span>
            Saved Matches
          </button>

          <div className="hm-divider" />

          {/* Contact */}
          <a className="hm-item" href="mailto:swaiptheapp@gmail.com">
            <span className="hm-icon">✉️</span>
            swaiptheapp@gmail.com
          </a>

          {/* Social media */}
          <div className="hm-social-row">
            <a
              href="https://instagram.com/swaipapp"
              target="_blank"
              rel="noopener noreferrer"
              className="hm-social-btn"
              aria-label="Instagram"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
              </svg>
            </a>
            <a
              href="https://facebook.com/swaipapp"
              target="_blank"
              rel="noopener noreferrer"
              className="hm-social-btn"
              aria-label="Facebook"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
              </svg>
            </a>
            <a
              href="https://tiktok.com/@swaipapp"
              target="_blank"
              rel="noopener noreferrer"
              className="hm-social-btn"
              aria-label="TikTok"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/>
              </svg>
            </a>
            <a
              href="https://threads.net/@swaipapp"
              target="_blank"
              rel="noopener noreferrer"
              className="hm-social-btn"
              aria-label="Threads"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                <path d="M8 12c0-2.21 1.79-4 4-4s4 1.79 4 4-1.79 4-4 4"/>
                <path d="M16 8.5c0 2.5-1.5 5.5-4 6"/>
              </svg>
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
