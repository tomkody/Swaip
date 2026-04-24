import { useState, useEffect, useRef, useCallback } from 'react'
import confetti from 'canvas-confetti'
import { ACTIVITY_CATEGORIES as _ACTIVITY_CATEGORIES } from '../lib/activities'

// Seeded shuffle — same order for everyone in the same room, different per room
function seededShuffle(arr, seed) {
  const a = [...arr]
  let h = 0x9E3779B9
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 0x9E3779B9)
    h ^= h >>> 15
  }
  let t = (h >>> 0) + 0x6D2B79F5
  function rng() {
    t = (t + 0x6D2B79F5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
import { fetchNearbyPlaces } from '../lib/placesApi'
import {
  getUserToken,
  recordSwipe,
  subscribeToSwipes,
  updateActivityRoomPhase,
  subscribeToRoomChanges,
  getRoom,
  fetchRoomMatches,
} from '../lib/room'
import SwipeCard from './SwipeCard'
import './ActivityRoom.css'

// Parse location data from topic_id field
function parseLocation(topicId) {
  if (!topicId) return null
  try { return JSON.parse(topicId) } catch { return null }
}

// Parse phase/places/matched_category from room row.
// Primary storage: _phase/_matched_category/_places packed into topic_id JSON
// (works without custom DB columns).
// Fallback: dedicated room.phase / room.matched_category / room.places columns
// (used if the DB migration has been run).
function parseRoomActivityData(room) {
  // Try topic_id first (no custom columns needed)
  let topicData = {}
  try { topicData = JSON.parse(room.topic_id || '{}') } catch { topicData = {} }

  const phase = topicData._phase || room.phase || 'categories'

  let matchedCategory = topicData._matched_category || null
  if (!matchedCategory && room.matched_category) {
    try { matchedCategory = JSON.parse(room.matched_category) } catch {}
  }

  let places = topicData._places || []
  if (places.length === 0 && room.places) {
    try { places = JSON.parse(room.places) } catch {}
  }

  return { phase, matchedCategory, places }
}

// ─── Category Card ────────────────────────────────────────────────────────────

function CategoryCard({ category, onSwipe, active, offset, dragging, leaving }) {
  const cardRef = useRef(null)
  const startPos = useRef({ x: 0, y: 0 })
  const isDraggingRef = useRef(false)
  const hasMoved = useRef(false)
  const isLeavingRef = useRef(false)
  const currentOffset = useRef({ x: 0, y: 0 })

  const [localOffset, setLocalOffset] = useState({ x: 0, y: 0 })
  const [localDragging, setLocalDragging] = useState(false)
  const [localLeaving, setLocalLeaving] = useState(null)

  function handleStart(e) {
    if (!active) return
    const point = e.touches ? e.touches[0] : e
    startPos.current = { x: point.clientX, y: point.clientY }
    hasMoved.current = false
    currentOffset.current = { x: 0, y: 0 }
    isDraggingRef.current = true
    setLocalDragging(true)
  }

  function handleMove(e) {
    if (!isDraggingRef.current) return
    const point = e.touches ? e.touches[0] : e
    const dx = point.clientX - startPos.current.x
    const dy = point.clientY - startPos.current.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    currentOffset.current = { x: dx, y: dy }
    if (dist > 30) {
      hasMoved.current = true
      setLocalOffset({ x: dx, y: dy })
    }
  }

  function handleEnd() {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    setLocalDragging(false)
    const ox = currentOffset.current.x
    if (Math.abs(ox) > 100) {
      isLeavingRef.current = true
      const direction = ox > 0 ? 'right' : 'left'
      setLocalLeaving(direction)
      setTimeout(() => onSwipe(direction), 300)
    } else {
      setLocalOffset({ x: 0, y: 0 })
      currentOffset.current = { x: 0, y: 0 }
    }
  }

  function swipeVia(direction) {
    if (!active) return
    isLeavingRef.current = true
    setLocalLeaving(direction)
    setTimeout(() => onSwipe(direction), 300)
  }

  const ROTATION_FACTOR = 0.15
  const rotation = localOffset.x * ROTATION_FACTOR
  const cardStyle = localLeaving
    ? {
        transform: `translateX(${localLeaving === 'right' ? 600 : -600}px) rotate(${localLeaving === 'right' ? 30 : -30}deg)`,
        opacity: 0,
        transition: 'transform 0.3s ease, opacity 0.3s ease',
      }
    : {
        transform: `translateX(${localOffset.x}px) translateY(${localOffset.y * 0.3}px) rotate(${rotation}deg)`,
        transition: localDragging ? 'none' : 'transform 0.3s ease',
      }

  const yesOpacity = Math.max(0, Math.min(1, localOffset.x / 100))
  const nopeOpacity = Math.max(0, Math.min(1, -localOffset.x / 100))

  return (
    <div className="swipe-card-wrapper">
      <div
        ref={cardRef}
        className={`cat-card ${active ? 'active' : ''}`}
        style={{ ...cardStyle, background: category.gradient }}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={() => isDraggingRef.current && handleEnd()}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      >
        <div className="swipe-stamp stamp-yes" style={{ opacity: yesOpacity }}>
          <span>❤️</span> YES
        </div>
        <div className="swipe-stamp stamp-nope" style={{ opacity: nopeOpacity }}>
          NOPE <span>✕</span>
        </div>

        <div className="cat-card-inner">
          <div className="cat-emoji">{category.emoji}</div>
          <h2 className="cat-label">{category.label}</h2>
          <p className="cat-desc">{category.desc}</p>
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

// ─── Main ActivityRoom component ──────────────────────────────────────────────

export default function ActivityRoom({ room, onDone }) {
  const userToken = useRef(getUserToken())
  const location = parseLocation(room.topic_id)

  // Same shuffled order for everyone in this room, different per room
  const ACTIVITY_CATEGORIES = seededShuffle(_ACTIVITY_CATEGORIES, room.id)

  const initialData = parseRoomActivityData(room)
  const [phase, setPhase] = useState(initialData.phase)
  const [matchedCategory, setMatchedCategory] = useState(initialData.matchedCategory)
  const [places, setPlaces] = useState(initialData.places)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [mySwipes, setMySwipes] = useState({}) // itemId → 'yes'|'no'
  const [partnerSwipes, setPartnerSwipes] = useState({}) // itemId → 'yes'|'no'
  const [matches, setMatches] = useState([])
  const [matchItem, setMatchItem] = useState(null)
  const [isDone, setIsDone] = useState(false)

  const [transitioning, setTransitioning] = useState(false)
  const [fetchingPlaces, setFetchingPlaces] = useState(false)
  const [placesError, setPlacesError] = useState(null)
  // Partner (first swiper) sees this while second swiper is fetching places
  const [waitingForPartnerPlaces, setWaitingForPartnerPlaces] = useState(false)

  const hasConfettied = useRef(false)
  const isDoneRef = useRef(false)
  useEffect(() => { isDoneRef.current = isDone }, [isDone])
  // Prevents the first swiper's celebration from firing twice (subscription + poll both may fire)
  const placesTransitionFiredRef = useRef(false)

  // True when this user has swiped all places but isDone hasn't been set yet
  const finishedSwiping = phase === 'places' && places.length > 0 && currentIndex >= places.length && !isDone

  // ── Poll for new matches while waiting for partner to finish ─────────────
  useEffect(() => {
    if (!finishedSwiping) return
    const interval = setInterval(async () => {
      try {
        const ids = await fetchRoomMatches(room.id, userToken.current)
        if (!ids) return
        const canonical = places.filter(p => ids.includes(p.numId))
        if (canonical.length > 0) {
          setMatches(prev => {
            const merged = [...prev]
            for (const p of canonical) {
              if (!merged.find(m => m.id === p.id)) merged.push(p)
            }
            return merged
          })
        }
      } catch (e) { /* non-fatal */ }
    }, 3000)
    return () => clearInterval(interval)
  }, [finishedSwiping, room.id, places]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Authoritative matches from DB when results screen opens ──────────────
  // Real-time events can be missed (network blips, subscription gaps, stale closures).
  // This ensures the results screen always shows every mutual match that's in the DB.
  useEffect(() => {
    const showingResults =
      isDone || (phase === 'places' && places.length > 0 && currentIndex >= places.length)
    if (!showingResults || places.length === 0) return

    fetchRoomMatches(room.id, userToken.current)
      .then(ids => {
        if (!ids || ids.length === 0) return
        // Map numeric item_ids back to place objects (filters out category numIds automatically)
        const canonical = places.filter(p => ids.includes(p.numId))
        if (canonical.length > 0) {
          setMatches(prev => {
            // Merge: keep real-time matches + add any DB matches that weren't captured
            const merged = [...prev]
            for (const p of canonical) {
              if (!merged.find(m => m.id === p.id)) merged.push(p)
            }
            return merged
          })
        }
      })
      .catch(() => {})
  }, [isDone, currentIndex, places.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Subscribe to partner swipes ───────────────────────────────────────────
  // NOTE: Category matches are handled exclusively via recordSwipe → handleCategoryMatch
  // (the person whose swipe creates the match) and subscribeToRoomChanges (their partner).
  // We do NOT call handleCategoryMatch here to avoid race conditions.
  useEffect(() => {
    const unsub = subscribeToSwipes(room.id, userToken.current, (itemId) => {
      const numId = Number(itemId)
      // Only handle place-phase matches here
      if (phase === 'places') {
        const place = places.find(p => p.numId === numId)
        if (place) {
          setMatches(prev => prev.find(m => m.id === place.id) ? prev : [...prev, place])
          if (!isDoneRef.current) {
            setMatchItem(place)
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } })
          }
        }
      }
    })
    return unsub
  }, [room.id, phase, places]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Subscribe to room data changes (partner fetched places → both transition) ──
  useEffect(() => {
    const unsub = subscribeToRoomChanges(room.id, (updatedRoom) => {
      const data = parseRoomActivityData(updatedRoom)
      if (data.phase === 'places' && phase === 'categories') {
        console.log('[ActivityRoom] Room update → places phase, count:', data.places.length)
        showCelebrationThenPlaces(data)
      }
    })
    return unsub
  }, [room.id, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Polling fallback: check room every 3s while waiting for partner ────────
  useEffect(() => {
    if (phase !== 'categories') return
    const interval = setInterval(async () => {
      try {
        const latest = await getRoom(room.id)
        if (!latest) return
        const data = parseRoomActivityData(latest)
        if (data.phase === 'places') {
          console.log('[ActivityRoom] Poll detected places phase, count:', data.places.length)
          showCelebrationThenPlaces(data)
        }
      } catch (e) { /* non-fatal */ }
    }, 3000)
    return () => clearInterval(interval)
  }, [room.id, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Show "You both want X!" for 2s then switch to places swipe.
  // Used by the FIRST swiper who didn't call handleCategoryMatch themselves.
  function showCelebrationThenPlaces(data) {
    if (placesTransitionFiredRef.current) return // already fired, ignore duplicate events
    placesTransitionFiredRef.current = true
    setMatchedCategory(data.matchedCategory)
    setWaitingForPartnerPlaces(false)
    setTransitioning(true) // shows "You both want X!" screen
    setTimeout(() => {
      setPlaces(data.places)
      setPhase('places')
      setCurrentIndex(0)
      setMySwipes({})
      setPartnerSwipes({})
      setTransitioning(false)
    }, 2200)
  }

  // ── Handle category match ─────────────────────────────────────────────────
  // Called only by the person whose swipe creates the match (recordSwipe returns true).
  // Their partner transitions via subscribeToRoomChanges instead.
  const handleCategoryMatch = useCallback(async (cat) => {
    if (transitioning || phase !== 'categories') return
    setTransitioning(true)
    setMatchedCategory(cat)
    setPlacesError(null)

    // Show "You both want X!" screen for 2s
    await new Promise(r => setTimeout(r, 2000))
    setFetchingPlaces(true)

    let fetchedPlaces = []
    if (location?.lat != null) {
      try {
        console.log('[ActivityRoom] Fetching places for', cat.label, 'at', location.lat, location.lng, 'radius', location.radius || 5000)
        fetchedPlaces = await fetchNearbyPlaces(
          location.lat,
          location.lng,
          location.radius || 5000,
          cat.types,
          room.id
        )
        console.log('[ActivityRoom] Fetched', fetchedPlaces.length, 'places for', cat.label)
      } catch (err) {
        console.error('[ActivityRoom] Places fetch error:', err)
        setPlacesError(err.message || 'Failed to fetch places')
      }
    } else {
      console.warn('[ActivityRoom] No location data — skipping places fetch. location:', location)
    }

    setFetchingPlaces(false)

    // Save to room so partner also gets the places
    try {
      await updateActivityRoomPhase(room.id, {
        phase: 'places',
        matched_category: cat,
        places: fetchedPlaces,
        locationData: location, // preserve lat/lng/radius alongside phase data in topic_id
      })
    } catch (err) {
      console.error('[ActivityRoom] updateActivityRoomPhase error:', err)
    }

    // Read back canonical places from DB — ensures both users see the SAME set
    // (handles the rare race where two users both call handleCategoryMatch simultaneously)
    try {
      const canonical = await getRoom(room.id)
      if (canonical) {
        const canonicalData = parseRoomActivityData(canonical)
        if (canonicalData.places.length > 0) {
          fetchedPlaces = canonicalData.places
        }
      }
    } catch (e) { /* non-fatal, use locally fetched places */ }

    // Transition locally (partner transitions via subscribeToRoomChanges)
    setPlaces(fetchedPlaces)
    setPhase('places')
    setCurrentIndex(0)
    setMySwipes({})
    setPartnerSwipes({})
    setTransitioning(false)
  }, [transitioning, phase, location, room.id])

  // ── Swipe handlers ────────────────────────────────────────────────────────
  const handleCategorySwipe = useCallback(async (direction) => {
    const cat = ACTIVITY_CATEGORIES[currentIndex]
    if (!cat) return

    setMySwipes(prev => ({ ...prev, [cat.id]: direction === 'right' ? 'yes' : 'no' }))
    setCurrentIndex(i => i + 1)

    if (direction !== 'right') return

    try {
      const isMatch = await recordSwipe(room.id, userToken.current, cat.numId, direction)
      if (isMatch) {
        // Before fetching places, check if the DB already has them
        // (partner may have already matched and fetched in a race condition)
        try {
          const latest = await getRoom(room.id)
          if (latest) {
            const latestData = parseRoomActivityData(latest)
            if (latestData.phase === 'places' && latestData.places.length > 0) {
              // Partner already fetched — sync local state from DB instead of fetching again
              setMatchedCategory(latestData.matchedCategory)
              setPlaces(latestData.places)
              setPhase('places')
              setCurrentIndex(0)
              setMySwipes({})
              setPartnerSwipes({})
              setTransitioning(false)
              setWaitingForPartnerPlaces(false)
              return
            }
          }
        } catch (e) { /* non-fatal */ }

        // I'm the (sole) fetcher — fetch places and update room for both of us
        handleCategoryMatch(cat)
      }
      // If not a match yet, partner hasn't swiped this category right yet — just keep swiping.
      // If partner swipes it later, subscribeToRoomChanges will handle the transition.
    } catch (err) {
      console.error('recordSwipe error:', err)
    }
  }, [currentIndex, room.id, handleCategoryMatch])

  const handlePlaceSwipe = useCallback(async (direction) => {
    const place = places[currentIndex]
    if (!place) return

    setCurrentIndex(i => i + 1)

    if (direction !== 'right') return

    try {
      const isMatch = await recordSwipe(room.id, userToken.current, place.numId, direction)
      if (isMatch) {
        setMatchItem(place)
        setMatches(prev => prev.find(m => m.id === place.id) ? prev : [...prev, place])
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } })
      }
    } catch (err) {
      console.error('recordSwipe error:', err)
    }
  }, [places, currentIndex, room.id])

  function handleRetryPlaces() {
    if (!matchedCategory) return
    setPlacesError(null)
    handleCategoryMatch(matchedCategory)
  }

  // ── Waiting for partner to fetch places (first swiper sees this) ──────────
  if (waitingForPartnerPlaces) {
    return (
      <div className="act-center">
        <div className="act-transition">
          <div className="act-transition-emoji">{matchedCategory?.emoji}</div>
          <h2>You both want</h2>
          <h1 className="act-transition-label">{matchedCategory?.label}!</h1>
          <p className="act-transition-sub">Loading places nearby…</p>
          <div className="loader" style={{ marginTop: 20 }} />
        </div>
      </div>
    )
  }

  // ── Transition screen ─────────────────────────────────────────────────────
  if (transitioning) {
    return (
      <div className="act-center">
        <div className="act-transition">
          {fetchingPlaces ? (
            <>
              <div className="act-transition-emoji">{matchedCategory?.emoji}</div>
              <h2>Finding places…</h2>
              <p className="act-transition-sub">Searching nearby {matchedCategory?.label}</p>
              <div className="loader" style={{ marginTop: 20 }} />
            </>
          ) : (
            <>
              <div className="act-transition-emoji">{matchedCategory?.emoji}</div>
              <h2>You both want</h2>
              <h1 className="act-transition-label">{matchedCategory?.label}!</h1>
              <p className="act-transition-sub">Finding places nearby…</p>
              <div className="loader" style={{ marginTop: 20 }} />
            </>
          )}
        </div>
      </div>
    )
  }

  // ── No-location error / places fetch error ────────────────────────────────
  if (phase === 'places' && placesError) {
    return (
      <div className="act-center">
        <div className="act-error">
          <div className="act-error-icon">😕</div>
          <h2>Couldn't load places</h2>
          <p className="act-error-sub">{placesError}</p>
          <button className="btn btn-primary" onClick={handleRetryPlaces}>
            Try again
          </button>
          <button className="btn btn-secondary" style={{ marginTop: 10 }} onClick={onDone}>
            Go home
          </button>
        </div>
      </div>
    )
  }

  // ── Place match modal ─────────────────────────────────────────────────────
  if (matchItem) {
    return (
      <div className="act-match-overlay">
        <div className="act-match-modal">
          <span className="act-match-emoji-big">🎉</span>
          <h1>It's a Match!</h1>
          <p className="act-match-subtitle">You both want to go here</p>

          <div className="act-match-card">
            {matchItem.poster ? (
              <img src={matchItem.poster} alt={matchItem.title} className="act-match-img" />
            ) : (
              <div className="act-match-img-placeholder">{matchedCategory?.emoji || '📍'}</div>
            )}
            <div className="act-match-info">
              <h2>{matchItem.title}</h2>
              {matchItem.rating && <p className="act-match-rating">★ {matchItem.rating}</p>}
              {matchItem.address && <p className="act-match-address">{matchItem.address}</p>}
            </div>
          </div>

          <div className="act-match-actions">
            {currentIndex < places.length ? (
              <button className="btn btn-primary" onClick={() => setMatchItem(null)}>
                Keep Swiping
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => { setMatchItem(null); setIsDone(true) }}>
                See All Matches
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => { setMatchItem(null); setIsDone(true) }}>
              See All Matches
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Place swipe (no places available) ─────────────────────────────────────
  if (phase === 'places' && places.length === 0) {
    return (
      <div className="act-center">
        <div className="act-error">
          <div className="act-error-icon">{matchedCategory?.emoji || '📍'}</div>
          <h2>No places found</h2>
          <p className="act-error-sub">
            We couldn't find any {matchedCategory?.label || 'places'} nearby.
            {!location ? ' Add a location when creating the room to see real nearby places.' : ' Try a larger search radius.'}
          </p>
          <button className="btn btn-secondary" onClick={onDone}>Go home</button>
        </div>
      </div>
    )
  }

  // ── Waiting for partner to finish swiping places ─────────────────────────
  if (finishedSwiping) {
    return (
      <div className="act-center">
        <div className="act-waiting">
          <div className="act-waiting-icon">⏳</div>
          <h2>Waiting for your partner…</h2>
          <p className="act-waiting-text">
            You've swiped through all {places.length} places.
            {matches.length > 0
              ? ` You've already matched on ${matches.length} place${matches.length !== 1 ? 's' : ''}!`
              : ' Waiting to see if you agree on any…'}
          </p>
          <div className="loader" style={{ margin: '16px auto' }} />
          {matches.length > 0 && (
            <div className="act-waiting-matches">
              {matches.map(p => (
                <div key={p.id} className="act-waiting-match-item">
                  {p.poster
                    ? <img src={p.poster} alt={p.title} className="act-waiting-match-thumb" />
                    : <div className="act-waiting-match-thumb act-waiting-match-thumb--empty">{matchedCategory?.emoji || '📍'}</div>}
                  <span className="act-waiting-match-name">{p.title}</span>
                </div>
              ))}
            </div>
          )}
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 20 }}
            onClick={() => setIsDone(true)}
          >
            See results now
          </button>
        </div>
      </div>
    )
  }

  // ── Results screen ─────────────────────────────────────────────────────────
  if (isDone) {
    return (
      <div className="act-results">
        <div className="act-results-inner">
          {matches.length > 0 ? (
            <>
              <div className="act-results-icon">🎊</div>
              <h2 className="act-results-title">Your matches!</h2>
              <p className="act-results-sub">
                You both agreed on {matches.length} place{matches.length !== 1 ? 's' : ''}
                {matchedCategory ? ` for ${matchedCategory.label}` : ''}.
              </p>
              <div className="act-results-list">
                {matches.map(place => (
                  <div key={place.id} className="act-result-item">
                    {place.poster ? (
                      <img src={place.poster} alt={place.title} className="act-result-img" />
                    ) : (
                      <div className="act-result-img-placeholder">{matchedCategory?.emoji || '📍'}</div>
                    )}
                    <div className="act-result-info">
                      <div className="act-result-title">{place.title}</div>
                      {place.rating && (
                        <div className="act-result-rating">★ {place.rating}{place.ratingCount ? ` (${place.ratingCount.toLocaleString()})` : ''}</div>
                      )}
                      <div className="act-result-meta-row">
                        {place.isOpen === true && <span className="act-result-open">● Open now</span>}
                        {place.isOpen === false && <span className="act-result-closed">● Closed</span>}
                        {place.distance && <span className="act-result-distance">{place.distance}</span>}
                      </div>
                      {place.address && <div className="act-result-address">{place.address}</div>}
                      {place.lat && place.lng && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}&travelmode=walking`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="act-result-directions"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                          </svg>
                          Get walking directions
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="act-results-icon">😅</div>
              <h2 className="act-results-title">No matches</h2>
              <p className="act-results-sub">
                You didn't agree on any{matchedCategory ? ` ${matchedCategory.label}` : ''} places this time.
              </p>
            </>
          )}
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 24 }} onClick={onDone}>
            Go home
          </button>
        </div>
      </div>
    )
  }

  // ── All categories swiped but no match ─────────────────────────────────────
  if (phase === 'categories' && currentIndex >= ACTIVITY_CATEGORIES.length) {
    return (
      <div className="act-center">
        <div className="act-waiting">
          <div className="act-waiting-icon">⏳</div>
          <h2>Waiting for a match…</h2>
          <p className="act-waiting-text">
            You've swiped through all categories. Waiting for your partner to match one with you.
          </p>
          <div className="loader" />
        </div>
      </div>
    )
  }

  // ── Category swipe UI ─────────────────────────────────────────────────────
  if (phase === 'categories') {
    const current = ACTIVITY_CATEGORIES[currentIndex]
    return (
      <div className="act-room">
        <div className="act-header">
          <span className="act-phase-label">🎯 Choose a category</span>
          <span className="act-progress">{currentIndex + 1} / {ACTIVITY_CATEGORIES.length}</span>
        </div>

        <div className="act-cards">
          <CategoryCard
            key={current.id}
            category={current}
            onSwipe={handleCategorySwipe}
            active
          />
        </div>

        <div className="act-footer">
          <p className="act-footer-hint">Swipe right on categories you'd enjoy</p>
        </div>
      </div>
    )
  }

  // ── Place swipe UI ────────────────────────────────────────────────────────
  const currentPlace = places[currentIndex]
  return (
    <div className="act-room">
      <div className="act-header">
        <span className="act-phase-label">
          {matchedCategory?.emoji} {matchedCategory?.label}
        </span>
        <div className="act-header-right">
          {matches.length > 0 && (
            <span className="act-match-count">{matches.length} match{matches.length !== 1 ? 'es' : ''}</span>
          )}
          <span className="act-progress">{currentIndex + 1} / {places.length}</span>
        </div>
      </div>

      <div className="act-cards">
        <SwipeCard
          key={currentPlace.id}
          item={currentPlace}
          onSwipe={handlePlaceSwipe}
          active
        />
      </div>

      <div className="act-footer">
        <button className="done-early-btn" onClick={() => setIsDone(true)}>
          I'm done swiping{matches.length > 0 ? ` · ${matches.length} match${matches.length !== 1 ? 'es' : ''}` : ''}
        </button>
      </div>
    </div>
  )
}
