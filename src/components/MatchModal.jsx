import { useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { saveMatch } from '../lib/savedMatches'
import { generateShareImage, downloadCanvas } from '../lib/shareImage'
import './MatchModal.css'

const PLATFORM_LINKS = [
  { id: 'netflix',   name: 'Netflix',      url: t => `https://www.netflix.com/search?q=${encodeURIComponent(t)}`,                         color: '#E50914', bg: 'rgba(229,9,20,0.1)',   border: 'rgba(229,9,20,0.3)' },
  { id: 'max',       name: 'Max',          url: t => `https://www.max.com/search?q=${encodeURIComponent(t)}`,                             color: '#731CF8', bg: 'rgba(115,28,248,0.1)', border: 'rgba(115,28,248,0.3)' },
  { id: 'disney',    name: 'Disney+',      url: t => `https://www.disneyplus.com/search/${encodeURIComponent(t)}`,                        color: '#0063E5', bg: 'rgba(0,99,229,0.1)',   border: 'rgba(0,99,229,0.3)' },
  { id: 'prime',     name: 'Prime Video',  url: t => `https://www.amazon.com/s?k=${encodeURIComponent(t)}&i=prime-instant-video`,         color: '#00A8E0', bg: 'rgba(0,168,224,0.1)',  border: 'rgba(0,168,224,0.3)' },
  { id: 'apple',     name: 'Apple TV+',    url: t => `https://tv.apple.com/search?term=${encodeURIComponent(t)}`,                         color: '#a0a0a0', bg: 'rgba(160,160,160,0.1)', border: 'rgba(160,160,160,0.25)' },
  { id: 'paramount', name: 'Paramount+',   url: t => `https://www.paramountplus.com/search/?q=${encodeURIComponent(t)}`,                  color: '#0064FF', bg: 'rgba(0,100,255,0.1)',  border: 'rgba(0,100,255,0.3)' },
]

export default function MatchModal({ item, roomType, swipeCount = 0, onContinue, onDone }) {
  const hasConfettied = useRef(false)
  const hasSaved = useRef(false)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    if (!hasConfettied.current) {
      hasConfettied.current = true
      const end = Date.now() + 1500
      const colors = ['#ff6b6b', '#ee5a24', '#2ecc71', '#f1c40f', '#9b59b6']
      function frame() {
        confetti({ particleCount: 3, angle: 60,  spread: 55, origin: { x: 0 }, colors })
        confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors })
        if (Date.now() < end) requestAnimationFrame(frame)
      }
      frame()
    }
  }, [])

  // Auto-save match
  useEffect(() => {
    if (!hasSaved.current && item) {
      hasSaved.current = true
      saveMatch({
        id: item.id,
        title: item.title,
        category: roomType || 'movies',
        image: item.poster || null,
        year: item.year || null,
        rating: item.rating || null,
      })
    }
  }, [item, roomType])

  async function handleShare() {
    if (sharing) return
    setSharing(true)
    try {
      const canvas = await generateShareImage({
        title: item.title,
        posterUrl: item.poster || null,
        swipeCount,
      })
      downloadCanvas(canvas, `swaip-${item.title.replace(/\s+/g, '-').toLowerCase()}.png`)
    } catch (err) {
      console.error('Share error:', err)
    } finally {
      setSharing(false)
    }
  }

  const showWatchLinks = roomType === 'movies' || roomType === 'series'

  return (
    <div className="match-overlay">
      <div className="match-modal">
        <div className="match-header">
          <span className="match-emoji">🎉</span>
          <h1 className="match-title">It's a Match!</h1>
          <p className="match-subtitle">You both picked the same thing</p>
        </div>

        <div className="match-card">
          {item.poster ? (
            <img src={item.poster} alt={item.title} className="match-poster" />
          ) : (
            <div className="match-poster match-poster-placeholder">
              {item.emoji || (roomType === 'series' ? '📺' : '🎬')}
            </div>
          )}
          <div className="match-info">
            <h2>{item.title}</h2>
            <div className="match-meta">
              {item.year && <span>{item.year}</span>}
              {item.rating && <span>★ {item.rating}</span>}
            </div>
          </div>
        </div>

        {/* Watch it here — deep links */}
        {showWatchLinks && (
          <div className="match-watch">
            <p className="match-watch-label">Watch it here:</p>
            <div className="match-watch-btns">
              {PLATFORM_LINKS.map(p => (
                <a
                  key={p.id}
                  href={p.url(item.title)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="watch-pill"
                  style={{ '--pill-color': p.color, '--pill-bg': p.bg, '--pill-border': p.border }}
                >
                  {p.name}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="watch-pill-icon">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Share to stories */}
        <button className="match-share-btn" onClick={handleShare} disabled={sharing}>
          {sharing ? 'Generating image…' : '📸 Share to Instagram / TikTok'}
        </button>

        <div className="match-actions">
          {onContinue && (
            <button className="btn btn-primary" onClick={onContinue}>
              Keep Swiping
            </button>
          )}
          <button className="btn btn-secondary" onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
