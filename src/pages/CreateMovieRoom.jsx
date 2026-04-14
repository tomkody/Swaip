import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createMovieRoom, getUserToken } from '../lib/room'
import { PLATFORMS } from '../lib/platforms'
import './CreateMovieRoom.css'

const GENRE_OPTIONS = [
  'Action', 'Adventure', 'Animation', 'Biography',
  'Comedy', 'Crime', 'Drama', 'Fantasy',
  'Horror', 'Musical', 'Mystery', 'Romance',
  'Sci-Fi', 'Thriller', 'War', 'Western',
]

export default function CreateMovieRoom() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [platforms, setPlatforms] = useState([])
  const [genres, setGenres] = useState([])
  const [platformOpen, setPlatformOpen] = useState(false)
  const [genreOpen, setGenreOpen] = useState(false)

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
      const room = await createMovieRoom(platforms, genres)
      navigate(`/room/${room.id}`, { state: { isCreator: true } })
    } catch (err) {
      console.error('Failed to create room:', err)
      alert('Failed to create room. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const platformLabel = platforms.length === 0
    ? 'All Platforms'
    : platforms.map(id => PLATFORMS.find(p => p.id === id)?.name).filter(Boolean).join(', ')

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
        <div className="movie-hero-icon">🎬</div>
        <h1>Movies</h1>
        <p className="subtitle">
          Swipe through top-rated movies. When you both swipe right — it's a match!
        </p>

        {/* Streaming Platforms */}
        <div className="filter-section">
          <button className="filter-header" onClick={() => setPlatformOpen(o => !o)}>
            <span className="filter-header-left">
              <span className="filter-icon">📡</span>
              <span className="filter-header-title">Streaming Platforms</span>
              <span className="filter-badge">{platformLabel}</span>
            </span>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              className={`filter-arrow ${platformOpen ? 'open' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {platformOpen && (
            <div className="filter-body">
              <button
                className={`filter-all-btn ${platforms.length === 0 ? 'active' : ''}`}
                onClick={() => setPlatforms([])}
              >
                {platforms.length === 0 && <span className="filter-check">✓</span>}
                All Platforms
              </button>
              <div className="filter-grid">
                {PLATFORMS.map(p => {
                  const active = platforms.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      className={`filter-btn ${active ? 'active' : ''}`}
                      style={active ? { background: p.bg, borderColor: p.border, color: p.color } : {}}
                      onClick={() => togglePlatform(p.id)}
                    >
                      {active && <span className="filter-check">✓</span>}
                      {p.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Genres */}
        <div className="filter-section">
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
                      {active && <span className="filter-check">✓</span>}
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
          {loading ? 'Creating...' : 'Create Room'}
        </button>
      </div>
    </div>
  )
}
