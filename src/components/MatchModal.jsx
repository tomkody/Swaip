import { useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { saveMatch } from '../lib/savedMatches'
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
        <span className="match-emoji">🎉</span>
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
