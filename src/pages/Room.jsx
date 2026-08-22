import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { getRoom, getUserToken, recordSwipe, subscribeToSwipes, markRoomActive, fetchRoomMatches, isRoomSolo, getRoomPlayerCount, DONE_ITEM_ID } from '../lib/room'
import { PLATFORMS } from '../lib/platforms'
import { fetchTopRatedMovies } from '../lib/tmdb'
import { fetchTopRatedSeries } from '../lib/seriesFetch'
import SwipeCard from '../components/SwipeCard'
import MatchModal from '../components/MatchModal'
import ConversationRoom from '../components/ConversationRoom'
import ActivityRoom from '../components/ActivityRoom'
import FoodRoom from '../components/FoodRoom'
import RankingView from '../components/RankingView'
import InvitePanel from '../components/InvitePanel'
import './Room.css'

function parseRoomFilters(raw) {
  if (!raw) return { platforms: [], genres: [], region: undefined }
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return { platforms: parsed, genres: [], region: undefined } // legacy
    return { platforms: parsed.platforms || [], genres: parsed.genres || [], region: parsed.region }
  } catch {
    return { platforms: [], genres: [], region: undefined }
  }
}

export default function Room() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isCreator = location.state?.isCreator || false

  const [room, setRoom] = useState(null)
  const [isSolo, setIsSolo] = useState(location.state?.isSolo || false)
  const [movies, setMovies] = useState([])
  const moviesRef = useRef([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [matchItem, setMatchItem] = useState(null)
  const [matches, setMatches] = useState([])
  const [liked, setLiked] = useState([])
  const [isDone, setIsDone] = useState(false)
  const [doneMatches, setDoneMatches] = useState(null)
  const isDoneRef = useRef(false)
  const [fetchingDone, setFetchingDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [partnerJoined, setPartnerJoined] = useState(!isCreator || (location.state?.isSolo || false))
  const [partnerJustJoined, setPartnerJustJoined] = useState(false)
  const [hasJoined, setHasJoined] = useState(isCreator)
  const userToken = useRef(getUserToken())

  useEffect(() => {
    async function init() {
      try {
        const roomData = await getRoom(roomId)
        if (!roomData) {
          setError('Room not found')
          setLoading(false)
          return
        }
        setRoom(roomData)

        // Solo flag can come from room data (for page refreshes) or location state (first load)
        const solo = isRoomSolo(roomData) || (location.state?.isSolo || false)
        setIsSolo(solo)
        if (solo) {
          setPartnerJoined(true)
        }

        const { platforms, genres, region } = parseRoomFilters(roomData.platforms ?? roomData.topic_id)
        if (roomData.type === 'movies') {
          setMovies(await fetchTopRatedMovies(roomData.id, platforms, genres, region))
        } else if (roomData.type === 'series') {
          setMovies(await fetchTopRatedSeries(roomData.id, platforms, genres, region))
        }
      } catch (err) {
        setError('Failed to load room')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [roomId])

  // Poll for partner joining (creator only, non-solo) — checks every 2s until partner starts
  useEffect(() => {
    if (!isCreator || partnerJoined || isSolo) return
    const interval = setInterval(async () => {
      const latest = await getRoom(roomId)
      if (latest?.status === 'active') {
        clearInterval(interval)
        setPartnerJustJoined(true)
        setTimeout(() => {
          setPartnerJustJoined(false)
          setPartnerJoined(true)
        }, 2500)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [isCreator, partnerJoined, roomId])

  // Keep refs in sync so subscription callbacks always see current values
  useEffect(() => { isDoneRef.current = isDone }, [isDone])
  useEffect(() => { moviesRef.current = movies }, [movies])

  useEffect(() => {
    if (!room || (room.type !== 'movies' && room.type !== 'series') || isSolo) return

    const unsubSwipes = subscribeToSwipes(roomId, userToken.current, (itemId) => {
      const matched = moviesRef.current.find((m) => m.id === itemId)
      if (matched) {
        // Always update real-time matches list (deduped)
        setMatches((prev) => prev.find(m => m.id === matched.id) ? prev : [...prev, matched])
        // If already done, update doneMatches so RankingView gets the new match
        setDoneMatches((prev) => {
          if (prev === null) return null
          if (prev.find(m => m.id === matched.id)) return prev
          return [...prev, matched]
        })
        // Only show match-modal overlay while still actively swiping
        if (!isDoneRef.current) {
          setMatchItem(matched)
        }
      }
    })

    return () => unsubSwipes()
  }, [room, roomId])

  const handleSwipe = useCallback(
    async (direction) => {
      const movie = movies[currentIndex]
      if (!movie) return

      if (direction === 'right') {
        setLiked((prev) => [...prev, movie])
      }

      if (!isSolo) {
        try {
          const isMatch = await recordSwipe(roomId, userToken.current, movie.id, direction)
          if (isMatch) {
            setMatchItem(movie)
            setMatches((prev) => [...prev, movie])
          }
        } catch (err) {
          console.error('Failed to record swipe:', err)
        }
      }

      setCurrentIndex((i) => i + 1)
    },
    [movies, currentIndex, roomId, isSolo]
  )

  // Tell the room this user finished swiping (sentinel row, ignored as a pick).
  // Lets the partner's results screen show "finished" vs "still swiping".
  const doneSignalledRef = useRef(false)
  const signalDone = useCallback(async () => {
    if (isSolo || doneSignalledRef.current) return
    doneSignalledRef.current = true
    try { await recordSwipe(roomId, userToken.current, DONE_ITEM_ID, 'right') }
    catch (err) { console.error('Failed to signal done:', err) }
  }, [isSolo, roomId])

  // Deck exhausted counts as finished too.
  useEffect(() => {
    if (!isSolo && movies.length > 0 && currentIndex >= movies.length) signalDone()
  }, [isSolo, movies.length, currentIndex, signalDone])

  if (loading) {
    return (
      <div className="room-center">
        <div className="loader" />
        <p>Loading room...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="room-center">
        <p className="error-text">{error}</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          Go Home
        </button>
      </div>
    )
  }

  // Joiner welcome screen
  if (!isCreator && !hasJoined) {
    const typeInfo = {
      movies:        { emoji: '🎬', label: 'Movies',        desc: 'Swipe right on movies you want to watch. When you both like the same one — it\'s a match!' },
      series:        { emoji: '📺', label: 'TV Series',     desc: 'Swipe right on shows you want to binge. When you both like the same one — it\'s a match!' },
      conversations: { emoji: '💬', label: 'Conversations', desc: 'Pick the topics you\'d love to talk about. You\'ll only see topics you both chose.' },
      activities:    { emoji: '🎯', label: 'Activities',    desc: 'Pick activities you\'re up for. You\'ll see which ones you both want to do.' },
      food:          { emoji: '🍽️', label: 'Food & Drinks', desc: 'Swipe on cuisines first, then on real restaurants nearby. Time to eat!' },
    }
    const info = typeInfo[room.type] || typeInfo.movies

    return (
      <div className="room-center">
        <div className="join-screen">
          <div className="join-icon">{info.emoji}</div>
          <p className="join-invited">{getRoomPlayerCount(room) > 2 ? `You've been invited to a group!` : `Your friend invited you!`}</p>
          <h2 className="join-title">{info.label} Room</h2>
          <p className="join-desc">{info.desc}</p>
          <button className="btn btn-primary join-btn" onClick={() => { markRoomActive(roomId); setHasJoined(true) }}>
            {room.type === 'movies' || room.type === 'series' ? 'Start Swiping 👆' : 'See the options 👆'}
          </button>
        </div>
      </div>
    )
  }

  // Partner just joined — show transition screen to creator
  if (partnerJustJoined) {
    return (
      <div className="room-center">
        <div className="partner-joined">
          <div className="partner-joined-icon">🎉</div>
          <h2>Your friend joined!</h2>
          <p>Starting now…</p>
          <div className="partner-joined-bar"><div className="partner-joined-fill" /></div>
        </div>
      </div>
    )
  }

  // Creator waiting for partner
  if (isCreator && !partnerJoined) {
    const pc = getRoomPlayerCount(room)
    return (
      <div className="room-center">
        <div className="waiting-category">
          {room.type === 'movies' ? '🎬 Movies' : room.type === 'series' ? '📺 TV Series' : room.type === 'activities' ? '🎯 Activities' : room.type === 'food' ? '🍽️ Food & Drinks' : `💬 ${room.topic_name}`}
        </div>
        <div className="waiting">
          <div className="waiting-icon">⏳</div>
          <h2>{pc > 2 ? `Waiting for your group` : `Waiting for your partner`}</h2>
          <InvitePanel roomId={roomId} type={room.type} />
          <button className="btn skip-wait" onClick={() => setPartnerJoined(true)}>
            You can start swiping solo
          </button>
        </div>
      </div>
    )
  }

  // Conversation mode
  if (room.type === 'conversations') {
    return <ConversationRoom room={room} onDone={() => navigate('/')} isSolo={isSolo} />
  }

  // Activities mode
  if (room.type === 'activities') {
    return <ActivityRoom room={room} onDone={() => navigate('/')} isSolo={isSolo} />
  }

  // Food mode
  if (room.type === 'food') {
    return <FoodRoom room={room} onDone={() => navigate('/')} isSolo={isSolo} />
  }

  // Movie/Series mode — done (all swiped or clicked "I'm done")
  if (fetchingDone) {
    return (
      <div className="room-center">
        <div className="loader" />
        <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>Finding your matches…</p>
      </div>
    )
  }

  if (isDone || currentIndex >= movies.length) {
    const matchesToShow = isSolo
      ? liked
      : (doneMatches !== null && doneMatches.length >= matches.length) ? doneMatches : matches
    return <RankingView matches={matchesToShow} liked={liked} room={room} movies={movies} onDone={() => navigate('/')} isSolo={isSolo} />
  }

  // Movie mode — swipe UI
  const currentMovie = movies[currentIndex]

  return (
    <div className="room">
      <div className="room-header">
        <div className="room-header-side" />
        <Link to="/" className="room-home-link" aria-label="Home">
          <span className="room-logo-text">Swaip</span>
        </Link>
        <div className="room-header-side room-header-right">
          {isSolo ? (
            liked.length > 0 && (
              <span className="room-matches">
                {liked.length} pick{liked.length !== 1 ? 's' : ''}
              </span>
            )
          ) : (
            matches.length > 0 && (
              <span className="room-matches">
                {matches.length} match{matches.length !== 1 ? 'es' : ''}
              </span>
            )
          )}
          <span className="room-progress">{currentIndex + 1} / {movies.length}</span>
        </div>
      </div>

      <div className="room-cards">
        <SwipeCard
          key={currentMovie.id}
          item={currentMovie}
          onSwipe={handleSwipe}
          active
        />
      </div>

      <div className="room-footer">
        <button className="done-early-btn" onClick={async () => {
          if (isSolo) { setIsDone(true); return }
          setFetchingDone(true)
          await signalDone()
          const ids = await fetchRoomMatches(roomId, userToken.current)
          if (ids !== null) {
            setDoneMatches(movies.filter(m => ids.includes(m.id)))
          }
          setFetchingDone(false)
          setIsDone(true)
        }}>
          {isSolo
            ? `I'm done · ${liked.length} pick${liked.length !== 1 ? 's' : ''}`
            : `I'm done swiping${matches.length > 0 ? ` · ${matches.length} match${matches.length !== 1 ? 'es' : ''}` : ''}`}
        </button>
      </div>

      {matchItem && !isSolo && (
        <MatchModal
          item={matchItem}
          roomType={room.type}
          swipeCount={currentIndex}
          onContinue={() => setMatchItem(null)}
          onDone={async () => {
            setMatchItem(null)
            setFetchingDone(true)
            const ids = await fetchRoomMatches(roomId, userToken.current)
            if (ids !== null) setDoneMatches(movies.filter(m => ids.includes(m.id)))
            setFetchingDone(false)
            setIsDone(true)
          }}
        />
      )}
    </div>
  )
}
