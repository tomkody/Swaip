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

import { fetchNearbyPlaces, getBrandKey } from '../lib/placesApi'
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

const ACT_CAT_DONE_NUMID = 1999

// Parse location data from topic_id field
function parseLocation(topicId) {
  if (!topicId) return null
  try { return JSON.parse(topicId) } catch { return null }
}

// Parse phase/places/matched_categories from room row.
function parseRoomActivityData(room) {
  let topicData = {}
  try { topicData = JSON.parse(room.topic_id || '{}') } catch { topicData = {} }

  const phase = topicData._phase || room.phase || 'categories'

  const matchedCategories = topicData._matched_categories ||
    (topicData._matched_category ? [topicData._matched_category] : [])

  let places = topicData._places || []
  if (places.length === 0 && room.places) {
    try { places = JSON.parse(room.places) } catch {}
  }

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

// ─── Main ActivityRoom component ──────────────────────────────────────────────

export default function ActivityRoom({ room, onDone, isSolo = false }) {
  const userToken = useRef(getUserToken())
  const location = parseLocation(room.topic_id)

  const ACTIVITY_CATEGORIES = seededShuffle(_ACTIVITY_CATEGORIES, room.id)

  const initialData = parseRoomActivityData(room)
  const [phase, setPhase] = useState(initialData.phase)
  const [matchedCategories, setMatchedCategories] = useState(initialData.matchedCategories)
  const [places, setPlaces] = useState(initialData.places)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [matches, setMatches] = useState([])
  const [likedPlaces, setLikedPlaces] = useState([])
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
  const rejectedBrandsRef = useRef(new Set())

  useEffect(() => { isDoneRef.current = isDone }, [isDone])

  // True when this user has swiped all places but isDone hasn't been set yet
  const finishedSwiping = phase === 'places' && places.length > 0 && currentIndex >= places.length && !isDone

  // Solo: auto-complete when all places swiped
  useEffect(() => {
    if (isSolo && finishedSwiping) setIsDone(true)
  }, [isSolo, finishedSwiping]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Poll for new matches while waiting for partner to finish ─────────────
  useEffect(() => {
    if (!finishedSwiping || isSolo) return
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
  }, [finishedSwiping, isSolo, room.id, places]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Authoritative matches from DB when results screen opens ──────────────
  useEffect(() => {
    if (isSolo) return
    const showingResults =
      isDone || (phase === 'places' && places.length > 0 && currentIndex >= places.length)
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
  }, [isSolo, isDone, currentIndex, places.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Subscribe to partner swipes ───────────────────────────────────────────
  useEffect(() => {
    if (isSolo) return
    const unsub = subscribeToSwipes(room.id, userToken.current, (itemId) => {
      const numId = Number(itemId)
      if (phase === 'places') {
        const place = places.find(p => p.numId === numId)
        if (place) {
          setMatches(prev => prev.find(m => m.id === place.id) ? prev : [...prev, place])
          setMatchItem(place)
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } })
        }
      }
    })
    return unsub
  }, [isSolo, room.id, phase, places]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── fetchAndTransitionToPlaces ────────────────────────────────────────────
  const fetchAndTransitionToPlaces = useCallback(async (matchedCats) => {
    if (placesTransitionFiredRef.current) return
    placesTransitionFiredRef.current = true
    setMatchedCategories(matchedCats)
    setTransitioning(true)
    setFetchingPlaces(true)

    let allPlaces = []
    if (location?.lat != null && matchedCats.length > 0) {
      // Fetch per-category lists, then interleave round-robin (park, coffee, park, coffee…)
      const perCat = []
      for (const cat of matchedCats) {
        try {
          const fetched = await fetchNearbyPlaces(location.lat, location.lng, location.radius || 5000, cat.types, room.id)
          perCat.push(fetched)
        } catch (err) {
          console.error('[ActivityRoom] fetch error for', cat.label, err)
          perCat.push([])
        }
      }
      const seenIds = new Set()
      const maxLen = Math.max(0, ...perCat.map(a => a.length))
      for (let i = 0; i < maxLen; i++) {
        for (const catPlaces of perCat) {
          if (i < catPlaces.length) {
            const p = catPlaces[i]
            if (!seenIds.has(p.id)) { seenIds.add(p.id); allPlaces.push(p) }
          }
        }
      }
      // Open places first — stable sort preserves interleave order within each group
      allPlaces.sort((a, b) => {
        const rank = p => p.isOpen === true ? 0 : p.isOpen === false ? 1 : 2
        return rank(a) - rank(b)
      })
    } else if (!location?.lat) {
      console.warn('[ActivityRoom] No location data — skipping places fetch. location:', location)
    }

    setFetchingPlaces(false)

    try {
      await updateActivityRoomPhase(room.id, { phase: 'places', matched_categories: matchedCats, places: allPlaces, locationData: location })
    } catch (err) { console.error('[ActivityRoom] updateActivityRoomPhase error:', err) }

    // Read canonical places from DB
    try {
      const canonical = await getRoom(room.id)
      if (canonical) {
        const data = parseRoomActivityData(canonical)
        if (data.places.length > 0) allPlaces = data.places
      }
    } catch {}

    setPlaces(allPlaces)
    setPhase('places')
    setCurrentIndex(0)
    setTransitioning(false)
    setWaitingForPartner(false)
  }, [location, room.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── handleCategoriesDone ──────────────────────────────────────────────────
  const handleCategoriesDone = useCallback(async () => {
    if (isSolo) {
      // Solo: use liked categories directly, no partner sentinel
      const likedCats = ACTIVITY_CATEGORIES.filter(c => likedCatIdsRef.current.has(c.numId))
      const catsToUse = likedCats.length > 0 ? likedCats : []
      await fetchAndTransitionToPlaces(catsToUse)
      return
    }
    setWaitingForPartner(true)
    try {
      await Promise.all(pendingSwipesRef.current)
      pendingSwipesRef.current = []

      const isBothDone = await recordSwipe(room.id, userToken.current, ACT_CAT_DONE_NUMID, 'right')
      if (isBothDone) {
        const allMatchIds = await fetchRoomMatches(room.id, userToken.current)
        const matchedCats = ACTIVITY_CATEGORIES.filter(c => allMatchIds?.includes(c.numId))
        await fetchAndTransitionToPlaces(matchedCats)
      }
    } catch (err) {
      console.error('[ActivityRoom] handleCategoriesDone error:', err)
      setWaitingForPartner(false)
    }
  }, [isSolo, room.id, ACTIVITY_CATEGORIES, fetchAndTransitionToPlaces]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── handleCategorySwipe ────────────────────────────────────────────────────
  const handleCategorySwipe = useCallback(async (direction) => {
    const cat = ACTIVITY_CATEGORIES[currentIndex]
    if (!cat) return
    const newIndex = currentIndex + 1
    setCurrentIndex(newIndex)

    if (direction === 'right') {
      likedCatIdsRef.current.add(cat.numId)
      if (!isSolo) {
        const promise = recordSwipe(room.id, userToken.current, cat.numId, direction).catch(console.error)
        pendingSwipesRef.current.push(promise)
      }
    }

    if (newIndex >= ACTIVITY_CATEGORIES.length) {
      handleCategoriesDone()
    }
  }, [isSolo, currentIndex, room.id, ACTIVITY_CATEGORIES, handleCategoriesDone]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Subscribe to room data changes (partner fetched places → both transition) ──
  useEffect(() => {
    if (isSolo) return
    const unsub = subscribeToRoomChanges(room.id, (updatedRoom) => {
      const data = parseRoomActivityData(updatedRoom)
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
  }, [isSolo, room.id, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Polling fallback: check room every 3s while waiting for partner ────────
  useEffect(() => {
    if (phase !== 'categories' || isSolo) return
    const interval = setInterval(async () => {
      try {
        const latest = await getRoom(room.id)
        if (!latest) return
        const data = parseRoomActivityData(latest)
        if (data.phase === 'places' && !placesTransitionFiredRef.current) {
          placesTransitionFiredRef.current = true
          setMatchedCategories(data.matchedCategories)
          setPlaces(data.places)
          setPhase('places')
          setCurrentIndex(0)
          setWaitingForPartner(false)
          setTransitioning(false)
        }
      } catch (e) { /* non-fatal */ }
    }, 3000)
    return () => clearInterval(interval)
  }, [isSolo, room.id, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Place swipe handler ───────────────────────────────────────────────────
  const handlePlaceSwipe = useCallback(async (direction) => {
    const place = places[currentIndex]
    if (!place) return

    if (direction === 'left') {
      rejectedBrandsRef.current.add(getBrandKey(place.title))
    }

    let nextIndex = currentIndex + 1
    while (nextIndex < places.length && rejectedBrandsRef.current.has(getBrandKey(places[nextIndex].title))) {
      nextIndex++
    }
    setCurrentIndex(nextIndex)

    if (direction !== 'right') return

    setLikedPlaces(prev => prev.find(p => p.id === place.id) ? prev : [...prev, place])

    if (!isSolo) {
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
    }
  }, [isSolo, places, currentIndex, room.id])

  // ── Place match modal (together mode only) ────────────────────────────────
  if (matchItem && !isSolo) {
    const canKeepSwiping = !isDone && currentIndex < places.length
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
              <div className="act-match-img-placeholder">{matchedCategories[0]?.emoji || '📍'}</div>
            )}
            <div className="act-match-info">
              <h2>{matchItem.title}</h2>
              {matchItem.rating && <p className="act-match-rating">★ {matchItem.rating}</p>}
              {matchItem.isOpen != null && (
                <p className="act-match-hours">
                  <span style={{ color: matchItem.isOpen ? '#22c55e' : '#ef4444' }}>
                    {matchItem.isOpen ? '● Open' : '● Closed'}
                  </span>
                  {matchItem.isOpen && matchItem.closesAt ? ` · until ${matchItem.closesAt}` : ''}
                  {!matchItem.isOpen && matchItem.opensAt ? ` · opens ${matchItem.opensAt}` : ''}
                </p>
              )}
              {matchItem.address && <p className="act-match-address">{matchItem.address}</p>}
            </div>
          </div>

          <div className="act-match-actions">
            {canKeepSwiping ? (
              <>
                <button className="btn btn-primary act-match-cta" onClick={() => setMatchItem(null)}>
                  Keep Swiping · {places.length - currentIndex} left
                </button>
                <p className="act-match-cta-hint">Don't stop — there might be more matches!</p>
                <button className="act-match-skip" onClick={() => { setMatchItem(null); setIsDone(true) }}>
                  See all results
                </button>
              </>
            ) : (
              <button className="btn btn-primary act-match-cta" onClick={() => { setMatchItem(null); setIsDone(true) }}>
                See All Matches
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Results → RankingView ─────────────────────────────────────────────────
  if (isDone) {
    const normalizedPlaces = places.map(p => ({ ...p, id: p.numId }))
    const resultsToShow = isSolo ? likedPlaces : matches
    const normalizedResults = resultsToShow.map(p => ({ ...p, id: p.numId }))
    return (
      <RankingView
        matches={normalizedResults}
        room={room}
        movies={normalizedPlaces}
        onDone={onDone}
        isSolo={isSolo}
      />
    )
  }

  // ── Waiting for partner to finish categories ──────────────────────────────
  if (waitingForPartner && !transitioning) {
    const likedCats = ACTIVITY_CATEGORIES.filter(c => likedCatIdsRef.current.has(c.numId))
    return (
      <div className="act-center">
        <div className="act-waiting">
          <div className="act-waiting-icon">⏳</div>
          <h2>Waiting for your partner…</h2>
          <p className="act-waiting-text">You've picked your activities. Hang tight!</p>
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

  // ── Transition screen ─────────────────────────────────────────────────────
  if (transitioning) {
    return (
      <div className="act-center">
        <div className="act-transition">
          {fetchingPlaces ? (
            <>
              <div className="act-transition-emoji">🔍</div>
              <h2>Finding places…</h2>
              <p className="act-transition-sub">
                Searching for {matchedCategories.map(c => c.label).join(', ')} nearby
              </p>
              <div className="loader" style={{ marginTop: 20 }} />
            </>
          ) : matchedCategories.length > 0 ? (
            <>
              <div className="act-transition-emoji">🎉</div>
              <h2>{isSolo ? 'Finding' : 'You matched on'} {matchedCategories.length} activity type{matchedCategories.length !== 1 ? 's' : ''}{isSolo ? '…' : '!'}</h2>
              <p className="act-transition-sub">{matchedCategories.map(c => `${c.emoji} ${c.label}`).join(' · ')}</p>
              <div className="loader" style={{ marginTop: 20 }} />
            </>
          ) : (
            <>
              <div className="act-transition-emoji">😅</div>
              <h2>{isSolo ? 'No activities selected' : 'No activity matches'}</h2>
              <p className="act-transition-sub">{isSolo ? 'Swipe right on at least one activity to see places.' : 'You didn\'t agree on any activities. Try creating a new room!'}</p>
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
          <button className="btn btn-secondary" style={{ marginTop: 10 }} onClick={onDone}>
            Go home
          </button>
        </div>
      </div>
    )
  }

  // ── Place swipe (no places available) ─────────────────────────────────────
  if (phase === 'places' && places.length === 0) {
    return (
      <div className="act-center">
        <div className="act-error">
          <div className="act-error-icon">{matchedCategories[0]?.emoji || '📍'}</div>
          <h2>No places found</h2>
          <p className="act-error-sub">
            We couldn't find any {matchedCategories.map(c => c.label).join(' or ') || 'places'} nearby.
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
                    : <div className="act-waiting-match-thumb act-waiting-match-thumb--empty">{matchedCategories[0]?.emoji || '📍'}</div>}
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

  // ── Category swipe UI ─────────────────────────────────────────────────────
  if (phase === 'categories') {
    const current = ACTIVITY_CATEGORIES[currentIndex]
    return (
      <div className="act-room">
        <div className="act-header">
          <span className="act-phase-label">🎯 What do you want to do?</span>
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
          {currentIndex > 0 && (
            <button
              className="done-early-btn"
              onClick={handleCategoriesDone}
              disabled={fetchingPlaces}
            >
              {fetchingPlaces
                ? 'Finding places…'
                : likedCatIdsRef.current.size > 0
                  ? `I'm done · ${likedCatIdsRef.current.size} categor${likedCatIdsRef.current.size !== 1 ? 'ies' : 'y'} picked`
                  : `I'm done`}
            </button>
          )}
          <p className="act-footer-hint">{isSolo ? 'Swipe right on activities you enjoy' : 'Swipe right on all activities you\'d both enjoy'}</p>
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
          {matchedCategories.map(c => c.emoji).join(' ')} Places
        </span>
        <div className="act-header-right">
          {isSolo
            ? likedPlaces.length > 0 && <span className="act-match-count">{likedPlaces.length} pick{likedPlaces.length !== 1 ? 's' : ''}</span>
            : matches.length > 0 && <span className="act-match-count">{matches.length} match{matches.length !== 1 ? 'es' : ''}</span>}
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
          {isSolo
            ? `I'm done · ${likedPlaces.length} pick${likedPlaces.length !== 1 ? 's' : ''}`
            : `I'm done swiping${matches.length > 0 ? ` · ${matches.length} match${matches.length !== 1 ? 'es' : ''}` : ''}`}
        </button>
      </div>
    </div>
  )
}
