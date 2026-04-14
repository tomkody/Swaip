import { useState, useEffect, useRef, useCallback } from 'react'
import confetti from 'canvas-confetti'
import { getUserToken, recordSwipe, subscribeToSwipes, checkMutualSwipesByPrefix } from '../lib/room'
import { saveMatch } from '../lib/savedMatches'
import { generateShareImage, downloadCanvas } from '../lib/shareImage'
import SwipeCard from './SwipeCard'
import './FoodRoom.css'

const CUISINES = [
  { id: 'food_cuisine_italian',  title: 'Italian',  emoji: '🍝', overview: 'Pasta, pizza, risotto, tiramisu…' },
  { id: 'food_cuisine_sushi',    title: 'Sushi',    emoji: '🍱', overview: 'Fresh rolls, sashimi, miso, edamame…' },
  { id: 'food_cuisine_burgers',  title: 'Burgers',  emoji: '🍔', overview: 'Juicy patties, crispy fries, milkshakes…' },
  { id: 'food_cuisine_indian',   title: 'Indian',   emoji: '🍛', overview: 'Curries, naan, biryani, samosas…' },
  { id: 'food_cuisine_mexican',  title: 'Mexican',  emoji: '🌮', overview: 'Tacos, burritos, guac, churros…' },
  { id: 'food_cuisine_chinese',  title: 'Chinese',  emoji: '🥟', overview: 'Dim sum, dumplings, noodles, Peking duck…' },
  { id: 'food_cuisine_french',   title: 'French',   emoji: '🥐', overview: 'Croissants, coq au vin, crème brûlée…' },
  { id: 'food_cuisine_thai',     title: 'Thai',     emoji: '🍜', overview: 'Pad thai, green curry, mango sticky rice…' },
  { id: 'food_cuisine_pizza',    title: 'Pizza',    emoji: '🍕', overview: 'Margherita, pepperoni, calzone, garlic bread…' },
]

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY

function getDemoRestaurants(cuisineTitle) {
  const names = {
    Italian:  [['La Bella Trattoria','⭐ 4.7 · $$','🍝'],['Piccolo Roma','⭐ 4.5 · $$$','🫙'],['Pasta e Basta','⭐ 4.4 · $$','🍕']],
    Sushi:    [['Sakura Sushi Bar','⭐ 4.8 · $$$','🍱'],['Maki House','⭐ 4.6 · $$','🥢'],['Tokyo Bites','⭐ 4.5 · $$','🍣']],
    Burgers:  [['The Burger Lab','⭐ 4.7 · $$','🍔'],['Smash & Grill','⭐ 4.6 · $','🧀'],['Old School Burgers','⭐ 4.5 · $$','🥓']],
    Indian:   [['Spice Garden','⭐ 4.7 · $$','🍛'],['Taj Mahal Kitchen','⭐ 4.6 · $$$','🌶️'],['Curry House','⭐ 4.5 · $$','🫓']],
    Mexican:  [['El Rancho','⭐ 4.7 · $$','🌮'],['Taqueria Local','⭐ 4.6 · $','🌯'],['Casa Mexica','⭐ 4.5 · $$','🥑']],
    Chinese:  [['Golden Dragon','⭐ 4.7 · $$','🥟'],['Dim Sum Palace','⭐ 4.6 · $$$','🍜'],['Wonton House','⭐ 4.5 · $','🫕']],
    French:   [['Café de Paris','⭐ 4.8 · $$$','🥐'],['Bistro Lyon','⭐ 4.6 · $$','🍷'],['Le Petit Four','⭐ 4.5 · $$$','🧁']],
    Thai:     [['Thai Orchid','⭐ 4.7 · $$','🍜'],['Pad Thai Palace','⭐ 4.6 · $','🥜'],['Bangkok Spice','⭐ 4.5 · $$','🌿']],
    Pizza:    [['Napoli Wood Fire','⭐ 4.8 · $$','🍕'],['Slice of Life','⭐ 4.6 · $','🧀'],['The Pizza Lab','⭐ 4.5 · $$','🫙']],
  }
  const list = names[cuisineTitle] || names.Burgers
  return list.map(([title, overview, emoji], i) => ({
    id: `demo_${cuisineTitle.toLowerCase()}_${i}`,
    title, overview, emoji, poster: null,
  }))
}

export default function FoodRoom({ room, onDone }) {
  const [phase, setPhase] = useState('cuisine')
  const [cuisineIndex, setCuisineIndex] = useState(0)
  const [matchedCuisine, setMatchedCuisine] = useState(null)
  const [restaurants, setRestaurants] = useState([])
  const [restaurantIndex, setRestaurantIndex] = useState(0)
  const [finalMatch, setFinalMatch] = useState(null)
  const [locationNote, setLocationNote] = useState(null)
  const [sharing, setSharing] = useState(false)
  const [swipeCount, setSwipeCount] = useState(0)
  const restaurantsRef = useRef([])
  const phaseRef = useRef('cuisine')
  const userToken = useRef(getUserToken())
  const matchedRef = useRef(false) // prevent double-triggering

  useEffect(() => { restaurantsRef.current = restaurants }, [restaurants])
  useEffect(() => { phaseRef.current = phase }, [phase])

  // ── Match handlers ─────────────────────────────────────────────
  const handleCuisineMatch = useCallback((cuisine) => {
    if (matchedRef.current) return
    matchedRef.current = true
    setMatchedCuisine(cuisine)
    setPhase('locating')
    fetchRestaurants(cuisine.title)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRestaurantMatch = useCallback((restaurant) => {
    if (phaseRef.current === 'matched') return
    setFinalMatch(restaurant)
    setPhase('matched')
    saveMatch({
      id: restaurant.id,
      title: restaurant.title,
      category: 'food',
      image: restaurant.poster || null,
      rating: restaurant.overview || null,
    })
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } })
  }, [])

  // ── Realtime subscription (Supabase) ───────────────────────────
  useEffect(() => {
    const unsub = subscribeToSwipes(room.id, userToken.current, (itemId) => {
      if (phaseRef.current === 'matched') return
      if (itemId.startsWith('food_cuisine_')) {
        const cuisine = CUISINES.find(c => c.id === itemId)
        if (cuisine) handleCuisineMatch(cuisine)
      } else {
        const restaurant = restaurantsRef.current.find(r => r.id === itemId)
        if (restaurant) handleRestaurantMatch(restaurant)
      }
    })
    return unsub
  }, [room.id, handleCuisineMatch, handleRestaurantMatch])

  // ── Polling fallback (localStorage / missed real-time events) ──
  // Polls every 1.5s during cuisine phase to catch partner matches
  // that may have been missed (player A swiped right before B did)
  useEffect(() => {
    if (phase !== 'cuisine') return
    const interval = setInterval(async () => {
      if (matchedRef.current) { clearInterval(interval); return }
      try {
        const matchedId = await checkMutualSwipesByPrefix(room.id, userToken.current, 'food_cuisine_')
        if (matchedId) {
          clearInterval(interval)
          const cuisine = CUISINES.find(c => c.id === matchedId)
          if (cuisine) handleCuisineMatch(cuisine)
        }
      } catch (err) { console.warn('Poll error:', err) }
    }, 1500)
    return () => clearInterval(interval)
  }, [phase, room.id, handleCuisineMatch])

  // ── Same polling for restaurant phase ─────────────────────────
  // Uses a generic prefix-free check: looks for any mutual swipe on items
  // that appear in the current restaurant list
  useEffect(() => {
    if (phase !== 'restaurant') return
    const interval = setInterval(async () => {
      if (phaseRef.current === 'matched') { clearInterval(interval); return }
      const list = restaurantsRef.current
      if (!list.length) return
      // Use first restaurant id to infer prefix
      const firstId = list[0].id
      const prefix = firstId.startsWith('demo_') ? 'demo_' : firstId.slice(0, 8)
      try {
        const matchedId = await checkMutualSwipesByPrefix(room.id, userToken.current, prefix)
        if (!matchedId) return
        const restaurant = list.find(r => r.id === matchedId)
        if (restaurant) {
          clearInterval(interval)
          handleRestaurantMatch(restaurant)
        }
      } catch (err) { console.warn('Poll error:', err) }
    }, 1500)
    return () => clearInterval(interval)
  }, [phase, room.id, handleRestaurantMatch])

  // ── Fetch restaurants ──────────────────────────────────────────
  async function fetchRestaurants(cuisineTitle) {
    if (!GOOGLE_KEY) {
      setLocationNote('No API key set — showing demo restaurants.')
      setRestaurants(getDemoRestaurants(cuisineTitle))
      setPhase('restaurant')
      return
    }
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      )
      const { latitude: lat, longitude: lng } = pos.coords
      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.photos,places.priceLevel,places.currentOpeningHours',
        },
        body: JSON.stringify({
          textQuery: `${cuisineTitle} restaurant`,
          locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 5000 } },
          maxResultCount: 15,
        }),
      })
      const data = await res.json()
      if (data.places?.length > 0) {
        setRestaurants(data.places.map(p => ({
          id: p.id,
          title: p.displayName?.text || 'Restaurant',
          overview: [p.formattedAddress, p.currentOpeningHours?.openNow ? '🟢 Open now' : ''].filter(Boolean).join(' · '),
          rating: p.rating ? `⭐ ${p.rating.toFixed(1)}${p.priceLevel ? ' · ' + '$'.repeat(p.priceLevel - 1 || 1) : ''}` : null,
          poster: p.photos?.[0] ? `https://places.googleapis.com/v1/${p.photos[0].name}/media?maxWidthPx=400&key=${GOOGLE_KEY}` : null,
          emoji: '🍽️',
        })))
        setPhase('restaurant')
      } else throw new Error('No results')
    } catch (err) {
      console.warn('Places API error:', err.message)
      setLocationNote('Could not fetch nearby restaurants. Showing popular spots instead.')
      setRestaurants(getDemoRestaurants(cuisineTitle))
      setPhase('restaurant')
    }
  }

  // ── Swipe handlers ─────────────────────────────────────────────
  const handleCuisineSwipe = useCallback(async (direction) => {
    const cuisine = CUISINES[cuisineIndex]
    if (!cuisine || matchedRef.current) return
    setSwipeCount(n => n + 1)
    try {
      const isMatch = await recordSwipe(room.id, userToken.current, cuisine.id, direction)
      if (isMatch && direction === 'right') {
        handleCuisineMatch(cuisine)
        return // don't increment index after match
      }
    } catch (err) { console.error(err) }
    setCuisineIndex(i => i + 1)
  }, [cuisineIndex, room.id, handleCuisineMatch])

  const handleRestaurantSwipe = useCallback(async (direction) => {
    const restaurant = restaurantsRef.current[restaurantIndex]
    if (!restaurant || phaseRef.current === 'matched') return
    setSwipeCount(n => n + 1)
    try {
      const isMatch = await recordSwipe(room.id, userToken.current, restaurant.id, direction)
      if (isMatch && direction === 'right') {
        handleRestaurantMatch(restaurant)
        return
      }
    } catch (err) { console.error(err) }
    setRestaurantIndex(i => i + 1)
  }, [restaurantIndex, room.id, handleRestaurantMatch])

  async function handleShare() {
    if (!finalMatch || sharing) return
    setSharing(true)
    try {
      const canvas = await generateShareImage({ title: finalMatch.title, posterUrl: finalMatch.poster, swipeCount })
      downloadCanvas(canvas, `swaip-${finalMatch.title.replace(/\s+/g, '-').toLowerCase()}.png`)
    } catch (err) { console.error('Share error:', err) }
    finally { setSharing(false) }
  }

  // ── Render ─────────────────────────────────────────────────────

  if (phase === 'cuisine') {
    const current = CUISINES[cuisineIndex]
    if (!current) {
      return (
        <div className="food-center">
          <div className="food-done-all">
            <div className="food-done-icon">😅</div>
            <h2>No match yet</h2>
            <p>You swiped through all cuisines but your partner hasn't matched any yet. Ask them to hurry up! 😄</p>
            <button className="btn btn-primary" onClick={() => { matchedRef.current = false; setCuisineIndex(0); setSwipeCount(0) }}>Start over</button>
            <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={onDone}>Go home</button>
          </div>
        </div>
      )
    }
    return (
      <div className="food-room">
        <div className="food-header">
          <span className="food-phase-label">🍽️ Pick a Cuisine</span>
          <span className="food-progress">{cuisineIndex + 1} / {CUISINES.length}</span>
        </div>
        <div className="food-cards">
          <SwipeCard key={current.id} item={current} onSwipe={handleCuisineSwipe} active />
        </div>
      </div>
    )
  }

  if (phase === 'locating') {
    return (
      <div className="food-center">
        <div className="food-locating">
          <div className="food-locating-icon">📍</div>
          <h2>You both love <span>{matchedCuisine?.title}</span>!</h2>
          <p>Finding the best {matchedCuisine?.title?.toLowerCase()} restaurants near you…</p>
          <div className="food-locating-dots"><span /><span /><span /></div>
        </div>
      </div>
    )
  }

  if (phase === 'restaurant') {
    const current = restaurants[restaurantIndex]
    if (!current) {
      return (
        <div className="food-center">
          <div className="food-done-all">
            <div className="food-done-icon">🤷</div>
            <h2>No restaurant match</h2>
            <p>You both ran out of {matchedCuisine?.title?.toLowerCase()} restaurants. Try another cuisine!</p>
            <button className="btn btn-primary" onClick={() => { matchedRef.current = false; setPhase('cuisine'); setCuisineIndex(0); setMatchedCuisine(null) }}>Try another cuisine</button>
            <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={onDone}>Go home</button>
          </div>
        </div>
      )
    }
    return (
      <div className="food-room">
        {locationNote && <div className="food-location-note">{locationNote}</div>}
        <div className="food-header">
          <span className="food-phase-label">{matchedCuisine?.emoji} {matchedCuisine?.title} spots</span>
          <span className="food-progress">{restaurantIndex + 1} / {restaurants.length}</span>
        </div>
        <div className="food-cards">
          <SwipeCard key={current.id} item={current} onSwipe={handleRestaurantSwipe} active />
        </div>
      </div>
    )
  }

  if (phase === 'matched' && finalMatch) {
    return (
      <div className="food-matched-overlay">
        <div className="food-matched-modal">
          <div className="food-matched-header">
            <span className="food-matched-emoji">🎉</span>
            <h1>It's a Match!</h1>
            <p>You're both going to <strong>{finalMatch.title}</strong>!</p>
          </div>
          <div className="food-matched-card">
            {finalMatch.poster ? (
              <img src={finalMatch.poster} alt={finalMatch.title} className="food-matched-img" />
            ) : (
              <div className="food-matched-img food-matched-placeholder">{finalMatch.emoji || '🍽️'}</div>
            )}
            <div className="food-matched-info">
              <h2>{finalMatch.title}</h2>
              {finalMatch.rating && <div className="food-matched-rating">{finalMatch.rating}</div>}
              {finalMatch.overview && <p className="food-matched-address">{finalMatch.overview}</p>}
            </div>
          </div>
          <div className="food-matched-actions">
            <button className="btn food-share-btn" onClick={handleShare} disabled={sharing}>
              {sharing ? 'Generating…' : '📸 Share to Stories'}
            </button>
            <button className="btn btn-primary" onClick={onDone}>Done</button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
