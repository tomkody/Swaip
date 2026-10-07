import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import HomeLogo from './HomeLogo'
import ThemeToggle from './ThemeToggle'
import AppHeader from './AppHeader'
import InvitePanel from './InvitePanel'
import CategoryGrid from './CategoryGrid'
import { removeMatch } from '../lib/savedMatches'
import { useMatchMoments, useSaveMatches, reconcileMatches } from '../lib/useMatchMoments'
import { track } from '../lib/analytics'
import { roomCategories } from '../lib/roomCategories'
import { fetchNearbyPlaces, getBrandKey } from '../lib/placesApi'
import { notifyRoom } from '../lib/push'
import {
  getRoomToken,
  recordSwipe,
  subscribeToSwipes,
  subscribeToRoomPicks,
  fetchRoomPicks,
  updateActivityRoomPhase,
  subscribeToRoomChanges,
  getRoom,
  fetchRoomMatches,
  getRoomPlayerCount,
  getParticipantCount,
  fetchVoteCounts,
  countItemLikers,
  DONE_ITEM_ID,
} from '../lib/room'
import SwipeCard from './SwipeCard'
import RankingView from './RankingView'
import MatchModal from './MatchModal'
import MatchBurst from './MatchBurst'
import './PlacesRoom.css'

// Food & Drinks and Activities are the same game: pick categories together,
// then swipe real places nearby. They used to be two copies of this file that
// drifted apart; now one component, and only the words and the category list
// differ. The swiping itself follows the movie deck in Room.jsx: first match
// is the full MatchModal, later ones a MatchBurst, undo takes a match back,
// progress survives a reload, matches are checked against the database.

const plural = (n, word, many = word + 's') => `${n} ${n === 1 ? word : many}`

const KINDS = {
  food: {
    catDoneBase: 2999,          // category-phase done marker (per round: base - round)
    categoriesFor: (roomId, loc) => roomCategories('food', roomId, loc?.countryCode),
    emoji: '🍽️',
    places: 'restaurants',
    placesTitle: 'Restaurants',
    picked: 'cuisines',
    catCount: n => plural(n, 'cuisine'),
    noneSelected: 'No cuisines selected',
    noneMatched: 'No cuisine matches',
    soloNoneHint: 'Swipe right on at least one cuisine to see restaurants.',
    noAgreement: 'You didn\'t agree on any cuisines. Try creating a new room!',
    tryDifferent: 'Try different cuisines',
    tryOther: ' Try a different cuisine.',
    noLocation: ' Add a location when creating the room.',
    gridTitle: '🍽️ What are you in the mood for?',
    hintSolo: 'Pick every cuisine you fancy - one or more.',
    hintGroup: n => `Pick what you fancy - you'll eat what all ${n} agree on.`,
    hintPair: 'Pick every cuisine you fancy - you\'ll eat what you both agree on.',
    matchPair: 'You both want to eat here',
    matchGroup: 'You all want to eat here',
  },
  activities: {
    catDoneBase: 1999,
    categoriesFor: roomId => roomCategories('activities', roomId),
    emoji: '🎯',
    places: 'places',
    placesTitle: 'Places',
    picked: 'activities',
    catCount: n => plural(n, 'activity type'),
    noneSelected: 'No activities selected',
    noneMatched: 'No activity matches',
    soloNoneHint: 'Swipe right on at least one activity to see places.',
    noAgreement: 'You didn\'t agree on any activities. Try creating a new room!',
    tryDifferent: 'Try different categories',
    tryOther: ' Try a different category.',
    noLocation: ' Add a location when creating the room to see real nearby places.',
    gridTitle: '🎯 What do you want to do?',
    hintSolo: 'Pick everything you\'re up for - one or more.',
    hintGroup: n => `Pick what you're up for - you'll do what all ${n} agree on.`,
    hintPair: 'Pick everything you\'re up for - you\'ll do what you both agree on.',
    matchPair: 'You both want to go here',
    matchGroup: 'You all want to go here',
  },
}

// ── Parse location data from topic_id ────────────────────────────────────────
function parseLocation(topicId) {
  if (!topicId) return null
  try { return JSON.parse(topicId) } catch { return null }
}

// ── Parse phase/places/matched_categories from room row ──────────────────────
// (room.phase / room.places: columns very old activity rooms still carry)
function parseRoomPlacesData(room) {
  let topicData = {}
  try { topicData = JSON.parse(room.topic_id || '{}') } catch { /* not JSON — keep default */ }
  const phase = topicData._phase || room.phase || 'categories'
  const matchedCategories = topicData._matched_categories ||
    (topicData._matched_category ? [topicData._matched_category] : [])
  let places = topicData._places || []
  if (places.length === 0 && room.places) {
    try { places = JSON.parse(room.places) } catch { /* not JSON — keep default */ }
  }
  const playerCount = topicData.playerCount || 2
  // Bumped by "try different" so every client starts a fresh round together
  // (and so the previous round's done-marker no longer counts).
  const round = topicData._round || 0
  const compromise = topicData._compromise === true
  return { phase, matchedCategories, places, playerCount, round, compromise }
}


// ─── Main component ───────────────────────────────────────────────────────────

const catsKey = id => `swaip_cats_${id}`
// Where this player is in the places deck, so a reload (iOS Safari reloads the
// tab behind the share sheet) doesn't send them back to the first place.
const placesKey = id => `swaip_places_${id}`

// banner: the room's invite nudge while the partner hasn't opened the link.
// partnerJoined: Room.jsx already knows when they have (realtime + poll).
export default function PlacesRoom({ kind: kindName = 'food', room, onDone, isSolo = false, banner = null, partnerJoined = false }) {
  const kind = KINDS[kindName] || KINDS.food
  const userToken = useRef(getRoomToken(room.id))
  // Memoised: a fresh object every render changed fetchAndTransitionToPlaces'
  // identity each time, which kept restarting the partner fallback poll.
  const location = useMemo(() => parseLocation(room.topic_id), [room.topic_id])

  const CATS = useMemo(() => kind.categoriesFor(room.id, location), [kind, room.id, location])

  const initialData = parseRoomPlacesData(room)
  const [phase, setPhase] = useState(initialData.phase)
  const [matchedCategories, setMatchedCategories] = useState(initialData.matchedCategories)
  const [places, setPlaces] = useState(initialData.places)
  const [round, setRound] = useState(initialData.round)
  const roundRef = useRef(initialData.round)
  useEffect(() => { roundRef.current = round }, [round])
  const [isCompromise, setIsCompromise] = useState(initialData.compromise)
  const playerCount = isSolo ? 1 : (initialData.playerCount || getRoomPlayerCount(room))

  // A confirmed pick survives a reload. The creator now usually confirms
  // before the partner arrives and then invites from the waiting screen, and
  // iOS Safari can reload the tab behind the share sheet: without this they
  // came back to an empty picker for a round they had already confirmed.
  const [resumed] = useState(() => {
    if (isSolo || initialData.phase !== 'categories') return null
    try {
      const saved = JSON.parse(sessionStorage.getItem(catsKey(room.id)) || 'null')
      return saved?.round === initialData.round && Array.isArray(saved.ids) ? saved.ids : null
    } catch { return null }
  })

  // Same for the places deck: index, likes, skipped brands, done.
  const [deckSaved] = useState(() => {
    if (initialData.phase !== 'places' || initialData.places.length === 0) return null
    try {
      const saved = JSON.parse(sessionStorage.getItem(placesKey(room.id)) || 'null')
      return saved?.round === initialData.round ? saved : null
    } catch { return null }
  })

  const [currentIndex, setCurrentIndex] = useState(() => Math.min(deckSaved?.index || 0, initialData.places.length))
  // Cards actually shown and swiped. Brand skipping jumps the index past the
  // chain's other branches, so the index alone made the counter leap (3 / 40,
  // then 7 / 40) and the deck end before N / N.
  const [seen, setSeen] = useState(() => deckSaved?.seen ?? Math.min(deckSaved?.index || 0, initialData.places.length))
  const [selectedCats, setSelectedCats] = useState(() => new Set(resumed || []))
  const [matches, setMatches] = useState([])
  const matchesRef = useRef([])
  useEffect(() => { matchesRef.current = matches }, [matches])
  // What the database check must not undo yet (see reconcileMatches).
  const recentMatchRef = useRef(new Map())
  const takingBackRef = useRef(new Set())
  // Bumped by every local change to the matches; a database read that started
  // before one is out of date and is thrown away.
  const matchEditRef = useRef(0)
  const [likedPlaces, setLikedPlaces] = useState(() =>
    deckSaved ? initialData.places.filter(p => (deckSaved.liked || []).includes(p.numId)) : [])
  const [isDone, setIsDone] = useState(Boolean(deckSaved?.done))
  const [partnerDone, setPartnerDone] = useState(false)
  const [partnerLikeIds, setPartnerLikeIds] = useState([]) // their final likes: how many matches are still reachable
  // First match: the full MatchModal. Every later one: a MatchBurst.
  const moments = useMatchMoments(matchesRef)
  const { show: showMatch, drop: dropMatch, closeModal, endBurst } = moments
  useSaveMatches(matches, room.type, !isSolo)
  const [participantCount, setParticipantCount] = useState(1)
  const [voteCounts, setVoteCounts] = useState({})

  const [transitioning, setTransitioning] = useState(false)
  const [fetchingPlaces, setFetchingPlaces] = useState(false)
  const [placesError, setPlacesError] = useState(null)
  const [waitingForPartner, setWaitingForPartner] = useState(Boolean(resumed))

  const isDoneRef = useRef(false)
  const placesTransitionFiredRef = useRef(false)
  const waitStartRef = useRef(resumed ? Date.now() : 0)
  // When this client first saw that everyone had confirmed. The takeover clock
  // runs from here: now that the creator picks before the partner even opens
  // the link, timing it from our own confirm made the creator take over (and
  // pay for a second Places search) while the partner was still fetching.
  const allDoneSeenRef = useRef(0)
  const pendingSwipesRef = useRef([])
  const likedCatIdsRef = useRef(new Set(resumed || []))
  // Brands this player swiped left on are skipped for the rest of the deck.
  // The ref serves the swipe handler; the state copy serves rendering.
  const rejectedBrandsRef = useRef(new Set(deckSaved?.brands || []))
  const [skippedBrands, setSkippedBrands] = useState(() => new Set(deckSaved?.brands || []))
  const historyRef = useRef([])            // this session's place swipes, newest last (undo)
  const [canUndo, setCanUndo] = useState(false)
  // Restored with the deck, so a reload of a finished deck doesn't log
  // swiping_done a second time.
  const donePlacesSignalledRef = useRef(Boolean(deckSaved?.signalled))

  useEffect(() => { isDoneRef.current = isDone }, [isDone])

  const finishedSwiping = phase === 'places' && places.length > 0 && currentIndex >= places.length && !isDone

  // Ref so the swipe subscription can tell if we're already on the results/waiting
  // screen — a late match shouldn't pop a modal over it (matches the movie flow).
  const resultsShownRef = useRef(false)
  useEffect(() => { resultsShownRef.current = isDone || finishedSwiping }, [isDone, finishedSwiping])

  useEffect(() => {
    if (phase !== 'places' || places.length === 0) return
    try {
      sessionStorage.setItem(placesKey(room.id), JSON.stringify({
        round, index: currentIndex, seen, liked: likedPlaces.map(p => p.numId), brands: [...skippedBrands], done: isDone,
        signalled: donePlacesSignalledRef.current,
      }))
    } catch { /* storage blocked: a reload starts the deck again */ }
  }, [phase, places.length, room.id, round, currentIndex, seen, likedPlaces, skippedBrands, isDone])

  // Fetch the next couple of photos before their cards mount (the movie deck
  // does three; place photos are a paid lookup, so only what's next in line).
  useEffect(() => {
    if (phase !== 'places') return
    let n = 0
    for (let i = currentIndex + 1; i < places.length && n < 2; i++) {
      const p = places[i]
      if (skippedBrands.has(getBrandKey(p.title))) continue
      n++
      if (p.poster) { const img = new Image(); img.src = p.poster }
    }
  }, [phase, places, currentIndex, skippedBrands])

  // ── Track participant count ───────────────────────────────────────────────
  useEffect(() => {
    if (isSolo) return
    getParticipantCount(room.id).then(setParticipantCount).catch(() => {})
    const interval = setInterval(() => {
      getParticipantCount(room.id).then(setParticipantCount).catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [isSolo, room.id])  

  // ── Keep the match counter honest ────────────────────────────────────────
  // Built from realtime events alone, a dropped socket or a backgrounded tab
  // left it short (and a partner's take-back never arrived). Check against the
  // database, like the movie deck does, also on the results: these matches
  // are what Saved matches records.
  useEffect(() => {
    if (isSolo || phase !== 'places' || places.length === 0) return
    let active = true
    const reconcile = async () => {
      try {
        const edit = matchEditRef.current
        const ids = await fetchRoomMatches(room.id, userToken.current, playerCount)
        if (!active || !ids || edit !== matchEditRef.current) return   // null = read failed; keep what we have
        const prev = matchesRef.current
        const next = reconcileMatches(prev, places, ids, {
          keyOf: p => p.numId, recent: recentMatchRef.current, takingBack: takingBackRef.current,
        })
        if (next === prev) return
        // Gone from the database: a take-back realtime never delivered.
        for (const m of prev) if (!next.some(n => n.id === m.id)) removeMatch(m.id, room.type)
        setMatches(next)
      } catch { /* non-fatal */ }
    }
    reconcile()
    const poll = setInterval(reconcile, 8000)
    const onVisible = () => { if (document.visibilityState === 'visible') reconcile() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [isSolo, phase, places, room.id, room.type, playerCount])

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

  // A group with no unanimous pick sees its best-voted places. The results now
  // open the moment this player finishes, while the others still vote, so keep
  // the counts coming instead of freezing them at that moment.
  const onResults = isDone || finishedSwiping
  useEffect(() => {
    if (isSolo || playerCount <= 2 || !onResults) return
    const t = setInterval(() => { fetchVoteCounts(room.id).then(setVoteCounts).catch(() => {}) }, 12000)
    return () => clearInterval(t)
  }, [isSolo, playerCount, onResults, room.id])

  // ── Subscribe to group place swipes ──────────────────────────────────────
  useEffect(() => {
    if (isSolo) return
    const unsub = subscribeToSwipes(room.id, userToken.current, (itemId) => {
      const numId = Number(itemId)
      if (phase === 'places') {
        const place = places.find(p => p.numId === numId)
        if (place) {
          matchEditRef.current++
          recentMatchRef.current.set(place.id, Date.now())
          setMatches(prev => prev.find(m => m.id === place.id) ? prev : [...prev, place])
          // Only celebrate while still swiping — not over the results/waiting screen.
          if (!resultsShownRef.current) {
            track('match', { type: room.type })
            showMatch(place)
          }
        }
      }
    }, playerCount, {
      // A partner took back a like with undo — drop that match here too.
      isMatched: id => matchesRef.current.some(m => m.numId === id),
      onUnmatch: id => {
        const gone = matchesRef.current.find(m => m.numId === id)
        matchEditRef.current++
        setMatches(prev => prev.filter(m => m.numId !== id))
        if (gone) {
          recentMatchRef.current.delete(gone.id)   // its grace period would bring it back
          dropMatch(gone.id)
          removeMatch(gone.id, room.type)
        }
      },
    })
    return unsub
  }, [isSolo, room.id, phase, places]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tell others this user finished swiping places (DONE sentinel) ─────────
  useEffect(() => {
    if (isSolo || phase !== 'places') return
    if (!(finishedSwiping || isDone) || donePlacesSignalledRef.current) return
    donePlacesSignalledRef.current = true
    track('swiping_done', { type: room.type, swiped: seen, matches: matchesRef.current.length })
    recordSwipe(room.id, userToken.current, DONE_ITEM_ID, 'right', playerCount).catch(() => {})
  }, [isSolo, phase, finishedSwiping, isDone, room.id, room.type, playerCount, seen])

  // ── Tell the still-swiping user once a partner finished the places phase.
  // Places don't record passes, so "how far did they get" can't be derived
  // from likes — the banner simply shows as soon as they're done. Like the
  // movie deck it says how many of their picks are still ahead, which is the
  // actual reason to keep going. ──
  useEffect(() => {
    if (isSolo) return
    let active = true
    let handled = false
    const markDone = (picks) => {
      if (!active || handled) return
      handled = true
      setPartnerDone(true)
      // Their likes are final now: the full set still reachable in this deck.
      if (picks?.partnerIds) setPartnerLikeIds(picks.partnerIds)
      else fetchRoomPicks(room.id, userToken.current)
        .then(p => { if (active && p?.partnerIds) setPartnerLikeIds(p.partnerIds) })
        .catch(() => {})
    }
    const check = () => fetchRoomPicks(room.id, userToken.current)
      .then(p => { if (p && p.othersDone > 0) markDone(p) })
      .catch(() => {})
    check()
    const unsub = subscribeToRoomPicks(room.id, userToken.current, (swipe) => {
      if (Number(swipe.item_id) === DONE_ITEM_ID) markDone()
    })
    const poll = setInterval(() => { if (!handled) check() }, 5000)
    return () => { active = false; clearInterval(poll); unsub() }
  }, [isSolo, room.id, round])

  // ── fetchAndTransitionToPlaces ────────────────────────────────────────────
  const fetchAndTransitionToPlaces = useCallback(async (matchedCats, { compromise = false } = {}) => {
    if (placesTransitionFiredRef.current) return
    placesTransitionFiredRef.current = true
    setMatchedCategories(matchedCats)
    setIsCompromise(compromise)
    setTransitioning(true)
    setFetchingPlaces(true)

    // Race guard: if the other person already fetched places, reuse them instead
    // of making a second (divergent, paid) Google call.
    try {
      const existing = await getRoom(room.id)
      const data = existing ? parseRoomPlacesData(existing) : null
      if (data && data.places.length > 0) {
        setPlaces(data.places)
        setMatchedCategories(data.matchedCategories.length ? data.matchedCategories : matchedCats)
        setIsCompromise(data.compromise)
        setFetchingPlaces(false)
        setPhase('places')
        setCurrentIndex(0)
        setSeen(0)
        setTransitioning(false)
        setWaitingForPartner(false)
        return
      }
    } catch { /* fall through and fetch */ }

    let allPlaces = []
    let fetchError = null
    if (location?.lat != null && matchedCats.length > 0) {
      // Fetch per-category lists, then interleave round-robin (Italian, Japanese, Italian, Japanese…)
      // All categories at once: one after another cost a full round trip each.
      // Results stay in matchedCats order, so the interleave is unchanged.
      const settled = await Promise.allSettled(matchedCats.map(cat =>
        fetchNearbyPlaces(location.lat, location.lng, location.radius || 5000, cat.types, room.id)))
      const perCat = settled.map((r, i) => {
        if (r.status === 'fulfilled') return r.value
        console.error('[PlacesRoom] fetch error for', matchedCats[i].label, r.reason)
        fetchError = fetchError || r.reason   // remember the first real API/network failure
        return []
      })
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
    // instead of the misleading "No places found nearby" empty state.
    if (allPlaces.length === 0 && fetchError) {
      setPlacesError(fetchError.message || 'Something went wrong loading places. Please try again.')
      setPhase('places')
      setTransitioning(false)
      setWaitingForPartner(false)
      return
    }

    try {
      await updateActivityRoomPhase(room.id, { phase: 'places', matched_categories: matchedCats, places: allPlaces, locationData: location, compromise, round: roundRef.current })
    } catch (err) { console.error('[PlacesRoom] updateActivityRoomPhase error:', err) }

    // Read canonical places from DB
    try {
      const canonical = await getRoom(room.id)
      if (canonical) {
        const data = parseRoomPlacesData(canonical)
        if (data.places.length > 0) allPlaces = data.places
      }
    } catch { /* canonical read failed — use local allPlaces */ }

    setPlaces(allPlaces)
    setPhase('places')
    setCurrentIndex(0)
    setSeen(0)
    setTransitioning(false)
    setWaitingForPartner(false)
  }, [location, room.id])  

  // The done-marker is per round: `base` for the first pass, base-1 for the
  // next, and so on. Without that, a second round would count everyone's old
  // marker and transition the moment the first person confirmed.
  const catDoneId = kind.catDoneBase - round

  // What the room should search for. Normally the categories everyone liked; if
  // nobody agreed on a single one, the most-voted ones instead — an empty list
  // used to write a places phase with no places and strand the room.
  const resolveMatchedCategories = useCallback(async () => {
    const allMatchIds = await fetchRoomMatches(room.id, userToken.current, playerCount)
    if (allMatchIds === null) throw new Error('Could not read the picks - try confirming again')
    const matched = CATS.filter(c => allMatchIds.includes(c.numId))
    if (matched.length > 0) return { cats: matched, compromise: false }
    const counts = await fetchVoteCounts(room.id)
    const scored = CATS
      .map(c => ({ c, n: counts[c.numId] || 0 }))
      .filter(x => x.n > 0)
      .sort((a, b) => b.n - a.n)
    return { cats: scored.slice(0, 3).map(x => x.c), compromise: scored.length > 0 }
  }, [room.id, playerCount, CATS])

  // Everyone drops back to the picker together after a "try different" — the
  // room row carries the round number, and each client resets when it sees a
  // higher one than its own.
  const startNewRound = useCallback((nextRound) => {
    allDoneSeenRef.current = 0
    placesTransitionFiredRef.current = false
    likedCatIdsRef.current = new Set()
    setRound(nextRound)
    setSelectedCats(new Set())
    setPhase('categories')
    setPlaces([])
    setMatchedCategories([])
    setIsCompromise(false)
    setCurrentIndex(0)
    setSeen(0)
    setPlacesError(null)
    setWaitingForPartner(false)
    setTransitioning(false)
    // The new round is a new deck: nothing of the old one carries over (its
    // matches stay in Saved matches).
    matchesRef.current = []
    matchEditRef.current++
    setMatches([])
    setLikedPlaces([])
    rejectedBrandsRef.current = new Set()
    setSkippedBrands(new Set())
    setIsDone(false)
    historyRef.current = []
    setCanUndo(false)
    setPartnerDone(false)
    setPartnerLikeIds([])
    donePlacesSignalledRef.current = false
    recentMatchRef.current.clear()
    closeModal()
    endBurst()
    try { sessionStorage.removeItem(placesKey(room.id)) } catch { /* storage blocked */ }
  }, [room.id, closeModal, endBurst])

  // ── handleCategoriesDone ──────────────────────────────────────────────────
  const handleCategoriesDone = useCallback(async () => {
    if (isSolo) {
      const likedCats = CATS.filter(c => likedCatIdsRef.current.has(c.numId))
      const catsToUse = likedCats.length > 0 ? likedCats : []
      await fetchAndTransitionToPlaces(catsToUse)
      return
    }
    waitStartRef.current = Date.now()
    setWaitingForPartner(true)
    try {
      await Promise.all(pendingSwipesRef.current)
      pendingSwipesRef.current = []

      const isAllDone = await recordSwipe(room.id, userToken.current, catDoneId, 'right', playerCount)
      try {
        sessionStorage.setItem(catsKey(room.id), JSON.stringify({ round: roundRef.current, ids: [...likedCatIdsRef.current] }))
      } catch { /* storage blocked: a reload just shows the picker again */ }
      if (isAllDone) {
        const resolved = await resolveMatchedCategories()
        // Nothing to search for means the vote read came back empty — don't
        // write a places phase with no places, that's the dead end we just fixed.
        if (resolved.cats.length === 0) throw new Error('Could not read the picks - try confirming again')
        await fetchAndTransitionToPlaces(resolved.cats, { compromise: resolved.compromise })
      }
    } catch (err) {
      console.error('[PlacesRoom] handleCategoriesDone error:', err)
      setWaitingForPartner(false)
    }
  }, [isSolo, room.id, playerCount, catDoneId, CATS, resolveMatchedCategories, fetchAndTransitionToPlaces])  

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
      const data = parseRoomPlacesData(updatedRoom)
      // Someone hit "try different …" — everyone goes back to the picker.
      if (data.round > roundRef.current) { startNewRound(data.round); return }
      if (data.phase === 'places' && phase === 'categories') {
        if (placesTransitionFiredRef.current) return
        placesTransitionFiredRef.current = true
        setMatchedCategories(data.matchedCategories)
        setIsCompromise(data.compromise)
        setTransitioning(true)
        // A short beat to read what you matched on, then the places
        setTimeout(() => {
          setPlaces(data.places)
          setPhase('places')
          setCurrentIndex(0)
          setSeen(0)
          setTransitioning(false)
          setWaitingForPartner(false)
        }, 600)
      }
    })
    // Realtime can be missed (backgrounded phone). The empty-places screen is a
    // dead end until someone starts a new round, so poll for that while it shows.
    const poll = (phase === 'places' && places.length === 0)
      ? setInterval(() => {
          getRoom(room.id)
            .then(r => { if (r && parseRoomPlacesData(r).round > roundRef.current) startNewRound(parseRoomPlacesData(r).round) })
            .catch(() => {})
        }, 4000)
      : null
    return () => { unsub(); if (poll) clearInterval(poll) }
  }, [isSolo, room.id, phase, places.length, startNewRound])  

  // ── Polling fallback ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'categories' || isSolo) return
    // Spread out across clients so two people don't both take over (and both
    // pay for a Google search) in the same second.
    const takeoverAfter = 9000 + (parseInt(userToken.current.slice(0, 2), 16) % 6) * 1500
    const interval = setInterval(async () => {
      try {
        const latest = await getRoom(room.id)
        if (!latest) return
        const data = parseRoomPlacesData(latest)
        if (data.round > roundRef.current) { startNewRound(data.round); return }
        if (data.round < roundRef.current) return          // stale row, ignore
        if (data.phase === 'places' && !placesTransitionFiredRef.current) {
          placesTransitionFiredRef.current = true
          setMatchedCategories(data.matchedCategories)
          setIsCompromise(data.compromise)
          setPlaces(data.places)
          setPhase('places')
          setCurrentIndex(0)
          setSeen(0)
          setWaitingForPartner(false)
          setTransitioning(false)
          return
        }
        // Takeover: everyone has confirmed, but nobody wrote the places phase —
        // the last confirmer closed the app or their Places call died. Whoever
        // is still waiting finishes the job instead of waiting forever.
        if (waitingForPartner && !placesTransitionFiredRef.current &&
            Date.now() - waitStartRef.current > takeoverAfter) {
          const likers = await countItemLikers(room.id, catDoneId)
          if (likers != null && likers >= playerCount) {
            // Give the last confirmer their full head start to write the places.
            if (!allDoneSeenRef.current) { allDoneSeenRef.current = Date.now(); return }
            if (Date.now() - allDoneSeenRef.current <= takeoverAfter) return
            const resolved = await resolveMatchedCategories()
            if (resolved.cats.length > 0) {
              await fetchAndTransitionToPlaces(resolved.cats, { compromise: resolved.compromise })
            }
          }
        }
      } catch (err) { console.error('[PlacesRoom] categories poll:', err) }
    }, 3000)
    return () => clearInterval(interval)
  }, [isSolo, room.id, phase, waitingForPartner, playerCount, catDoneId, startNewRound, resolveMatchedCategories, fetchAndTransitionToPlaces])  

  // ── Swipe a place ─────────────────────────────────────────────────────────
  const handlePlaceSwipe = useCallback(async (direction) => {
    const place = places[currentIndex]
    if (!place) return

    const brand = getBrandKey(place.title)
    const entry = { index: currentIndex, place, direction, addedBrand: false, pending: null, undone: false }
    if (direction === 'left' && !rejectedBrandsRef.current.has(brand)) {
      rejectedBrandsRef.current.add(brand)
      entry.addedBrand = true
      setSkippedBrands(new Set(rejectedBrandsRef.current))
    }
    historyRef.current.push(entry)
    setCanUndo(true)
    setSeen(n => n + 1)

    let nextIndex = currentIndex + 1
    while (nextIndex < places.length && rejectedBrandsRef.current.has(getBrandKey(places[nextIndex].title))) {
      nextIndex++
    }
    setCurrentIndex(nextIndex)

    if (direction !== 'right') return

    setLikedPlaces(prev => prev.find(p => p.id === place.id) ? prev : [...prev, place])

    if (!isSolo) {
      try {
        entry.pending = recordSwipe(room.id, userToken.current, place.numId, direction, playerCount)
        const isMatch = await entry.pending
        if (isMatch && !entry.undone) {
          matchEditRef.current++
          recentMatchRef.current.set(place.id, Date.now())
          track('match', { type: room.type })
          notifyRoom(room.id, 'match', { from: userToken.current, itemId: place.numId })
          showMatch(place)
          setMatches(prev => prev.find(m => m.id === place.id) ? prev : [...prev, place])
        }
      } catch (err) {
        console.error('recordSwipe error:', err)
      }
    }
  }, [isSolo, places, currentIndex, room.id, room.type, playerCount, showMatch])

  // Step back one place. A skipped brand comes back into the deck; a taken-back
  // like is written as a newer 'left' vote so its match disappears too.
  const handlePlaceUndo = useCallback(async () => {
    const last = historyRef.current.pop()
    setCanUndo(historyRef.current.length > 0)
    if (!last) return
    last.undone = true
    if (last.addedBrand) {
      rejectedBrandsRef.current.delete(getBrandKey(last.place.title))
      setSkippedBrands(new Set(rejectedBrandsRef.current))
    }
    setCurrentIndex(last.index)
    setSeen(n => Math.max(0, n - 1))
    track('swipe_undo', { type: room.type, direction: last.direction })
    if (last.direction !== 'right') return
    setLikedPlaces(prev => prev.filter(p => p.id !== last.place.id))
    const wasMatch = matchesRef.current.some(m => m.id === last.place.id)
    setMatches(prev => prev.filter(p => p.id !== last.place.id))
    // The burst takes no taps, so undo stays reachable while it plays.
    dropMatch(last.place.id)
    if (isSolo) return
    if (wasMatch) removeMatch(last.place.id, room.type)
    matchEditRef.current++
    recentMatchRef.current.delete(last.place.id)
    takingBackRef.current.add(last.place.id)
    try {
      await last.pending?.catch(() => {})
      await recordSwipe(room.id, userToken.current, last.place.numId, 'left', playerCount)
    } catch (err) {
      console.error('Failed to take back a like:', err)
    } finally {
      takingBackRef.current.delete(last.place.id)
    }
  }, [isSolo, room.id, room.type, playerCount, dropMatch])

  // ── Match moments (together mode only) ────────────────────────────────────
  // The deck's first match opens the dialog, every later one flies into the
  // counter. Also over the results: a like on the very last card that makes a
  // match lands there (a partner's match on the results is not celebrated).
  const canKeepSwiping = !isDone && currentIndex < places.length
  // Cards still to come, not counting the branches of a chain being skipped.
  const left = places.slice(currentIndex).filter(p => !skippedBrands.has(getBrandKey(p.title))).length
  // A place without a photo: its category's emoji when the room matched on one.
  const placeEmoji = matchedCategories.length === 1 ? matchedCategories[0].emoji : kind.emoji
  const matchLayer = !isSolo && (
    <>
      {/* Stays mounted, so a screen reader hears each later match. */}
      <div className="room-sr-only" role="status" aria-live="polite"><span key={moments.bumpKey}>{moments.announce}</span></div>
      {moments.burstItem && (
        <MatchBurst key={moments.burstItem.id} item={moments.burstItem} roomType={room.type} emoji={placeEmoji} onDone={moments.endBurst} />
      )}
      {moments.modalItem && (
        <MatchModal
          item={moments.modalItem}
          roomType={room.type}
          swipeCount={seen}
          matchCount={1}
          subtitle={playerCount > 2 ? kind.matchGroup : kind.matchPair}
          emoji={placeEmoji}
          remaining={canKeepSwiping ? left : 0}
          onContinue={canKeepSwiping ? moments.closeModal : null}
          onDone={() => { moments.closeModal(); setIsDone(true) }}
        />
      )}
    </>
  )

  // ── Results → RankingView ─────────────────────────────────────────────────
  // Straight after the last card, like the movie deck: the results show the
  // partner's progress live, so a separate "waiting for your partner" screen
  // only kept people from their matches.
  if (isDone || finishedSwiping) {
    const normalizedPlaces = places.map(p => ({ ...p, id: p.numId }))
    const resultsToShow = isSolo ? likedPlaces : matches

    let finalResults = resultsToShow
    let usedVoteFallback = false
    if (!isSolo && resultsToShow.length === 0 && playerCount > 2 && Object.keys(voteCounts).length > 0) {
      const sorted = [...normalizedPlaces].sort((a, b) => (voteCounts[b.id] || 0) - (voteCounts[a.id] || 0))
      const best = sorted.filter(p => (voteCounts[p.id] || 0) >= 2).slice(0, 10)
      // Only a list with something on it: an empty "Most wanted (0)" says less
      // than "no matches yet".
      if (best.length > 0) { usedVoteFallback = true; finalResults = best }
    }

    const normalizedResults = finalResults.map(p => ({ ...p, id: p.numId }))
    return (
      <>
      <RankingView
        matches={normalizedResults}
        liked={likedPlaces.map(p => ({ ...p, id: p.numId }))}
        room={room}
        movies={normalizedPlaces}
        onDone={onDone}
        isSolo={isSolo}
        playerCount={playerCount}
        voteCounts={voteCounts}
        isFallback={usedVoteFallback}
      />
      {matchLayer}
      </>
    )
  }

  // ── Waiting for group to finish categories ───────────────────────────────
  if (waitingForPartner && !transitioning) {
    const likedCats = CATS.filter(c => selectedCats.has(c.numId))
    const othersNeeded = playerCount - 1
    // participantCount only counts players who have confirmed something, so a
    // partner who opened the link and is still picking looked absent, and the
    // creator kept being told to invite them. In a pair Room knows better.
    const everyoneIn = participantCount >= playerCount || (playerCount === 2 && partnerJoined)
    return (
      <div className="act-center has-app-header">
        <AppHeader className="center-app-header" />
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
              ? `You've picked your ${kind.picked}. Waiting for the other ${othersNeeded} player${othersNeeded !== 1 ? 's' : ''}.`
              : everyoneIn
                ? `You've picked your ${kind.picked}. Your partner is picking theirs now.`
                : `You've picked your ${kind.picked}. Hang tight!`}
          </p>
          {likedCats.length > 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8 }}>
              Your picks: {likedCats.map(c => `${c.emoji} ${c.label}`).join(', ')}
            </p>
          )}
          {!everyoneIn ? (
            <div className="act-waiting-invite">
              <p className="act-waiting-text">
                {playerCount > 2
                  ? `Invite the others. Everyone picks their own ${kind.picked} on their phone, then you all swipe through places you agree on.`
                  : `Invite your partner. They pick their own ${kind.picked} on their phone, then you both swipe through places you agree on.`}
              </p>
              <InvitePanel roomId={room.id} type={room.type} />
            </div>
          ) : (
            <div className="loader" style={{ margin: '16px auto' }} />
          )}
        </div>
      </div>
    )
  }

  // ── Transition / celebration screen ──────────────────────────────────────
  if (transitioning) {
    return (
      <div className="act-center has-app-header">
        <AppHeader className="center-app-header" />
        <div className="act-transition">
          {fetchingPlaces ? (
            <>
              <div className="act-transition-emoji">🔍</div>
              <h2>Finding {kind.places}…</h2>
              <p className="act-transition-sub">
                Searching for {matchedCategories.map(c => c.label).join(', ')} nearby
              </p>
              <div className="loader" style={{ marginTop: 20 }} />
            </>
          ) : matchedCategories.length > 0 ? (
            <>
              <div className="act-transition-emoji">{isCompromise && !isSolo ? '🤝' : '🎉'}</div>
              <h2>
                {isSolo
                  ? `Finding ${kind.catCount(matchedCategories.length)}…`
                  : isCompromise
                    ? 'Meeting in the middle'
                    : `You matched on ${kind.catCount(matchedCategories.length)}!`}
              </h2>
              <p className="act-transition-sub">
                {isCompromise && !isSolo && 'No exact match, so here\u2019s what got the most votes: '}
                {matchedCategories.map(c => `${c.emoji} ${c.label}`).join(' · ')}
              </p>
              <div className="loader" style={{ marginTop: 20 }} />
            </>
          ) : (
            <>
              <div className="act-transition-emoji">😅</div>
              <h2>{isSolo ? kind.noneSelected : kind.noneMatched}</h2>
              <p className="act-transition-sub">{isSolo ? kind.soloNoneHint : kind.noAgreement}</p>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Places fetch error ────────────────────────────────────────────────────
  async function retryCategories() {
    const next = roundRef.current + 1
    startNewRound(next)
    if (isSolo) return
    // Persist the new round so the other players reset too. Without this their
    // client kept reading the old "places" row and dragged this one back into it.
    try {
      await updateActivityRoomPhase(room.id, {
        phase: 'categories', matched_categories: [], places: [], locationData: location, round: next,
      })
    } catch (err) { console.error('[PlacesRoom] retryCategories:', err) }
  }

  if (phase === 'places' && placesError) {
    return (
      <div className="act-center has-app-header">
        <AppHeader className="center-app-header" />
        <div className="act-error">
          <div className="act-error-icon">😕</div>
          <h2>Couldn't load {kind.places}</h2>
          <p className="act-error-sub">{placesError}</p>
          <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={retryCategories}>
            {kind.tryDifferent}
          </button>
          <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={onDone}>Go home</button>
        </div>
      </div>
    )
  }

  // ── No places found ───────────────────────────────────────────────────────
  if (phase === 'places' && places.length === 0) {
    return (
      <div className="act-center has-app-header">
        <AppHeader className="center-app-header" />
        <div className="act-error">
          <div className="act-error-icon">{matchedCategories[0]?.emoji || kind.emoji}</div>
          <h2>No {kind.places} found</h2>
          <p className="act-error-sub">
            We couldn't find any {matchedCategories.map(c => c.label).join(' or ') || kind.places} nearby.
            {!location ? kind.noLocation : kind.tryOther}
          </p>
          <button className="btn btn-primary" onClick={retryCategories}>{kind.tryDifferent}</button>
          <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={onDone}>Go home</button>
        </div>
      </div>
    )
  }

  // ── No location set ───────────────────────────────────────────────────────
  if (!location) {
    return (
      <div className="act-center has-app-header">
        <AppHeader className="center-app-header" />
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
          <span className="act-phase-label">{kind.gridTitle}</span>
          <div className="act-header-right">
            <span className="act-progress">{selectedCats.size} selected</span>
            <ThemeToggle />
          </div>
        </div>

        {banner && <div className="act-banner">{banner}</div>}

        <div className="act-grid-scroll">
          <p className="act-grid-hint">
            {isSolo
              ? kind.hintSolo
              : playerCount > 2
                ? kind.hintGroup(playerCount)
                : kind.hintPair}
          </p>
          <CategoryGrid
            categories={CATS}
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
              ? `Finding ${kind.places}…`
              : selectedCats.size === 0
                ? 'Pick at least one'
                : `Find ${kind.places} · ${selectedCats.size} selected`}
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
          {location?.locationName ? `near ${location.locationName}` : kind.placesTitle}
        </span>
        <div className="act-header-right">
          {isSolo
            ? likedPlaces.length > 0 && <span className="room-matches">{likedPlaces.length} pick{likedPlaces.length !== 1 ? 's' : ''}</span>
            : matches.length > 0 && (
              // The burst flies into this pill; the key replays its bump.
              <span key={moments.bumpKey} className={`room-matches${moments.bumpKey > 0 ? ' is-bump' : ''}`}>
                {matches.length} match{matches.length !== 1 ? 'es' : ''}
              </span>
            )}
          <span className="act-progress">{seen + 1} / {seen + left}</span>
          <ThemeToggle />
        </div>
      </div>

      {partnerDone && !isSolo && (() => {
        // In a pair a match needs only their like, so count their picks still
        // ahead (minus brands this player is skipping). A group needs everyone.
        const theirs = new Set(partnerLikeIds)
        const reachable = playerCount > 2 ? 0 : places.slice(currentIndex)
          .filter(p => theirs.has(p.numId) && !skippedBrands.has(getBrandKey(p.title))).length
        return (
          <div className="act-banner">
            <div className="partner-done-banner">
              <span className="partner-done-dot" aria-hidden="true" />
              {playerCount > 2
                ? 'Someone finished swiping'
                : reachable > 0
                  ? `Your partner finished · ${reachable} possible match${reachable !== 1 ? 'es' : ''} left`
                  : 'Your partner finished swiping'}
            </div>
          </div>
        )
      })()}

      <div className="act-cards">
        <SwipeCard
          key={currentPlace.id}
          item={currentPlace}
          onSwipe={handlePlaceSwipe}
          onUndo={handlePlaceUndo}
          canUndo={canUndo}
          fallbackEmoji={placeEmoji}
          paused={Boolean(moments.modalItem)}
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

      {matchLayer}
    </div>
  )
}
