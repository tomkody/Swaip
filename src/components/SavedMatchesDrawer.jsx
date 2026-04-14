import { useState, useEffect } from 'react'
import { getSavedMatches, removeMatch } from '../lib/savedMatches'
import './SavedMatchesDrawer.css'

const CATEGORY_LABELS = {
  movies:       { label: 'Movies',        emoji: '🎬' },
  series:       { label: 'TV Series',     emoji: '📺' },
  food:         { label: 'Food & Dining', emoji: '🍽️' },
  conversations:{ label: 'Conversations', emoji: '💬' },
  activities:   { label: 'Activities',   emoji: '🎯' },
}

function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function SavedMatchesDrawer({ open, onClose }) {
  const [matches, setMatches] = useState([])

  useEffect(() => {
    if (open) setMatches(getSavedMatches())
  }, [open])

  function handleRemove(id, category) {
    removeMatch(id, category)
    setMatches(prev => prev.filter(m => !(String(m.id) === String(id) && m.category === category)))
  }

  // Group by category
  const grouped = {}
  for (const m of matches) {
    if (!grouped[m.category]) grouped[m.category] = []
    grouped[m.category].push(m)
  }
  const categories = Object.keys(grouped).sort()

  return (
    <>
      {open && <div className="drawer-backdrop" onClick={onClose} />}
      <div className={`saved-drawer ${open ? 'open' : ''}`}>
        <div className="drawer-header">
          <div className="drawer-title-row">
            <span className="drawer-title">Saved Matches</span>
            <span className="drawer-count">{matches.length}</span>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="drawer-body">
          {matches.length === 0 ? (
            <div className="drawer-empty">
              <div className="drawer-empty-icon">🔖</div>
              <p>No saved matches yet.</p>
              <p className="drawer-empty-hint">Matches are saved automatically every time you and your partner agree on something!</p>
            </div>
          ) : (
            categories.map(cat => {
              const info = CATEGORY_LABELS[cat] || { label: cat, emoji: '✨' }
              return (
                <div key={cat} className="drawer-group">
                  <div className="drawer-group-header">
                    <span>{info.emoji}</span>
                    <span>{info.label}</span>
                  </div>
                  <div className="drawer-group-items">
                    {grouped[cat].map(m => (
                      <div key={m.id + m.category} className="drawer-item">
                        {m.image ? (
                          <img src={m.image} alt={m.title} className="drawer-item-img" />
                        ) : (
                          <div className="drawer-item-img drawer-item-placeholder">
                            {info.emoji}
                          </div>
                        )}
                        <div className="drawer-item-info">
                          <div className="drawer-item-title">{m.title}</div>
                          <div className="drawer-item-meta">
                            {m.year && <span>{m.year}</span>}
                            {m.rating && <span>★ {m.rating}</span>}
                            <span className="drawer-item-date">{formatDate(m.dateMatched)}</span>
                          </div>
                        </div>
                        <button
                          className="drawer-remove"
                          onClick={() => handleRemove(m.id, m.category)}
                          aria-label="Remove"
                          title="Remove"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4h6v2" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
