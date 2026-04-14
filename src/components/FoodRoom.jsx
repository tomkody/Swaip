import { useState, useEffect, useRef, useCallback } from 'react'
import confetti from 'canvas-confetti'
import { getUserToken, recordFoodVote, checkFoodMatches } from '../lib/room'
import { saveMatch } from '../lib/savedMatches'
import { generateShareImage, downloadCanvas } from '../lib/shareImage'
import SwipeCard from './SwipeCard'
import './FoodRoom.css'

const CUISINES = [
  { id: 901, title: 'Italian',  emoji: '🍝', overview: 'Pasta, pizza, risotto, tiramisu…' },
  { id: 902, title: 'Sushi',    emoji: '🍱', overview: 'Fresh rolls, sashimi, miso, edamame…' },
  { id: 903, title: 'Burgers',  emoji: '🍔', overview: 'Juicy patties, crispy fries, milkshakes…' },
  { id: 904, title: 'Indian',   emoji: '🍛', overview: 'Curries, naan, biryani, samosas…' },
  { id: 905, title: 'Mexican',  emoji: '🌮', overview: 'Tacos, burritos, guac, churros…' },
  { id: 906, title: 'Chinese',  emoji: '🥟', overview: 'Dim sum, dumplings, noodles, Peking duck…' },
  { id: 907, title: 'French',   emoji: '🥐', overview: 'Croissants, coq au vin, crème brûlée…' },
  { id: 908, title: 'Thai',     emoji: '🍜', overview: 'Pad thai, green curry, mango sticky rice…' },
  { id: 909, title: 'Pizza',    emoji: '🍕', overview: 'Margherita, pepperoni, calzone, garlic bread…' },
]
const CUISINE_IDS = CUISINES.map(c => c.id)

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY

const DEMO_RESTAURANTS = {
  Italian: [
    { id: 951, title: 'La Bella Trattoria',  overview: 'Classic Italian comfort food', emoji: '🍝', rating: '4.7' },
    { id: 952, title: 'Piccolo Roma',         overview: 'Authentic Roman cuisine',      emoji: '🫙', rating: '4.5' },
    { id: 953, title: 'Pasta e Basta',        overview: 'Fresh pasta made daily',       emoji: '🍕', rating: '4.4' },
  ],
  Sushi: [
    { id: 954, title: 'Sakura Sushi Bar', overview: 'Premium fresh fish daily',   emoji: '🍱', rating: '4.8' },
    { id: 955, title: 'Maki House',       overview: 'Creative rolls & classics',  emoji: '🥢', rating: '4.6' },
    { id: 956, title: 'Tokyo Bites',      overview: 'Omakase & à la carte',       emoji: '🍣', rating: '4.5' },
  ],
  Burgers: [
    { id: 957, title: 'The Burger Lab',     overview: 'Science-backed smash burgers', emoji: '🍔', rating: '4.7' },
    { id: 958, title: 'Smash & Grill',      overview: 'Double smash, crispy edges',   emoji: '🧀', rating: '4.6' },
    { id: 959, title: 'Old School Burgers', overview: 'Classic diner vibes',          emoji: '🥓', rating: '4.5' },
  ],
  Indian: [
    { id: 960, title: 'Spice Garden',      overview: 'Rich curries & tandoor',  emoji: '🍛', rating: '4.7' },
    { id: 961, title: 'Taj Mahal Kitchen', overview: 'Northern Indian classics', emoji: '🌶️', rating: '4.6' },
    { id: 962, title: 'Curry House',       overview: 'Homestyle Indian cooking', emoji: '🫓', rating: '4.5' },
  ],
  Mexican: [
    { id: 963, title: 'El Rancho',      overview: 'Street-style tacos & mezcal', emoji: '🌮', rating: '4.7' },
    { id: 964, title: 'Taqueria Local', overview: 'Authentic al pastor',          emoji: '🌯', rating: '4.6' },
    { id: 965, title: 'Casa Mexica',    overview: 'Modern Mexican kitchen',       emoji: '🥑', rating: '4.5' },
  ],
  Chinese: [
    { id: 966, title: 'Golden Dragon',  overview: 'Cantonese dim sum & mains', emoji: '🥟', rating: '4.7' },
    { id: 967, title: 'Dim Sum Palace', overview: 'Weekend dim sum specialist', emoji: '🍜', rating: '4.6' },
    { id: 968, title: 'Wonton House',   overview: 'Hand-pulled noodles & soup', emoji: '🫕', rating: '4.5' },
  ],
  French: [
    { id: 969, title: 'Café de Paris', overview: 'Parisian bistro classics',  emoji: '🥐', rating: '4.8' },
    { id: 970, title: 'Bistro Lyon',   overview: 'Lyonnaise cuisine & wine',  emoji: '🍷', rating: '4.6' },
    { id: 971, title: 'Le Petit Four', overview: 'Fine French patisserie',    emoji: '🧁', rating: '4.5' },
  ],
  Thai: [
    { id: 972, title: 'Thai Orchid',     overview: 'Aromatic curries & stir-fry', emoji: '🍜', rating: '4.7' },
    { id: 973, title: 'Pad Thai Palace', overview: 'Street food favorites',       emoji: '🥜', rating: '4.6' },
    { id: 974, title: 'Bangkok Spice',   overview: 'Authentic Thai heat levels',  emoji: '🌿', rating: '4.5' },
  ],
  Pizza: [
    { id: 975, title: 'Napoli Wood Fire', overview: 'Neapolitan DOC pizza',        emoji: '🍕', rating: '4.8' },
    { id: 976, title: 'Slice of Life',    overview: 'New York style by the slice', emoji: '🧀', rating: '4.6' },
    { id: 977, title: 'The Pizza Lab',    overview: 'Experimental toppings',       emoji: '🫙', rating: '4.5' },
  ],
}

function getDemoRestaurants(cuisineTitle) {
  return (DEMO_RESTAURANTS[cuisineTitle] || DEMO_RESTAURANTS.Burgers).map(r => ({ ...r, poster: null }))
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
  // liked* tracks which items THIS user voted right on
  const [likedCuisineIds, setLikedCuisineIds] = useState([])
  const [likedRestaurantIds, setLikedRestaurantIds] = useState([])

  const restaurantsRef = useRef([])
  const phaseRef = useRef('cuisine')
  const matchedRef = useRef(false)
  const userToken = useRef(getUserToken())

  useEffect(() => { restaurantsRef.current = restaurants }, [restaurants])
  useEffect(() => { phaseRef.current = phase }, [phase])

  // ── Match handlers ─────────────────────────────────────────────
  const triggerCuisineMatch = useCallback((cuisine) => {
    if (matchedRef.current) return
    matchedRef.current = true
    setMatchedCuisine(cuisine)
    setPhase('locating')
    fetchRestaurants(cuisine.title)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const triggerRestaurantMatch = useCallback((restaurant) => {
    if (phaseRef.current === 'matched') return
    setFinalMatch(restaurant)
    setPhase('matched')
    saveMatch({ id: restaurant.id, title: restaurant.title, category: 'food', image: restaurant.poster || null, rating: restaurant.rating || null })
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } })
  }, [])

  // ── Polling: cuisine phase ─────────────────────────────────────
  // Polls every 1.5s using conversation_selections (text IDs, no FK issues)
  useEffect(() => {
    if (phase !== 'cuisine') return
    const interval = setInterval(async () => {
      if (matchedRef.current) { clearInterval(interval); return }
      try {
        const matches = await checkFoodMatches(room.id, userToken.current, CUISINE_IDS)
        if (matches.length > 0) {
          clearInterval(interval)
          const cuisine = CUISINES.find(c => c.id === matches[0])
          if (cuisine) triggerCuisineMatch(cuisine)
        }
      } catch (err) { console.warn('Cuisine poll error:', err) }
    }, 1500)
    return () => clearInterval(interval)
  }, [phase, room.id, triggerCuisineMatch])

  // ── Polling: restaurant phase ──────────────────────────────────
  useEffect(() => {
    if (phase !== 'restaurant') return
    const list = restaurantsRef.current
    if (!list.length) return
    const restIds = list.map(r => r.id)
    const interval = setInterval(async () => {
      if (phaseRef.current === 'matched') { clearInterval(interval); return }
      try {
        const matches = await checkFoodMatches(room.id, userToken.current, restIds)
        if (matches.length > 0) {
          clearInterval(interval)
          const restaurant = list.find(r => r.id === matches[0])
          if (restaurant) triggerRestaurantMatch(restaurant)
        }
      } catch (err) { console.warn('Restaurant poll error:', err) }
    }, 1500)
    return () => clearInterval(interval)
  }, [phase, room.id, triggerRestaurantMatch]) // restaurants populated before phase changes

  // ── Swipe handlers ─────────────────────────────────────────────
  const handleCuisineSwipe = useCallback(async (direction) => {
    const cuisine = CUISINES[cuisineIndex]
    if (!cuisine || matchedRef.current) return
    setSwipeCount(n => n + 1)
    if (direction === 'right') {
      setLikedCuisineIds(prev => [...prev, cuisine.id])
      try {
        await recordFoodVote(room.id, userToken.current, cuisine.id)
      } catch (err) { console.error('recordFoodVote error:', err) }
    }
    setCuisineIndex(i => i + 1)
  }, [cuisineIndex, room.id])

  const handleRestaurantSwipe = useCallback(async (direction) => {
    const restaurant = restaurantsRef.current[restaurantIndex]
    if (!restaurant || phaseRef.current === 'matched') return
    setSwipeCount(n => n + 1)
    if (direction === 'right') {
      setLikedRestaurantIds(prev => [...prev, restaurant.id])
      try {
        await recordFoodVote(room.id, userToken.current, restaurant.id)
      } catch (err) { console.error('recordFoodVote error:', err) }
    }
    setRestaurantIndex(i => i + 1)
  }, [restaurantIndex, room.id])

  // ── Fetch restaurants ──────────────────────────────────────────
  async function fetchRestaurants(cuisineTitle) {
    if (!GOOGLE_KEY) {
      setLocationNote('No Google API key — showing demo restaurants.')
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
        setRestaurants(data.places.map((p, i) => ({
          id: 1001 + i,
          title: p.displayName?.text || 'Restaurant',
          overview: [p.formattedAddress, p.currentOpeningHours?.openNow ? '🟢 Open now' : ''].filter(Boolean).join(' · '),
          rating: p.rating ? p.rating.toFixed(1) : null,
          poster: p.photos?.[0] ? `https://places.googleapis.com/v1/${p.photos[0].name}/media?maxWidthPx=400&key=${GOOGLE_KEY}` : null,
          emoji: '🍽️',
        })))
        setPhase('restaurant')
      } else throw new Error('No results')
    } catch (err) {
      console.warn('Places API error:', err.message)
      setLocationNote('Could not get your location — showing popular spots instead.')
      setRestaurants(getDemoRestaurants(cuisineTitle))
      setPhase('restaurant')
    }
  }

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
            <div className="food-done-icon">⏳</div>
            <h2>Waiting for your partner…</h2>
            <p>You've voted on all cuisines. Waiting for your partner to vote — a match will appear automatically!</p>
            <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={onDone}>Go home</button>
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
            <div className="food-done-icon">⏳</div>
            <h2>Waiting for your partner…</h2>
            <p>You've rated all {matchedCuisine?.title?.toLowerCase()} spots. A match will appear automatically!</p>
            <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={onDone}>Go home</button>
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
              {finalMatch.rating && <div className="food-matched-rating">⭐ {finalMatch.rating}</div>}
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
