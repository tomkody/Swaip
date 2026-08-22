import { useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { saveMatch } from '../lib/savedMatches'
import WhereToWatch from './WhereToWatch'
import { generateShareImage, downloadCanvas } from '../lib/shareImage'
import './MatchModal.css'

// Rotating celebration copy so the 5th match doesn't read like the 1st.
const MATCH_TITLES = ['Another match!', 'Two great minds!', "You're on a roll!", 'Snap — matched again!', 'So in sync!']
const MATCH_SUBS = [
  'Add it to tonight\'s shortlist',
  'You both swiped right',
  'One more you both want',
  'Keep going — or lock it in',
  'Your taste lines up',
]

export default function MatchModal({ item, roomType, swipeCount = 0, matchCount = 1, onContinue, onDone }) {
  const hasConfettied = useRef(false)
  const hasSaved = useRef(false)
  const [sharing, setSharing] = useState(false)

  // 1-based position of this match. First match gets the full treatment;
  // later ones rotate through fresh copy and a lighter confetti burst.
  const n = Math.max(1, matchCount)
  const isFirst = n === 1
  const title = isFirst ? "It's a Match!" : `${MATCH_TITLES[(n - 2) % MATCH_TITLES.length]} · #${n}`
  const subtitle = isFirst ? 'You both swiped right' : MATCH_SUBS[(n - 2) % MATCH_SUBS.length]
  const isPlace = roomType === 'food' || roomType === 'activities'

  useEffect(() => {
    if (!hasConfettied.current) {
      hasConfettied.current = true
      const end = Date.now() + (isFirst ? 1500 : 700) // shorter burst on repeats
      const count = isFirst ? 3 : 2
      const colors = ['#ff6b6b', '#ee5a24', '#2ecc71', '#f1c40f', '#9b59b6']
      function frame() {
        confetti({ particleCount: count, angle: 60,  spread: 55, origin: { x: 0 }, colors })
        confetti({ particleCount: count, angle: 120, spread: 55, origin: { x: 1 }, colors })
        if (Date.now() < end) requestAnimationFrame(frame)
      }
      frame()
    }
  }, [isFirst])

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
        <h1 className="match-title">{title}</h1>
        <p className="match-subtitle">{subtitle}</p>

        <div className="match-card">
          {item.poster ? (
            <img src={item.poster} alt={item.title} className={`match-poster ${isPlace ? 'match-poster--wide' : 'match-poster--portrait'}`} />
          ) : (
            <div className={`match-poster match-poster-placeholder ${isPlace ? 'match-poster--wide' : 'match-poster--portrait'}`}>
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
