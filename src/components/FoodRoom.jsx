import { useState, useEffect, useRef, useCallback } from 'react'
import confetti from 'canvas-confetti'
import HomeLogo from './HomeLogo'
import CategoryGrid from './CategoryGrid'
import { saveMatch } from '../lib/savedMatches'
import { FOOD_CATEGORIES, buildLocalCuisineCategory } from '../lib/foodCategories'
import { fetchNearbyPlaces, getBrandKey } from '../lib/placesApi'
import {
  getUserToken,
  recordSwipe,
  subscribeToSwipes,
  subscribeToRoomPicks,
  fetchRoomPicks,
  fetchPartnerSwipeCount,
  updateActivityRoomPhase,
  subscribeToRoomChanges,
  getRoom,
  fetchRoomMatches,
  getRoomPlayerCount,
  getParticipantCount,
  fetchVoteCounts,
  DONE_ITEM_ID,
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
  try { topicData = JSON.parse(room.topic_id || '{}') } catch { /* not JSON — keep default */ }
  const phase = topicData._phase || 'categories'
  const matchedCategories = topicData._matched_categories ||
    (topicData._matched_category ? [topicData._matched_category] : [])
  const places = topicData._places || []
  const playerCount = topicData.playerCount || 2
  return { phase, matchedCategories, places, playerCount }
}


// ─── Main FoodRoom component ──────────────────────────────────────────────────

export default function FoodRoom({ room, onDone, isSolo = false }) {
  const userToken = useRef(getUserToken())
  const location = parseLocation(room.topic_id)

  // Build the full category list: static categories + dynamic Local Cuisine for this region
  const localCuisine = buildLocalCuisineCategory(location?.countryCode)
  const ALL_FOOD_CATS = [...FOOD_CATEGORIES, localCuisine]

  // Same shuffled order for everyone in this room
  const FOOD_CATS = seededShuffle(ALL_FOOD_CATS, room.id)

  const initialData = parseRoomFoodData(room)
  const [phase, setPhase] = useState(initialData.phase)
  const [matchedCategories, setMatchedCategories] = useState(initialData.matchedCategories)
  const [places, setPlaces] = useState(initialData.places)
  const playerCount = isSolo ? 1 : (initialData.playerCount || getRoomPlayerCount(room))

  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedCats, setSelectedCats] = useState(new Set())
  const [matches, setMatches] = useState([])
  const [likedPlaces, setLikedPlaces] = useState([])
  const [matchItem, setMatchItem] = useState(null)
  const [isDone, setIsDone] = useState(false)
  const [partnerDone, setPartnerDone] = useState(false)
  const [partnerStop, setPartnerStop] = useState(Infinity)
  const [participantCount, setParticipantCount] = useState(1)
  const [voteCounts, setVoteCounts] = useState({})

  const [transitioning, setTransitioning] = useState(false)
  const [fetchingPlaces, setFetchingPlaces] = useState(false)
  const [placesError, setPlacesError] = useState(null)
  const [waitingForPartner, setWaitingForPartner] = useState(false)
  const [waitedLong, setWaitedLong] = useState(false)

  const isDoneRef = useRef(false)
  const placesTransitionFiredRef = useRef(false)
  const pendingSwipesRef = useRef([])
  const likedCatIdsRef = useRef(new Set())
  const rejectedBrandsRef = useRef(new Set())
  const donePlacesSignalledRef = useRef(false)

  useEffect(() => { isDoneRef.current = isDone }, [isDone])

  const finishedSwiping = phase === 'places' && places.length > 0 && currentIndex >= places.length && !isDone

  // Ref so the swipe subscription can tell if we're already on the results/waiting
  // screen — a late match shouldn't pop a modal over it (matches the movie flow).
  const resultsShownRef = useRef(false)
  useEffect(() => { resultsShownRef.current = isDone || finishedSwiping }, [isDone, finishedSwiping])

  // Save every match to the "Saved Matches" drawer (was movies-only before).
  useEffect(() => {
    if (matchItem) saveMatch({ id: matchItem.id, title: matchItem.title, category: room.type, image: matchItem.poster || null, rating: matchItem.rating || null })
  }, [matchItem, room.type])

  // Escape hatch: if a partner never taps "done", surface a "Continue" option
  // after a wait so the user isn't stuck on the cuisine screen forever.
  useEffect(() => {
    if (!waitingForPartner) { setWaitedLong(false); return }
    const t = setTimeout(() => setWaitedLong(true), 20000)
    return () => clearTimeout(t)
  }, [waitingForPartner])

  // Solo: auto-complete when all places swiped
  useEffect(() => {
    if (isSolo && finishedSwiping) setIsDone(true)
  }, [isSolo, finishedSwiping])  

  // ── Track participant count ───────────────────────────────────────────────
  useEffect(() => {
    if (isSolo) return
    getParticipantCount(room.id).then(setParticipantCount).catch(() => {})
    const interval = setInterval(() => {
      getParticipantCount(room.id).then(setParticipantCount).catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [isSolo, room.id])  

  // ── Poll for matches while waiting for group ──────────────────────────────
  useEffect(() => {
    if (!finishedSwiping || isSolo) return
    const interval = setInterval(async () => {
      try {
        const ids = await fetchRoomMatches(room.id, userToken.current, playerCount)
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
  }, [finishedSwiping, isSolo, room.id, places]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Authoritative match fetch when results screen opens ──────────────────
  useEffect(() => {
    if (isSolo) return
    const showingResults = isDone || (phase === 'places' && places.length > 0 && currentIndex >= places.length)
    if (!showingResults || places.length === 0) return

    fetchVoteCounts(room.id).then(setVoteCounts).catch(() => {})

    fetchRoomMatches(room.id, userToken.current, playerCount)
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

  // ── Subscribe to group place swipes ──────────────────────────────────────
  useEffect(() => {
    if (isSolo) return
    const unsub = subscribeToSwipes(room.id, userToken.current, (itemId) => {
      const numId = Number(itemId)
      if (phase === 'places') {
        const place = places.find(p => p.numId === numId)
        if (place) {
          setMatches(prev => prev.find(m => m.id === place.id) ? prev : [...prev, place])
          // Only celebrate while still swiping — not over the results/waiting screen.
          if (!resultsShownRef.current) {
            setMatchItem(place)
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } })
          }
        }
      }
    }, playerCount)
    return unsub
  }, [isSolo, room.id, phase, places]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tell others this user finished swiping places (DONE sentinel) ─────────
  useEffect(() => {
    if (isSolo || phase !== 'places') return
    if (!(finishedSwiping || isDone) || donePlacesSignalledRef.current) return
    donePlacesSignalledRef.current = true
    recordSwipe(room.id, userToken.current, DONE_ITEM_ID, 'right', playerCount).catch(() => {})
  }, [isSolo, phase, finishedSwiping, isDone, room.id, playerCount])

  // ── Detect when a partner finished + how far they swiped, so the banner shows
  // only once this user reaches a restaurant the partner never got to. (Places
  // use ids ≥ 2,000,000 — count only those, not the earlier cuisine swipes.) ──
  useEffect(() => {
    if (isSolo) return
    let active = true
    const markDone = async () => {
      if (!active) return
      setPartnerDone(true)
      const n = await fetchPartnerSwipeCount(room.id, userToken.current, 2000000)
      if (active) setPartnerStop(n)
    }
    fetchRoomPicks(room.id, userToken.current)
      .then(p => { if (active && p && p.othersDone > 0) markDone() })
      .catch(() => {})
    const unsub = subscribeToRoomPicks(room.id, userToken.current, (swipe) => {
      if (Number(swipe.item_id) === DONE_ITEM_ID) markDone()
    })
    return () => { active = false; unsub() }
  }, [isSolo, room.id])

  // ── fetchAndTransitionToPlaces ────────────────────────────────────────────
  const fetchAndTransitionToPlaces = useCallback(async (matchedCats) => {
    if (placesTransitionFiredRef.current) return
    placesTransitionFiredRef.current = true
    setMatchedCategories(matchedCats)
    setTransitioning(true)
    setFetchingPlaces(true)

    // Race guard: if the other person already fetched places, reuse them instead
    // of making a second (divergent, paid) Google call.
    try {
      const existing = await getRoom(room.id)
      const data = existing ? parseRoomFoodData(existing) : null
      if (data && data.places.length > 0) {
        setPlaces(data.places)
        setMatchedCategories(data.matchedCategories.length ? data.matchedCategories : matchedCats)
        setFetchingPlaces(false)
        setPhase('places')
        setCurrentIndex(0)
        setTransitioning(false)
        setWaitingForPartner(false)
        return
      }
    } catch { /* fall through and fetch */ }

    let allPlaces = []
    let fetchError = null
    if (location?.lat != null && matchedCats.length > 0) {
      // Fetch per-category lists, then interleave round-robin (Italian, Japanese, Italian, Japanese…)
      const perCat = []
      for (const cat of matchedCats) {
        try {
          const fetched = await fetchNearbyPlaces(location.lat, location.lng, location.radius || 5000, cat.types, room.id)
          perCat.push(fetched)
        } catch (err) {
          console.error('[FoodRoom] fetch error for', cat.label, err)
          fetchError = fetchError || err   // remember the first real API/network failure
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
    }

    setFetchingPlaces(false)

    // If we got nothing back AND a fetch actually failed, show the real error
    // instead of the misleading "No restaurants found nearby" empty state.
    if (allPlaces.length === 0 && fetchError) {
      setPlacesError(fetchError.message || 'Something went wrong loading places. Please try again.')
      setPhase('places')
      setTransitioning(false)
      setWaitingForPartner(false)
      return
    }

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
    } catch { /* canonical read failed — use local allPlaces */ }

    setPlaces(allPlaces)
    setPhase('places')
    setCurrentIndex(0)
    setTransitioning(false)
    setWaitingForPartner(false)
  }, [location, room.id])  

  // ── handleCategoriesDone ──────────────────────────────────────────────────
  const handleCategoriesDone = useCallback(async () => {
    if (isSolo) {
      const likedCats = FOOD_CATS.filter(c => likedCatIdsRef.current.has(c.numId))
      const catsToUse = likedCats.length > 0 ? likedCats : []
      await fetchAndTransitionToPlaces(catsToUse)
      return
    }
    setWaitingForPartner(true)
    try {
      await Promise.all(pendingSwipesRef.current)
      pendingSwipesRef.current = []

      const isAllDone = await recordSwipe(room.id, userToken.current, FOOD_CAT_DONE_NUMID, 'right', playerCount)
      if (isAllDone) {
        const allMatchIds = await fetchRoomMatches(room.id, userToken.current, playerCount)
        const matchedCats = FOOD_CATS.filter(c => allMatchIds?.includes(c.numId))
        await fetchAndTransitionToPlaces(matchedCats)
      }
    } catch (err) {
      console.error('[FoodRoom] handleCategoriesDone error:', err)
      setWaitingForPartner(false)
    }
  }, [isSolo, room.id, playerCount, FOOD_CATS, fetchAndTransitionToPlaces])  

  // ── Category multi-select (grid) ───────────────────────────────────────────
  const toggleCategory = useCallback((numId) => {
    setSelectedCats(prev => {
      const next = new Set(prev)
      next.has(numId) ? next.delete(numId) : next.add(numId)
      return next
    })
  }, [])

  const handleCategoriesConfirm = useCallback(async () => {
    if (selectedCats.size === 0) return
    likedCatIdsRef.current = new Set(selectedCats)
    if (!isSolo) {
      for (const numId of selectedCats) {
        pendingSwipesRef.current.push(
          recordSwipe(room.id, userToken.current, numId, 'right').catch(console.error)
        )
      }
    }
    await handleCategoriesDone()
  }, [selectedCats, isSolo, room.id, handleCategoriesDone])

  // ── Subscribe to room changes (detect partner fetched places) ────────────
  useEffect(() => {
    if (isSolo) return
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
  }, [isSolo, room.id, phase])  

  // ── Polling fallback ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'categories' || isSolo) return
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
      } catch { /* non-fatal */ }
    }, 3000)
    return () => clearInterval(interval)
  }, [isSolo, room.id, phase])  

  // ── Swipe a restaurant ────────────────────────────────────────────────────
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
        const isMatch = await recordSwipe(room.id, userToken.current, place.numId, direction, playerCount)
        if (isMatch) {
          setMatchItem(place)
          setMatches(prev => prev.find(m => m.id === place.id) ? prev : [...prev, place])
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } })
        }
      } catch (err) {
        console.error('recordSwipe error:', err)
      }
    }
  }, [isSolo, places, currentIndex, room.id, playerCount])

  // ── Place match modal (together mode only) ────────────────────────────────
  if (matchItem && !isSolo) {
    const canKeepSwiping = !isDone && currentIndex < places.length
    return (
      <div className="act-match-overlay">
        <div className="act-match-modal">
          <div className="celebrate-badge celebrate-badge--heart act-match-badge">
            <svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          </div>
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

    let finalResults = resultsToShow
    if (!isSolo && resultsToShow.length === 0 && playerCount > 2 && Object.keys(voteCounts).length > 0) {
      const sorted = [...normalizedPlaces].sort((a, b) => (voteCounts[b.id] || 0) - (voteCounts[a.id] || 0))
      finalResults = sorted.filter(p => (voteCounts[p.id] || 0) >= 2).slice(0, 10)
    }

    const normalizedResults = finalResults.map(p => ({ ...p, id: p.numId }))
    return (
      <RankingView
        matches={normalizedResults}
        room={room}
        movies={normalizedPlaces}
        onDone={onDone}
        isSolo={isSolo}
        playerCount={playerCount}
        voteCounts={voteCounts}
      />
    )
  }

  // ── Waiting for group to finish categories ───────────────────────────────
  if (waitingForPartner && !transitioning) {
    const likedCats = FOOD_CATS.filter(c => likedCatIdsRef.current.has(c.numId))
    const othersNeeded = playerCount - 1
    return (
      <div className="act-center">
        <div className="act-waiting">
          <div className="act-waiting-icon">⏳</div>
          <h2>{playerCount > 2 ? 'Waiting for the group…' : 'Waiting for your partner…'}</h2>
          {playerCount > 2 && (
            <p className="act-waiting-participants">
              {participantCount >= playerCount
                ? `All ${playerCount} players have joined`
                : `${participantCount} of ${playerCount} players joined`}
            </p>
          )}
          <p className="act-waiting-text">
            {playerCount > 2
              ? `You've picked your cuisines. Waiting for the other ${othersNeeded} player${othersNeeded !== 1 ? 's' : ''}.`
              : `You've picked your cuisines. Hang tight!`}
          </p>
          {likedCats.length > 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8 }}>
              Your picks: {likedCats.map(c => `${c.emoji} ${c.label}`).join(', ')}
            </p>
          )}
          <div className="loader" style={{ margin: '16px auto' }} />
          {waitedLong && (
            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 8 }}
              onClick={async () => {
                const ids = await fetchRoomMatches(room.id, userToken.current, playerCount)
                let cats = FOOD_CATS.filter(c => ids?.includes(c.numId))
                if (cats.length === 0) cats = likedCats
                await fetchAndTransitionToPlaces(cats)
              }}
            >
              Continue without waiting
            </button>
          )}
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
              <h2>{isSolo ? 'Finding' : 'You matched on'} {matchedCategories.length} cuisine{matchedCategories.length !== 1 ? 's' : ''}{isSolo ? '…' : '!'}</h2>
              <p className="act-transition-sub">{matchedCategories.map(c => `${c.emoji} ${c.label}`).join(' · ')}</p>
              <div className="loader" style={{ marginTop: 20 }} />
            </>
          ) : (
            <>
              <div className="act-transition-emoji">😅</div>
              <h2>{isSolo ? 'No cuisines selected' : 'No cuisine matches'}</h2>
              <p className="act-transition-sub">{isSolo ? 'Swipe right on at least one cuisine to see restaurants.' : 'You didn\'t agree on any cuisines. Try creating a new room!'}</p>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Places fetch error ────────────────────────────────────────────────────
  function retryCategories() {
    placesTransitionFiredRef.current = false
    likedCatIdsRef.current = new Set()
    setPhase('categories')
    setPlaces([])
    setMatchedCategories([])
    setCurrentIndex(0)
    setPlacesError(null)
  }

  if (phase === 'places' && placesError) {
    return (
      <div className="act-center">
        <div className="act-error">
          <div className="act-error-icon">😕</div>
          <h2>Couldn't load restaurants</h2>
          <p className="act-error-sub">{placesError}</p>
          <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={retryCategories}>
            Try different cuisines
          </button>
          <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={onDone}>Go home</button>
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
            {!location ? ' Add a location when creating the room.' : ' Try a different cuisine.'}
          </p>
          <button className="btn btn-primary" onClick={retryCategories}>Try different cuisines</button>
          <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={onDone}>Go home</button>
        </div>
      </div>
    )
  }

  // ── Waiting for group to finish swiping places ───────────────────────────
  if (finishedSwiping) {
    return (
      <div className="act-center">
        <div className="act-waiting">
          <div className="act-waiting-icon">⏳</div>
          <h2>{playerCount > 2 ? 'Waiting for the group…' : 'Waiting for your partner…'}</h2>
          {playerCount > 2 && (
            <p className="act-waiting-participants">
              {participantCount >= playerCount
                ? `All ${playerCount} players have joined`
                : `${participantCount} of ${playerCount} players joined`}
            </p>
          )}
          <p className="act-waiting-text">
            You've swiped through all {places.length} restaurants.
            {matches.length > 0
              ? ` ${playerCount > 2 ? 'Group matched on' : 'You\'ve matched on'} ${matches.length} place${matches.length !== 1 ? 's' : ''}!`
              : playerCount > 2 ? ' Waiting to see what the group agrees on…' : ' Waiting to see if you agree on any…'}
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
    return (
      <div className="act-room">
        <div className="act-header">
          <HomeLogo />
          <span className="act-phase-label">🍽️ What are you in the mood for?</span>
          <span className="act-progress">{selectedCats.size} selected</span>
        </div>

        <div className="act-grid-scroll">
          <p className="act-grid-hint">
            {isSolo
              ? 'Pick every cuisine you fancy — one or more.'
              : playerCount > 2
                ? `Pick what you fancy — you'll eat what all ${playerCount} agree on.`
                : 'Pick every cuisine you fancy — you\'ll eat what you both agree on.'}
          </p>
          <CategoryGrid
            categories={FOOD_CATS}
            selected={selectedCats}
            onToggle={toggleCategory}
          />
        </div>

        <div className="act-footer">
          <button
            className="btn btn-primary act-confirm-btn"
            onClick={handleCategoriesConfirm}
            disabled={selectedCats.size === 0 || fetchingPlaces}
          >
            {fetchingPlaces
              ? 'Finding restaurants…'
              : selectedCats.size === 0
                ? 'Pick at least one'
                : `Find restaurants · ${selectedCats.size} selected`}
          </button>
        </div>
      </div>
    )
  }

  // ── Restaurant swipe UI ───────────────────────────────────────────────────
  const currentPlace = places[currentIndex]
  return (
    <div className="act-room">
      <div className="act-header">
        <HomeLogo />
        <span className="act-phase-label">
          {matchedCategories.map(c => c.emoji).join(' ')}{' '}
          {location?.locationName ? `near ${location.locationName}` : 'Restaurants'}
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
        {partnerDone && !isSolo && currentIndex >= partnerStop && (
          <div className="partner-done-banner">
            <span className="partner-done-dot" aria-hidden="true" />
            {playerCount > 2 ? 'Someone finished here' : 'Your partner finished here'} — no new matches ahead, wrap up anytime
          </div>
        )}
        <button className="done-early-btn" onClick={() => setIsDone(true)}>
          {isSolo
            ? `I'm done · ${likedPlaces.length} pick${likedPlaces.length !== 1 ? 's' : ''}`
            : `I'm done swiping${matches.length > 0 ? ` · ${matches.length} match${matches.length !== 1 ? 'es' : ''}` : ''}`}
        </button>
      </div>
    </div>
  )
}
