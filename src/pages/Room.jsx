import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { getRoom, getUserToken, recordSwipe, subscribeToSwipes, subscribeToRoom } from '../lib/room'
import { fetchTopRatedMovies } from '../lib/tmdb'
import { fetchTopRatedSeries } from '../lib/seriesFetch'
import SwipeCard from '../components/SwipeCard'
import MatchModal from '../components/MatchModal'
import ConversationRoom from '../components/ConversationRoom'
import ActivityRoom from '../components/ActivityRoom'
import './Room.css'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [partnerJoined, setPartnerJoined] = useState(!isCreator)
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

        if (roomData.type === 'movies') {
          const movieList = fetchTopRatedMovies(roomData.id)
          setMovies(movieList)
        } else if (roomData.type === 'series') {
          const seriesList = fetchTopRatedSeries(roomData.id)
          setMovies(seriesList)
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

  useEffect(() => {
    if (!room || (room.type !== 'movies' && room.type !== 'series')) return

    const unsubSwipes = subscribeToSwipes(roomId, userToken.current, (itemId) => {
      const matched = movies.find((m) => m.id === itemId)
      if (matched) {
        setMatchItem(matched)
        setMatches((prev) => [...prev, matched])
      }
    })

    const unsubRoom = subscribeToRoom(roomId, () => {
      setPartnerJoined(true)
    })

    return () => {
      unsubSwipes()
      unsubRoom()
    }
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

  // Movie mode — all swiped
  if (currentIndex >= movies.length) {
    const matchIds = new Set(matches.map((m) => m.id))
    const likedNotMatched = liked.filter((m) => !matchIds.has(m.id))

    return (
      <div className="room-center">
        <div className="done">
          <div className="done-icon">✅</div>
          <h2>All done!</h2>
          {matches.length > 0 ? (
            <>
              <p className="done-text">
                You matched on {matches.length} movie{matches.length !== 1 ? 's' : ''}:
              </p>
              <div className="match-list">
                {matches.map((m) => (
                  <div key={m.id} className="match-list-item">
                    {m.poster ? (
                      <img src={m.poster} alt={m.title} className="match-thumb" />
                    ) : (
                      <div className="match-thumb match-thumb-placeholder">🎬</div>
                    )}
                    <div>
                      <strong>{m.title}</strong>
                      <span className="match-year">{m.year}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="done-text">No matches this time. Try again!</p>
          )}

          {/* Reveal liked movies */}
          {likedNotMatched.length > 0 && (
            <div className="reveal-liked">
              <button
                className="reveal-liked-toggle"
                onClick={() => setShowLiked(!showLiked)}
              >
                {showLiked ? 'Hide' : 'Show'} what else I liked ({likedNotMatched.length})
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  className={`reveal-arrow ${showLiked ? 'open' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <p className="reveal-liked-hint">
                Show your partner what you'd also love to watch
              </p>
              {showLiked && (
                <div className="match-list liked-list">
                  {likedNotMatched.map((m) => (
                    <div key={m.id} className="match-list-item liked-item">
                      {m.poster ? (
                        <img src={m.poster} alt={m.title} className="match-thumb" />
                      ) : (
                        <div className="match-thumb match-thumb-placeholder">🎬</div>
                      )}
                      <div>
                        <strong>{m.title}</strong>
                        <span className="match-year">{m.year}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button className="btn btn-primary" onClick={() => navigate('/')}>
            New Room
          </button>
        </div>
      </div>
    )
  }

  // Movie mode — swipe UI
  const currentMovie = movies[currentIndex]

  return (
    <div className="room">
      <div className="room-header">
        <span className="room-genre">{room.type === 'series' ? '📺' : '🎬'} Top Rated</span>
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

      {matchItem && (
        <MatchModal
          item={matchItem}
          onContinue={() => setMatchItem(null)}
          onDone={() => navigate('/')}
        />
      )}
    </div>
  )
}
