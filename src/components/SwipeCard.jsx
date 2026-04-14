import { useRef, useState } from 'react'
import './SwipeCard.css'

const SWIPE_THRESHOLD = 100
const ROTATION_FACTOR = 0.15

export default function SwipeCard({ item, onSwipe, active }) {
  const cardRef = useRef(null)
  const startPos = useRef({ x: 0, y: 0 })
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [leaving, setLeaving] = useState(null)

  function handleStart(e) {
    if (!active) return
    const point = e.touches ? e.touches[0] : e
    startPos.current = { x: point.clientX, y: point.clientY }
    setDragging(true)
  }

  function handleMove(e) {
    if (!dragging) return
    const point = e.touches ? e.touches[0] : e
    const dx = point.clientX - startPos.current.x
    const dy = point.clientY - startPos.current.y
    setOffset({ x: dx, y: dy })
  }

  function handleEnd() {
    if (!dragging) return
    setDragging(false)

    if (Math.abs(offset.x) > SWIPE_THRESHOLD) {
      const direction = offset.x > 0 ? 'right' : 'left'
      setLeaving(direction)
      setTimeout(() => onSwipe(direction), 300)
    } else {
      setOffset({ x: 0, y: 0 })
    }
  }

  // Allow button-based swiping
  function swipeVia(direction) {
    if (!active) return
    setLeaving(direction)
    setTimeout(() => onSwipe(direction), 300)
  }

  const rotation = offset.x * ROTATION_FACTOR
  const opacity = Math.max(0, 1 - Math.abs(offset.x) / 400)

  const style = leaving
    ? {
        transform: `translateX(${leaving === 'right' ? 600 : -600}px) rotate(${leaving === 'right' ? 30 : -30}deg)`,
        opacity: 0,
        transition: 'transform 0.3s ease, opacity 0.3s ease',
      }
    : {
        transform: `translateX(${offset.x}px) translateY(${offset.y * 0.3}px) rotate(${rotation}deg)`,
        transition: dragging ? 'none' : 'transform 0.3s ease',
      }

  const rightIndicatorOpacity = Math.max(0, Math.min(1, offset.x / SWIPE_THRESHOLD))
  const leftIndicatorOpacity = Math.max(0, Math.min(1, -offset.x / SWIPE_THRESHOLD))

  return (
    <div className="swipe-card-wrapper">
      <div
        ref={cardRef}
        className={`swipe-card ${active ? 'active' : ''}`}
        style={style}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={() => dragging && handleEnd()}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      >
        <div className="swipe-indicator like" style={{ opacity: rightIndicatorOpacity }}>
          YES
        </div>
        <div className="swipe-indicator nope" style={{ opacity: leftIndicatorOpacity }}>
          NOPE
        </div>

        {item.poster ? (
          <img src={item.poster} alt={item.title} className="card-poster" draggable={false} />
        ) : (
          <div className="card-poster card-poster-placeholder">
            <span className="placeholder-icon">🎬</span>
          </div>
        )}

        <div className="card-info">
          <div className="card-meta">
            {item.year && <span className="card-year">{item.year}</span>}
            {item.rating && <span className="card-rating">★ {item.rating}</span>}
            {item.runtime && <span className="card-runtime">{item.runtime}</span>}
          </div>
          {item.genre && <p className="card-genre">{item.genre}</p>}
          <h2 className="card-title">{item.title}</h2>
          <p className="card-overview">{item.overview}</p>
        </div>
      </div>

      {active && (
        <div className="swipe-buttons">
          <button className="swipe-btn nope-btn" onClick={() => swipeVia('left')} aria-label="Nope">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <button className="swipe-btn like-btn" onClick={() => swipeVia('right')} aria-label="Like">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>
      )}

      {active && (
        <div className="swipe-hint">
          <span>← Nope</span>
          <span>Like →</span>
        </div>
      )}
    </div>
  )
}
