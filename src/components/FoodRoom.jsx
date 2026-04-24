import { useState, useEffect, useRef, useCallback } from 'react'
import confetti from 'canvas-confetti'
import { FOOD_CATEGORIES, placeIdToNumId } from '../lib/foodCategories'
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

// ── Seeded shuffle so both users see the same cuisine order ──────────
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

// ── Parse location from topic_id ─────────────────────────────────────
function parseLocation(topicId) {
  if (!topicId) return null
  try { return JSON.parse(topicId) } catch { return null }
}

// ── Parse phase data from room row (same format as ActivityRoom) ─────
function parseRoomFoodData(room) {
  let topicData = {}
  try { topicData = JSON.parse(room.topic_id || '{}') } catch { topicData = {} }
  const phase = topicData._phase || 'categories'
  let matchedCategory = topicData._matched_category || null
  let places = topicData._places || []
  return { phase, matchedCategory, places }
}

export default function FoodRoom({ room, onDone }) {
  const userToken = useRef(getUserToken())
  const location = parseLocation(room.topic_id)

  const initialData = parseRoomFoodData(room)
  const [phase, setPhase] = useState(initialData.phase)
  const [matchedCategory, setMatchedCategory] = useState(initialData.matchedCategory)
  const [places, setPlaces] = useState(initialData.places)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [matches, setMatches] = useState([])
  const [matchItem, setMatchItem] = useState(null)
  const [isDone, setIsDone] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [waitingForPartnerPlaces, setWaitingForPartnerPlaces] = useState(false)

  const isDoneRef = useRef(false)
  const placesTransitionFiredRef = useRef(false)

  // Seeded shuffle per room
  const FOOD_CATS = useRef(seededShuffle(FOOD_CATEGORIES, room.id)).current

  useEffect(() => { isDoneRef.current = isDone }, [isDone])

  // ── Celebration → places transition ──────────────────────────────
  function showCelebrationThenPlaces(data) {
    if (placesTransitionFiredRef.current) return
    placesTransitionFiredRef.current = true
    setMatchedCategory(data.matchedCategory)
    setWaitingForPartnerPlaces(false)
    setTransitioning(true)
    setTimeout(() => {
      setPlaces(data.places)
      setPhase('places')
      setCurrentIndex(0)
      setTransitioning(false)
    }, 2200)
  }

  // ── Handle cuisine match ──────────────────────────────────────────
  const handleCategoryMatch = useCallback(async (cat) => {
    if (!location) return
    setWaitingForPartnerPlaces(true)
    try {
      const fetched = await fetchNearbyPlaces(
        location.lat, location.lng,
        location.radius || 5000,
        cat.types,
        room.id
      )
      const mapped = fetched.map(p => ({ ...p, numId: p.numId || placeIdToNumId(p.id) }))

      await updateActivityRoomPhase(room.id, {
        phase: 'places',
        matched_category: cat,
        places: mapped,
        locationData: location,
      })

      // Read canonical places back from DB
      const latest = await getRoom(room.id)
      if (latest) {
        const canonical = parseRoomFoodData(latest)
        if (canonical.places.length > 0) {
          showCelebrationThenPlaces({ matchedCategory: canonical.matchedCategory || cat, places: canonical.places })
          return
        }
      }
      showCelebrationThenPlaces({ matchedCategory: cat, places: mapped })
    } catch (err) {
      console.error('Food match error:', err)
      setWaitingForPartnerPlaces(false)
    }
  }, [location, room.id])

  // ── Swipe a cuisine category ──────────────────────────────────────
  const handleCategorySwipe = useCallback(async (direction) => {
    const cat = FOOD_CATS[currentIndex]
    if (!cat) return
    setCurrentIndex(i => i + 1)
    if (direction !== 'right') return

    try {
      const isMatch = await recordSwipe(room.id, userToken.current, cat.numId, direction)
      if (isMatch) {
        // Check DB first to prevent race condition
        const latest = await getRoom(room.id)
        if (latest) {
          const latestData = parseRoomFoodData(latest)
          if (latestData.phase === 'places' && latestData.places.length > 0) {
            showCelebrationThenPlaces({ matchedCategory: latestData.matchedCategory || cat, places: latestData.places })
            return
          }
        }
        handleCategoryMatch(cat)
      }
    } catch (err) {
      console.error('Category swipe error:', err)
    }
  }, [currentIndex, room.id, handleCategoryMatch, FOOD_CATS])

  // ── Swipe a restaurant place ──────────────────────────────────────
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
      console.error('Place swipe error:', err)
    }
  }, [currentIndex, room.id, places])

  // Derived state
  const finishedSwiping = phase === 'places' && places.length > 0 && currentIndex >= places.length && !isDone

  // ── Poll while waiting for partner after all places swiped ────────
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
  }, [finishedSwiping, room.id, places])

  // ── Authoritative match fetch when results open ───────────────────
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

  // ── Subscribe to partner place swipes ─────────────────────────────
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
  }, [room.id, phase, places])

  // ── Subscribe to room changes (partner fetched places) ────────────
  useEffect(() => {
    const unsub = subscribeToRoomChanges(room.id, (updatedRoom) => {
      const data = parseRoomFoodData(updatedRoom)
      if (data.phase === 'places' && phase === 'categories') {
        showCelebrationThenPlaces(data)
      }
    })
    return unsub
  }, [room.id, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Poll fallback during category phase ───────────────────────────
  useEffect(() => {
    if (phase !== 'categories') return
    const interval = setInterval(async () => {
      try {
        const latest = await getRoom(room.id)
        if (latest) {
          const data = parseRoomFoodData(latest)
          if (data.phase === 'places' && data.places.length > 0 && !placesTransitionFiredRef.current) {
            showCelebrationThenPlaces(data)
          }
        }
      } catch { /* non-fatal */ }
    }, 3000)
    return () => clearInterval(interval)
  }, [phase, room.id])

  // ── Celebration screen ────────────────────────────────────────────
  if (transitioning && matchedCategory) {
    return (
      <div className="act-center">
        <div className="act-celebration">
          <div className="act-celebration-emoji">{matchedCategory.emoji || '🎉'}</div>
          <h2 className="act-celebration-title">You both want</h2>
          <h1 className="act-celebration-match">{matchedCategory.label}!</h1>
          <p className="act-celebration-sub">Finding restaurants nearby…</p>
        </div>
      </div>
    )
  }

  // ── Waiting for partner to fetch places ───────────────────────────
  if (waitingForPartnerPlaces) {
    return (
      <div className="act-center">
        <div className="act-waiting-places">
          <div className="loader" />
          <p style={{ color: 'var(--text-muted)', marginTop: 16 }}>Looking for restaurants nearby…</p>
        </div>
      </div>
    )
  }

  // ── Match modal ───────────────────────────────────────────────────
  if (matchItem) {
    return (
      <div className="act-match-overlay">
        <div className="act-match-modal">
          <div className="act-match-emoji">🎉</div>
          <h2 className="act-match-title">You both want to go here!</h2>
          <div className="act-match-place">
            <div className="act-match-place-name">{matchItem.title}</div>
            {matchItem.rating && (
              <div className="act-match-place-rating">⭐ {matchItem.rating}</div>
            )}
            {matchItem.distance && (
              <div className="act-match-place-dist">📍 {matchItem.distance}</div>
            )}
            {matchItem.isOpen === true && <div className="act-result-open">● Open now</div>}
            {matchItem.isOpen === false && matchItem.isOpen != null && <div className="act-result-closed">● Closed</div>}
          </div>
          {matchItem.lat && matchItem.lng && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${matchItem.lat},${matchItem.lng}&travelmode=walking`}
              target="_blank"
              rel="noopener noreferrer"
              className="act-result-directions"
              onClick={e => e.stopPropagation()}
            >
              🗺 Get directions
            </a>
          )}
          <div className="act-match-actions">
            {currentIndex < places.length ? (
              <button className="btn btn-primary" onClick={() => setMatchItem(null)}>Keep Swiping</button>
            ) : (
              <button className="btn btn-primary" onClick={() => { setMatchItem(null); setIsDone(true) }}>See All Matches</button>
            )}
            <button className="btn btn-secondary" onClick={() => { setMatchItem(null); setIsDone(true) }}>Done</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Results ───────────────────────────────────────────────────────
  if (isDone || finishedSwiping) {
    return (
      <div className="act-results-page">
        <div className="act-results">
          {finishedSwiping && !isDone ? (
            <>
              <div className="act-waiting-icon">⏳</div>
              <h2>Waiting for your partner…</h2>
              <p className="act-waiting-text">
                {matches.length > 0
                  ? `${matches.length} match${matches.length !== 1 ? 'es' : ''} so far!`
                  : 'Checking for matches…'}
              </p>
              {matches.length > 0 && (
                <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => setIsDone(true)}>
                  See Matches
                </button>
              )}
              <div className="act-waiting-matches">
                {matches.map(m => (
                  <div key={m.id} className="act-waiting-match-item">
                    <span>{m.title}</span>
                    {m.isOpen === true && <span className="act-result-open"> ● Open</span>}
                  </div>
                ))}
              </div>
            </>
          ) : matches.length > 0 ? (
            <>
              <div className="act-results-emoji">🎊</div>
              <h2 className="act-results-title">Your restaurant matches!</h2>
              <p className="act-results-sub">You both want to go to {matches.length} place{matches.length !== 1 ? 's' : ''}.</p>
              <div className="act-results-list">
                {matches.map(m => (
                  <div key={m.id} className="act-result-item">
                    <div className="act-result-header">
                      <span className="act-result-name">{m.title}</span>
                      {m.rating && <span className="act-result-rating">⭐ {m.rating}</span>}
                    </div>
                    {m.distance && <div className="act-result-distance">📍 {m.distance}</div>}
                    {m.isOpen === true && <div className="act-result-open">● Open now</div>}
                    {m.isOpen === false && m.isOpen != null && <div className="act-result-closed">● Closed</div>}
                    {m.todayHours && m.isOpen && <div className="act-result-hours">{m.todayHours}</div>}
                    {m.lat && m.lng && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}&travelmode=walking`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="act-result-directions"
                      >
                        🗺 Get directions
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="act-results-emoji">😅</div>
              <h2 className="act-results-title">No matches yet</h2>
              <p className="act-results-sub">You didn't agree on any restaurants. Try a wider radius!</p>
            </>
          )}
          <button className="btn btn-secondary" style={{ width: '100%', marginTop: 24 }} onClick={onDone}>
            Go home
          </button>
        </div>
      </div>
    )
  }

  // ── No location configured ────────────────────────────────────────
  if (!location) {
    return (
      <div className="act-center">
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>
          No location set. Please create a new room and enter your location.
        </p>
        <button className="btn btn-primary" onClick={onDone}>Go home</button>
      </div>
    )
  }

  // ── All categories swiped, no match yet ───────────────────────────
  if (phase === 'categories' && currentIndex >= FOOD_CATS.length) {
    return (
      <div className="act-center">
        <div style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🤷</div>
          <h2>No cuisine match yet</h2>
          <p className="act-waiting-text">Waiting to see if your partner picks something you both like…</p>
          <div className="loader" style={{ marginTop: 24 }} />
        </div>
      </div>
    )
  }

  // ── Places phase — loading ────────────────────────────────────────
  if (phase === 'places' && places.length === 0) {
    return (
      <div className="act-center">
        <div className="loader" />
        <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>Loading restaurants…</p>
      </div>
    )
  }

  // ── Category swipe ────────────────────────────────────────────────
  if (phase === 'categories') {
    const current = FOOD_CATS[currentIndex]
    return (
      <div className="act-room">
        <div className="act-header">
          <span className="act-phase-label">🍽️ What are you in the mood for?</span>
          <span className="act-progress">{currentIndex + 1} / {FOOD_CATS.length}</span>
        </div>
        <div className="act-cards">
          <SwipeCard
            key={current.id}
            item={{
              id: current.numId,
              title: current.label,
              overview: current.desc,
              emoji: current.emoji,
              poster: null,
              rating: null,
              isOpen: null,
            }}
            onSwipe={handleCategorySwipe}
            active
          />
        </div>
      </div>
    )
  }

  // ── Restaurant swipe ──────────────────────────────────────────────
  const currentPlace = places[currentIndex]
  return (
    <div className="act-room">
      <div className="act-header">
        <span className="act-phase-label">{matchedCategory?.emoji} {matchedCategory?.label}</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {matches.length > 0 && (
            <span className="act-match-count">{matches.length} match{matches.length !== 1 ? 'es' : ''}</span>
          )}
          <span className="act-progress">{currentIndex + 1} / {places.length}</span>
        </div>
      </div>
      <div className="act-cards">
        <SwipeCard key={currentPlace.id} item={currentPlace} onSwipe={handlePlaceSwipe} active />
      </div>
      <div className="act-footer">
        <button className="done-early-btn" onClick={() => setIsDone(true)}>
          I'm done swiping{matches.length > 0 ? ` · ${matches.length} match${matches.length !== 1 ? 'es' : ''}` : ''}
        </button>
      </div>
    </div>
  )
}
