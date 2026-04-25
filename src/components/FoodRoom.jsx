import { useState, useEffect, useRef, useCallback } from 'react'
import confetti from 'canvas-confetti'
import { FOOD_CATEGORIES } from '../lib/foodCategories'
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
import RankingView from './RankingView'
import './ActivityRoom.css'

const FOOD_CAT_DONE_NUMID = 2999

// ── Seeded shuffle — same order for both users in the same room ──────────────
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

// ── Parse location data from topic_id ────────────────────────────────────────
function parseLocation(topicId) {
  if (!topicId) return null
  try { return JSON.parse(topicId) } catch { return null }
}

// ── Parse phase/places/matched_categories from room row ──────────────────────
function parseRoomFoodData(room) {
  let topicData = {}
  try { topicData = JSON.parse(room.topic_id || '{}') } catch {}
  const phase = topicData._phase || 'categories'
  const matchedCategories = topicData._matched_categories ||
    (topicData._matched_category ? [topicData._matched_category] : [])
  const places = topicData._places || []
  return { phase, matchedCategories, places }
}

// ─── Category Card ────────────────────────────────────────────────────────────

function CategoryCard({ category, onSwipe, active }) {
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

// ─── Main FoodRoom component ──────────────────────────────────────────────────

export default function FoodRoom({ room, onDone }) {
  const userToken = useRef(getUserToken())
  const location = parseLocation(room.topic_id)

  // Same shuffled order for everyone in this room
  const FOOD_CATS = seededShuffle(FOOD_CATEGORIES, room.id)

  const initialData = parseRoomFoodData(room)
  const [phase, setPhase] = useState(initialData.phase)
  const [matchedCategories, setMatchedCategories] = useState(initialData.matchedCategories)
  const [places, setPlaces] = useState(initialData.places)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [matches, setMatches] = useState([])
  const [matchItem, setMatchItem] = useState(null)
  const [isDone, setIsDone] = useState(false)

  const [transitioning, setTransitioning] = useState(false)
  const [fetchingPlaces, setFetchingPlaces] = useState(false)
  const [placesError, setPlacesError] = useState(null)
  const [waitingForPartner, setWaitingForPartner] = useState(false)

  const isDoneRef = useRef(false)
  const placesTransitionFiredRef = useRef(false)
  const pendingSwipesRef = useRef([])
  const likedCatIdsRef = useRef(new Set())

  useEffect(() => { isDoneRef.current = isDone }, [isDone])

  const finishedSwiping = phase === 'places' && places.length > 0 && currentIndex >= places.length && !isDone

  // ── Poll for matches while waiting for partner ────────────────────────────
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
      } catch { /* non-fatal */ }
    }, 3000)
    return () => clearInterval(interval)
  }, [finishedSwiping, room.id, places]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Authoritative match fetch when results screen opens ──────────────────
  useEffect(() => {
    const showingResults = isDone || (phase === 'places' && places.length > 0 && currentIndex >= places.length)
    if (!showingResults || places.length === 0) return
    fetchRoomMatches(room.id, userToken.current)
      .then(ids => {
        if (!ids || ids.length === 0) return
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
      })
      .catch(() => {})
  }, [isDone, currentIndex, places.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Subscribe to partner place swipes ────────────────────────────────────
  useEffect(() => {
    const unsub = subscribeToSwipes(room.id, userToken.current, (itemId) => {
      const numId = Number(itemId)
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

  // ── fetchAndTransitionToPlaces ────────────────────────────────────────────
  const fetchAndTransitionToPlaces = useCallback(async (matchedCats) => {
    if (placesTransitionFiredRef.current) return
    placesTransitionFiredRef.current = true
    setMatchedCategories(matchedCats)
    setTransitioning(true)
    setFetchingPlaces(true)

    let allPlaces = []
    if (location?.lat != null && matchedCats.length > 0) {
      const seenIds = new Set()
      for (const cat of matchedCats) {
        try {
          const fetched = await fetchNearbyPlaces(location.lat, location.lng, location.radius || 5000, cat.types, room.id)
          for (const p of fetched) {
            if (!seenIds.has(p.id)) { seenIds.add(p.id); allPlaces.push(p) }
          }
        } catch (err) { console.error('[FoodRoom] fetch error for', cat.label, err) }
      }
    }

    setFetchingPlaces(false)

    try {
      await updateActivityRoomPhase(room.id, { phase: 'places', matched_categories: matchedCats, places: allPlaces, locationData: location })
    } catch (err) { console.error('[FoodRoom] updateActivityRoomPhase error:', err) }

    // Read canonical places from DB
    try {
      const canonical = await getRoom(room.id)
      if (canonical) {
        const data = parseRoomFoodData(canonical)
        if (data.places.length > 0) allPlaces = data.places
      }
    } catch {}

    setPlaces(allPlaces)
    setPhase('places')
    setCurrentIndex(0)
    setTransitioning(false)
    setWaitingForPartner(false)
  }, [location, room.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── handleCategoriesDone (sentinel logic) ────────────────────────────────
  const handleCategoriesDone = useCallback(async () => {
    setWaitingForPartner(true)
    try {
      // Wait for all pending category swipes to reach DB before sending sentinel
      await Promise.all(pendingSwipesRef.current)
      pendingSwipesRef.current = []

      const isBothDone = await recordSwipe(room.id, userToken.current, FOOD_CAT_DONE_NUMID, 'right')
      if (isBothDone) {
        // I'm second to finish — fetch all matched categories from DB authoritatively
        const allMatchIds = await fetchRoomMatches(room.id, userToken.current)
        const matchedCats = FOOD_CATS.filter(c => allMatchIds?.includes(c.numId))
        await fetchAndTransitionToPlaces(matchedCats)
      }
      // else: I'm first — wait for partner via subscribeToRoomChanges/polling
    } catch (err) {
      console.error('[FoodRoom] handleCategoriesDone error:', err)
      setWaitingForPartner(false)
    }
  }, [room.id, FOOD_CATS, fetchAndTransitionToPlaces]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── handleCategorySwipe (no early exit, collect pending swipes) ──────────
  const handleCategorySwipe = useCallback(async (direction) => {
    const cat = FOOD_CATS[currentIndex]
    if (!cat) return
    const newIndex = currentIndex + 1
    setCurrentIndex(newIndex)

    if (direction === 'right') {
      likedCatIdsRef.current.add(cat.numId)
      const promise = recordSwipe(room.id, userToken.current, cat.numId, direction).catch(console.error)
      pendingSwipesRef.current.push(promise)
    }

    if (newIndex >= FOOD_CATS.length) {
      handleCategoriesDone()
    }
  }, [currentIndex, room.id, FOOD_CATS, handleCategoriesDone]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Subscribe to room changes (detect partner fetched places) ────────────
  useEffect(() => {
    const unsub = subscribeToRoomChanges(room.id, (updatedRoom) => {
      const data = parseRoomFoodData(updatedRoom)
      if (data.phase === 'places' && phase === 'categories') {
        if (placesTransitionFiredRef.current) return
        placesTransitionFiredRef.current = true
        setMatchedCategories(data.matchedCategories)
        setTransitioning(true)
        // Brief celebration, then show places
        setTimeout(() => {
          setPlaces(data.places)
          setPhase('places')
          setCurrentIndex(0)
          setTransitioning(false)
          setWaitingForPartner(false)
        }, 2200)
      }
    })
    return unsub
  }, [room.id, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Polling fallback ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'categories') return
    const interval = setInterval(async () => {
      try {
        const latest = await getRoom(room.id)
        if (!latest) return
        const data = parseRoomFoodData(latest)
        if (data.phase === 'places' && !placesTransitionFiredRef.current) {
          placesTransitionFiredRef.current = true
          setMatchedCategories(data.matchedCategories)
          setPlaces(data.places)
          setPhase('places')
          setCurrentIndex(0)
          setWaitingForPartner(false)
          setTransitioning(false)
        }
      } catch {}
    }, 3000)
    return () => clearInterval(interval)
  }, [room.id, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Swipe a restaurant ────────────────────────────────────────────────────
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

  // ── Results → RankingView ─────────────────────────────────────────────────
  if (isDone) {
    // Normalize places: use numId as id so RankingView's subscribeToSwipes matching works
    const normalizedPlaces = places.map(p => ({ ...p, id: p.numId }))
    const normalizedMatches = matches.map(p => ({ ...p, id: p.numId }))
    return (
      <RankingView
        matches={normalizedMatches}
        room={room}
        movies={normalizedPlaces}
        onDone={onDone}
      />
    )
  }

  // ── Waiting for partner to finish categories ──────────────────────────────
  if (waitingForPartner && !transitioning) {
    const likedCats = FOOD_CATS.filter(c => likedCatIdsRef.current.has(c.numId))
    return (
      <div className="act-center">
        <div className="act-waiting">
          <div className="act-waiting-icon">⏳</div>
          <h2>Waiting for your partner…</h2>
          <p className="act-waiting-text">You've picked your cuisines. Hang tight!</p>
          {likedCats.length > 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8 }}>
              Your picks: {likedCats.map(c => `${c.emoji} ${c.label}`).join(', ')}
            </p>
          )}
          <div className="loader" style={{ margin: '16px auto' }} />
        </div>
      </div>
    )
  }

  // ── Transition / celebration screen ──────────────────────────────────────
  if (transitioning) {
    return (
      <div className="act-center">
        <div className="act-transition">
          {fetchingPlaces ? (
            <>
              <div className="act-transition-emoji">🔍</div>
              <h2>Finding restaurants…</h2>
              <p className="act-transition-sub">
                Searching for {matchedCategories.map(c => c.label).join(', ')} nearby
              </p>
              <div className="loader" style={{ marginTop: 20 }} />
            </>
          ) : matchedCategories.length > 0 ? (
            <>
              <div className="act-transition-emoji">🎉</div>
              <h2>You matched on {matchedCategories.length} cuisine{matchedCategories.length !== 1 ? 's' : ''}!</h2>
              <p className="act-transition-sub">{matchedCategories.map(c => `${c.emoji} ${c.label}`).join(' · ')}</p>
              <div className="loader" style={{ marginTop: 20 }} />
            </>
          ) : (
            <>
              <div className="act-transition-emoji">😅</div>
              <h2>No cuisine matches</h2>
              <p className="act-transition-sub">You didn't agree on any cuisines. Try creating a new room!</p>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Places fetch error ────────────────────────────────────────────────────
  if (phase === 'places' && placesError) {
    return (
      <div className="act-center">
        <div className="act-error">
          <div className="act-error-icon">😕</div>
          <h2>Couldn't load restaurants</h2>
          <p className="act-error-sub">{placesError}</p>
          <button className="btn btn-secondary" style={{ marginTop: 10 }} onClick={onDone}>Go home</button>
        </div>
      </div>
    )
  }

  // ── Match modal ───────────────────────────────────────────────────────────
  if (matchItem) {
    return (
      <div className="act-match-overlay">
        <div className="act-match-modal">
          <span className="act-match-emoji-big">🎉</span>
          <h1>It's a Match!</h1>
          <p className="act-match-subtitle">You both want to eat here</p>

          <div className="act-match-card">
            {matchItem.poster ? (
              <img src={matchItem.poster} alt={matchItem.title} className="act-match-img" />
            ) : (
              <div className="act-match-img-placeholder">{matchedCategories[0]?.emoji || '🍽️'}</div>
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

  // ── No places found ───────────────────────────────────────────────────────
  if (phase === 'places' && places.length === 0) {
    return (
      <div className="act-center">
        <div className="act-error">
          <div className="act-error-icon">{matchedCategories[0]?.emoji || '🍽️'}</div>
          <h2>No restaurants found</h2>
          <p className="act-error-sub">
            We couldn't find any {matchedCategories.map(c => c.label).join(' or ') || 'restaurants'} nearby.
            {!location ? ' Add a location when creating the room.' : ' Try a larger search radius.'}
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
            You've swiped through all {places.length} restaurants.
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
                    : <div className="act-waiting-match-thumb act-waiting-match-thumb--empty">{matchedCategories[0]?.emoji || '🍽️'}</div>}
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

  // ── No location set ───────────────────────────────────────────────────────
  if (!location) {
    return (
      <div className="act-center">
        <div className="act-error">
          <div className="act-error-icon">📍</div>
          <h2>No location set</h2>
          <p className="act-error-sub">Please create a new room and enter your location.</p>
          <button className="btn btn-primary" onClick={onDone}>Go home</button>
        </div>
      </div>
    )
  }

  // ── Category swipe UI ─────────────────────────────────────────────────────
  if (phase === 'categories') {
    const current = FOOD_CATS[currentIndex]
    return (
      <div className="act-room">
        <div className="act-header">
          <span className="act-phase-label">🍽️ What are you in the mood for?</span>
          <span className="act-progress">{currentIndex + 1} / {FOOD_CATS.length}</span>
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
          <p className="act-footer-hint">Swipe right on all cuisines you'd both enjoy</p>
        </div>
      </div>
    )
  }

  // ── Restaurant swipe UI ───────────────────────────────────────────────────
  const currentPlace = places[currentIndex]
  return (
    <div className="act-room">
      <div className="act-header">
        <span className="act-phase-label">
          {matchedCategories.map(c => c.emoji).join(' ')} Restaurants
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
