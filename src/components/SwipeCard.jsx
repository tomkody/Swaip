import { useRef, useState } from 'react'
import './SwipeCard.css'

const SWIPE_THRESHOLD = 100
const ROTATION_FACTOR = 0.15
const DRAG_MIN_MOVE = 30  // px — below this the card never moves (pure tap zone)

export default function SwipeCard({ item, onSwipe, active }) {
  const cardRef = useRef(null)
  const startPos = useRef({ x: 0, y: 0 })
  const isDraggingRef = useRef(false)
  const hasMoved = useRef(false)       // true once finger moves > 30 px
  const isLeavingRef = useRef(false)   // true once a swipe is committed
  const currentOffset = useRef({ x: 0, y: 0 })

  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [leaving, setLeaving] = useState(null)
  const [flipped, setFlipped] = useState(false)

  // ── Drag handlers (swipe detection only) ──────────────────────────

  function handleStart(e) {
    if (!active) return
    const point = e.touches ? e.touches[0] : e
    startPos.current = { x: point.clientX, y: point.clientY }
    hasMoved.current = false
    currentOffset.current = { x: 0, y: 0 }
    isDraggingRef.current = true
    setDragging(true)
  }

  function handleMove(e) {
    if (!isDraggingRef.current) return
    const point = e.touches ? e.touches[0] : e
    const dx = point.clientX - startPos.current.x
    const dy = point.clientY - startPos.current.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    // Always keep position ref up to date
    currentOffset.current = { x: dx, y: dy }

    if (dist > DRAG_MIN_MOVE) {
      // Confirmed drag — now show visual movement
      hasMoved.current = true
      if (flipped) setFlipped(false)
      setOffset({ x: dx, y: dy })
    }
    // Below threshold: card stays perfectly still (no wibble)
  }

  function handleEnd() {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    setDragging(false)

    const ox = currentOffset.current.x

    if (Math.abs(ox) > SWIPE_THRESHOLD) {
      // Genuine swipe — commit before the browser can fire a click
      isLeavingRef.current = true
      const direction = ox > 0 ? 'right' : 'left'
      setLeaving(direction)
      setTimeout(() => onSwipe(direction), 300)
    } else {
      // Snap back (covers both taps and short drags)
      setOffset({ x: 0, y: 0 })
      currentOffset.current = { x: 0, y: 0 }
    }
  }

  // ── Tap = flip (handled by browser's native click detection) ───────

  function handleClick() {
    if (!active) return
    if (isLeavingRef.current) return  // card is flying off
    if (hasMoved.current) return      // was a drag, not a tap
    setFlipped(f => !f)
  }

  // ── Button swipe ──────────────────────────────────────────────────

  function swipeVia(direction) {
    if (!active) return
    setFlipped(false)
    isLeavingRef.current = true
    setLeaving(direction)
    setTimeout(() => onSwipe(direction), 300)
  }

  // ── Render ────────────────────────────────────────────────────────

  const rotation = offset.x * ROTATION_FACTOR
  const cardStyle = leaving
    ? {
        transform: `translateX(${leaving === 'right' ? 600 : -600}px) rotate(${leaving === 'right' ? 30 : -30}deg)`,
        opacity: 0,
        transition: 'transform 0.3s ease, opacity 0.3s ease',
      }
    : {
        transform: `translateX(${offset.x}px) translateY(${offset.y * 0.3}px) rotate(${rotation}deg)`,
        transition: dragging ? 'none' : 'transform 0.3s ease',
      }

  const yesOpacity = Math.max(0, Math.min(1, offset.x / SWIPE_THRESHOLD))
  const nopeOpacity = Math.max(0, Math.min(1, -offset.x / SWIPE_THRESHOLD))

  return (
    <div className="swipe-card-wrapper">
      <div
        ref={cardRef}
        className={`swipe-card ${active ? 'active' : ''}`}
        style={cardStyle}
        onClick={handleClick}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={() => isDraggingRef.current && handleEnd()}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      >
        {/* ── Stamp overlays ── */}
        <div className="swipe-stamp stamp-yes" style={{ opacity: yesOpacity }}>
          <span>❤️</span> YES
        </div>
        <div className="swipe-stamp stamp-nope" style={{ opacity: nopeOpacity }}>
          NOPE <span>✕</span>
        </div>

        {/* ── Flip container ── */}
        <div className={`card-flip-inner ${flipped ? 'is-flipped' : ''}`}>

          {/* FRONT */}
          <div className="card-face card-front">
            {item.poster ? (
              <img src={item.poster} alt={item.title} className="card-poster" draggable={false} />
            ) : (
              <div className="card-poster card-poster-placeholder">
                <span className="placeholder-icon">{item.emoji || '🎬'}</span>
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
            </div>
            <div className="card-flip-hint">Tap for details</div>
          </div>

          {/* BACK */}
          <div className="card-face card-back">
            <div className="card-back-inner">
              {item.poster && (
                <img src={item.poster} alt="" className="card-back-bg" draggable={false} />
              )}
              <div className="card-back-content">
                <h2 className="card-back-title">{item.title}</h2>

                {item.rating && (
                  <div className="card-back-rating">
                    <span className="card-back-star">⭐</span>
                    <span className="card-back-score">{item.rating}</span>
                    <span className="card-back-max"> / 10</span>
                  </div>
                )}

                <div className="card-back-tags">
                  {item.year && <span className="card-back-tag">{item.year}</span>}
                  {item.runtime && <span className="card-back-tag">{item.runtime}</span>}
                  {item.genre && item.genre.split(' · ').map(g => (
                    <span key={g} className="card-back-tag">{g}</span>
                  ))}
                </div>

                <p className="card-back-overview">
                  {item.overview || 'No description available.'}
                </p>

                <p className="card-back-hint">Tap to flip back</p>
              </div>
            </div>
          </div>

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
          <span className="swipe-hint-tap">↕ tap to flip</span>
          <span>Like →</span>
        </div>
      )}
    </div>
  )
}
