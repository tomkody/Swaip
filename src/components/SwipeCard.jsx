import { useRef, useState, useEffect } from 'react'
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
  const [gettingLocation, setGettingLocation] = useState(false)

  // ── Keyboard shortcuts (← nope, → like) ──────────────────────────
  useEffect(() => {
    if (!active) return
    function onKey(e) {
      if (isLeavingRef.current) return
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowLeft')  swipeVia('left')
      if (e.key === 'ArrowRight') swipeVia('right')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Directions ────────────────────────────────────────────────────
  function handleDirections(e) {
    e.stopPropagation()
    const dest = `${item.lat},${item.lng}`
    const base = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=walking`

    if (!navigator.geolocation) {
      window.open(base, '_blank', 'noopener,noreferrer')
      return
    }

    setGettingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGettingLocation(false)
        const origin = `${pos.coords.latitude},${pos.coords.longitude}`
        window.open(`${base}&origin=${origin}`, '_blank', 'noopener,noreferrer')
      },
      () => {
        setGettingLocation(false)
        window.open(base, '_blank', 'noopener,noreferrer')
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    )
  }

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
              {item.isOpen != null && (
                <div className="card-open-row">
                  <span className={`card-open-badge ${item.isOpen ? 'card-open-badge--open' : 'card-open-badge--closed'}`}>
                    {item.isOpen ? '● Open' : '● Closed'}
                  </span>
                  {item.isOpen === true && item.closesAt && (
                    <span className="card-open-hours">until {item.closesAt}</span>
                  )}
                  {item.isOpen === true && !item.closesAt && item.todayHours === 'Open 24 hours' && (
                    <span className="card-open-hours">24 hours</span>
                  )}
                  {item.isOpen === false && item.opensAt && (
                    <span className="card-open-hours">Opens {item.opensAt}</span>
                  )}
                </div>
              )}
              <h2 className="card-title">{item.title}</h2>
              <p className="card-flip-hint">Tap for details</p>
            </div>
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
                    {item.ratingCount
                      ? <span className="card-back-max"> ({item.ratingCount.toLocaleString()} reviews)</span>
                      : <span className="card-back-max"> / 10</span>}
                  </div>
                )}

                <div className="card-back-tags">
                  {item.year && <span className="card-back-tag">{item.year}</span>}
                  {item.runtime && <span className="card-back-tag">{item.runtime}</span>}
                  {item.isOpen === true  && (
                    <span className="card-back-tag card-back-tag--open">
                      ● Open{item.closesAt ? ` · until ${item.closesAt}` : item.todayHours === 'Open 24 hours' ? ' 24h' : ''}
                    </span>
                  )}
                  {item.isOpen === false && item.isOpen != null && (
                    <span className="card-back-tag card-back-tag--closed">
                      ● Closed{item.opensAt ? ` · opens ${item.opensAt}` : ''}
                    </span>
                  )}
                  {item.genre && item.genre.split(' · ').map(g => (
                    <span key={g} className="card-back-tag">{g}</span>
                  ))}
                </div>

                {item.distance && <p className="card-back-distance">📍 {item.distance}</p>}

                <p className="card-back-overview">
                  {item.overview || 'No description available.'}
                </p>

                {item.lat && item.lng && (
                  <button
                    className="card-back-directions"
                    onClick={handleDirections}
                    disabled={gettingLocation}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                    </svg>
                    {gettingLocation ? 'Getting location…' : 'Get walking directions'}
                  </button>
                )}

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
          <span>Like →</span>
        </div>
      )}
    </div>
  )
}
