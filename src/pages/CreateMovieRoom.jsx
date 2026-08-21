import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { createMovieRoom, getUserToken } from '../lib/room'
import { PLATFORMS } from '../lib/platforms'
import ModeToggle from '../components/ModeToggle'
import './CreateMovieRoom.css'

const GENRE_OPTIONS = [
  'Action', 'Adventure', 'Animation', 'Biography',
  'Comedy', 'Crime', 'Drama', 'Fantasy',
  'Horror', 'Musical', 'Mystery', 'Romance',
  'Sci-Fi', 'Thriller', 'War', 'Western',
]

const GENRE_EMOJI = {
  Action: '💥', Adventure: '🧭', Animation: '🧸', Biography: '📖',
  Comedy: '😂', Crime: '🚔', Drama: '🎭', Fantasy: '🐉',
  Horror: '👻', Musical: '🎵', Mystery: '🔍', Romance: '❤️',
  'Sci-Fi': '🚀', Thriller: '😱', War: '⚔️', Western: '🤠',
}

export default function CreateMovieRoom() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [solo, setSolo] = useState(false)
  const [platforms, setPlatforms] = useState([])
  const [genres, setGenres] = useState([])
  const [genreOpen, setGenreOpen] = useState(false)
  const genreRef = useRef(null)

  // Close the genre dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (genreOpen && genreRef.current && !genreRef.current.contains(e.target)) {
        setGenreOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [genreOpen])

  function togglePlatform(id) {
    setPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  function toggleGenre(g) {
    setGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])
  }

  async function handleCreate() {
    setLoading(true)
    try {
      getUserToken()
      const room = await createMovieRoom(platforms, genres, { solo })
      navigate(`/room/${room.id}`, { state: { isCreator: true, isSolo: solo } })
    } catch (err) {
      console.error('Failed to create room:', err)
      alert('Failed to create room. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const genreLabel = genres.length === 0
    ? 'All Genres'
    : genres.join(', ')

  return (
    <div className="create-movie">
      <button className="back-btn" onClick={() => navigate('/')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
      </button>

      <div className="create-movie-content">
        <header className="create-head">
          <h1>Movies</h1>
          <p className="create-sub">
            {solo
              ? 'Swipe top-rated films and build your watchlist.'
              : 'Swipe together — you match when you both like the same film.'}
          </p>
        </header>

        <ModeToggle solo={solo} onChange={setSolo} />

        {/* Streaming platforms — always-visible brand chips */}
        <div className="pick-section">
          <span className="pick-label">Where you watch</span>
          <div className="plat-chips">
            <button
              className={`plat-chip ${platforms.length === 0 ? 'active' : ''}`}
              onClick={() => setPlatforms([])}
            >
              All
            </button>
            {PLATFORMS.map(p => {
              const active = platforms.includes(p.id)
              return (
                <button
                  key={p.id}
                  className={`plat-chip ${active ? 'active' : ''}`}
                  style={active ? { background: p.bg, borderColor: p.border, color: p.color } : {}}
                  onClick={() => togglePlatform(p.id)}
                >
                  {p.name}
                </button>
              )
            })}
          </div>
        </div>

        {/* Genres */}
        <div className="filter-section" ref={genreRef}>
          <button className="filter-header" onClick={() => setGenreOpen(o => !o)}>
            <span className="filter-header-left">
              <span className="filter-icon">🎭</span>
              <span className="filter-header-title">Genres</span>
              <span className="filter-badge">{genreLabel}</span>
            </span>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              className={`filter-arrow ${genreOpen ? 'open' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {genreOpen && (
            <div className="filter-body">
              <button
                className={`filter-all-btn ${genres.length === 0 ? 'active' : ''}`}
                onClick={() => setGenres([])}
              >
                {genres.length === 0 && <span className="filter-check">✓</span>}
                All Genres
              </button>
              <div className="filter-grid">
                {GENRE_OPTIONS.map(g => {
                  const active = genres.includes(g)
                  return (
                    <button
                      key={g}
                      className={`filter-btn ${active ? 'active' : ''}`}
                      onClick={() => toggleGenre(g)}
                    >
                      {active
                        ? <span className="filter-check">✓</span>
                        : <span className="filter-emoji">{GENRE_EMOJI[g]}</span>}
                      {g}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <button
          className="btn btn-primary create-btn"
          disabled={loading}
          onClick={handleCreate}
        >
          {loading ? 'Creating...' : solo ? 'Start Swiping' : 'Create Room'}
        </button>
      </div>
    </div>
  )
}
