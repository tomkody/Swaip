import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { getRoom, getUserToken, recordSwipe, subscribeToSwipes, markRoomActive, fetchRoomMatches } from '../lib/room'
import { PLATFORMS } from '../lib/platforms'
import { fetchTopRatedMovies } from '../lib/tmdb'
import { fetchTopRatedSeries } from '../lib/seriesFetch'
import SwipeCard from '../components/SwipeCard'
import MatchModal from '../components/MatchModal'
import ConversationRoom from '../components/ConversationRoom'
import ActivityRoom from '../components/ActivityRoom'
import RankingView from '../components/RankingView'
import './Room.css'

function parseRoomFilters(raw) {
  if (!raw) return { platforms: [], genres: [] }
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return { platforms: parsed, genres: [] } // legacy
    return { platforms: parsed.platforms || [], genres: parsed.genres || [] }
  } catch {
    return { platforms: [], genres: [] }
  }
}

export default function Room() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isCreator = location.state?.isCreator || false

  const [room, setRoom] = useState(null)
  const [movies, setMovies] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [matchItem, setMatchItem] = useState(null)
  const [matches, setMatches] = useState([])
  const [liked, setLiked] = useState([])
  const [showLiked, setShowLiked] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [doneMatches, setDoneMatches] = useState(null) // null = not fetched yet
  const [fetchingDone, setFetchingDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [partnerJoined, setPartnerJoined] = useState(!isCreator)
  const [partnerJustJoined, setPartnerJustJoined] = useState(false)
  const [hasJoined, setHasJoined] = useState(isCreator) // joiner sees welcome screen first
  const [copied, setCopied] = useState(false)
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

        const { platforms, genres } = parseRoomFilters(roomData.platforms)
        if (roomData.type === 'movies') {
          setMovies(fetchTopRatedMovies(roomData.id, platforms, genres))
        } else if (roomData.type === 'series') {
          setMovies(fetchTopRatedSeries(roomData.id, platforms, genres))
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

  // Poll for partner joining (creator only) — checks every 2s until partner starts
  useEffect(() => {
    if (!isCreator || partnerJoined) return
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

  useEffect(() => {
    if (!room || (room.type !== 'movies' && room.type !== 'series')) return

    const unsubSwipes = subscribeToSwipes(roomId, userToken.current, (itemId) => {
      const matched = movies.find((m) => m.id === itemId)
      if (matched) {
        setMatchItem(matched)
        setMatches((prev) => [...prev, matched])
      }
    })

    return () => unsubSwipes()
  }, [room, movies, roomId])

  const handleSwipe = useCallback(
    async (direction) => {
      const movie = movies[currentIndex]
      if (!movie) return

      if (direction === 'right') {
        setLiked((prev) => [...prev, movie])
      }

      try {
        const isMatch = await recordSwipe(roomId, userToken.current, movie.id, direction)
        if (isMatch) {
          setMatchItem(movie)
          setMatches((prev) => [...prev, movie])
        }
      } catch (err) {
        console.error('Failed to record swipe:', err)
      }

      setCurrentIndex((i) => i + 1)
    },
    [movies, currentIndex, roomId]
  )

  function handleCopyLink() {
    const url = `${window.location.origin}/room/${roomId}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

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
      movies:        { emoji: '🎬', label: 'Movies',       desc: 'Swipe right on movies you want to watch. When you both like the same one — it\'s a match!' },
      series:        { emoji: '📺', label: 'TV Series',    desc: 'Swipe right on shows you want to binge. When you both like the same one — it\'s a match!' },
      conversations: { emoji: '💬', label: 'Conversations', desc: 'Pick the topics you\'d love to talk about. You\'ll only see topics you both chose.' },
      activities:    { emoji: '🎯', label: 'Activities',   desc: 'Pick activities you\'re up for. You\'ll see which ones you both want to do.' },
    }
    const info = typeInfo[room.type] || typeInfo.movies

    return (
      <div className="room-center">
        <div className="join-screen">
          <div className="join-icon">{info.emoji}</div>
          <p className="join-invited">Your friend invited you!</p>
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
    return (
      <div className="room-center">
        <div className="waiting">
          <div className="waiting-icon">⏳</div>
          <h2>Waiting for your partner</h2>
          <p className="waiting-genre">
            {room.type === 'movies' ? '🎬 Movies' : room.type === 'series' ? '📺 TV Series' : room.type === 'activities' ? '🎯 Activities' : `💬 ${room.topic_name}`}
          </p>
          <p className="waiting-text">Share this link to get started:</p>
          <div className="share-link">
            <code className="link-text">{window.location.origin}/room/{roomId}</code>
            <button className="copy-btn" onClick={handleCopyLink}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button className="btn btn-secondary skip-wait" onClick={() => setPartnerJoined(true)}>
            {room.type === 'movies' ? 'Start swiping solo' : 'Start solo'}
          </button>
        </div>
      </div>
    )
  }

  // Conversation mode
  if (room.type === 'conversations') {
    return <ConversationRoom room={room} onDone={() => navigate('/')} />
  }

  // Activities mode
  if (room.type === 'activities') {
    return <ActivityRoom room={room} onDone={() => navigate('/')} />
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
    const matchesToShow = doneMatches !== null ? doneMatches : matches
    return <RankingView matches={matchesToShow} room={room} movies={movies} onDone={() => navigate('/')} />
  }

  // Movie mode — swipe UI
  const currentMovie = movies[currentIndex]

  return (
    <div className="room">
      <div className="room-header">
        <span className="room-genre">
          {room.type === 'series' ? '📺' : '🎬'}
          {(() => {
            const { platforms, genres } = parseRoomFilters(room.platforms)
            const parts = [
              ...platforms.map(id => PLATFORMS.find(p => p.id === id)?.name).filter(Boolean),
              ...genres,
            ]
            return parts.length ? ' ' + parts.join(' · ') : ' Top Rated'
          })()}
        </span>
        <span className="room-progress">
          {currentIndex + 1} / {movies.length}
        </span>
        {matches.length > 0 && (
          <span className="room-matches">
            {matches.length} match{matches.length !== 1 ? 'es' : ''}
          </span>
        )}
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
          setFetchingDone(true)
          const ids = await fetchRoomMatches(roomId, userToken.current)
          if (ids !== null) {
            // Supabase: resolve IDs to movie objects
            setDoneMatches(movies.filter(m => ids.includes(m.id)))
          }
          setFetchingDone(false)
          setIsDone(true)
        }}>
          I'm done swiping{matches.length > 0 ? ` · ${matches.length} match${matches.length !== 1 ? 'es' : ''}` : ''}
        </button>
      </div>

      {matchItem && (
        <MatchModal
          item={matchItem}
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
