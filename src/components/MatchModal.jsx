import { useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { saveMatch } from '../lib/savedMatches'
import WhereToWatch from './WhereToWatch'
import { generateShareImage, downloadCanvas } from '../lib/shareImage'
import './MatchModal.css'

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
        emoji: item.emoji || null,
        swipeCount,
        platforms: item.platforms,
        rating: item.rating,
        year: item.year,
      })
      downloadCanvas(canvas, `swaip-${item.title.replace(/\s+/g, '-').toLowerCase()}.png`)
    } catch (err) {
      console.error('Share error:', err)
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="match-overlay">
      <div className="match-modal">
        <div className="celebrate-badge celebrate-badge--heart match-badge">
          <svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </div>
        <h1 className="match-title">It's a Match!</h1>
        <p className="match-subtitle">You both swiped right</p>

        <div className="match-card">
          {item.poster ? (
            <img src={item.poster} alt={item.title} className="match-poster" />
          ) : (
            <div className="match-poster match-poster-placeholder">
              {item.emoji || (roomType === 'series' ? '📺' : '🎬')}
            </div>
          )}
          <h2 className="match-item-title">{item.title}</h2>
          {(item.year || item.rating) && (
            <p className="match-meta">
              {item.year}{item.rating ? ` · ⭐ ${item.rating}` : ''}
            </p>
          )}
          <WhereToWatch platforms={item.platforms} title={item.title} className="wtw--center" />
        </div>

        <div className="match-actions">
          {onContinue && (
            <button className="btn btn-primary" onClick={onContinue}>
              Keep Swiping
            </button>
          )}
          <button className="btn btn-secondary" onClick={onDone}>
            I'm Done
          </button>
          <button className="match-share-btn" onClick={handleShare} disabled={sharing}>
            {sharing ? 'Generating…' : '📸 Share'}
          </button>
        </div>
      </div>
    </div>
  )
}
