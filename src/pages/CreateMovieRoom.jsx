import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { createMovieRoom, getUserToken } from '../lib/room'
import { PLATFORMS, platformChipStyle } from '../lib/platforms'
import ModeToggle from '../components/ModeToggle'
import './CreateMovieRoom.css'
import AppHeader from '../components/AppHeader'
import Icon from '../components/Icon'
import { GENRES } from '../lib/genres'

export default function CreateMovieRoom() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [solo, setSolo] = useState(false)
  const [platforms, setPlatforms] = useState([])
  const [genres, setGenres] = useState([])
  const [platformOpen, setPlatformOpen] = useState(false)
  const [genreOpen, setGenreOpen] = useState(false)
  const platformRef = useRef(null)
  const genreRef = useRef(null)

  // Close dropdowns when clicking outside - on the click, not the press. Closing
  // an open genre list on mousedown/touchstart pulled the page up under the
  // finger, and the tap on Create Room below it landed on nothing.
  useEffect(() => {
    function handleClickOutside(e) {
      if (platformOpen && platformRef.current && !platformRef.current.contains(e.target)) {
        setPlatformOpen(false)
      }
      if (genreOpen && genreRef.current && !genreRef.current.contains(e.target)) {
        setGenreOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [platformOpen, genreOpen])

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

  const platformLabel = platforms.length === 0
    ? 'All Platforms'
    : platforms.map(id => PLATFORMS.find(p => p.id === id)?.name).filter(Boolean).join(', ')

  const genreLabel = genres.length === 0
    ? 'All Genres'
    : genres.join(', ')

  const anyFilter = platforms.length > 0 || genres.length > 0

  function resetFilters() {
    setPlatforms([]); setGenres([])
  }

  return (
    <div className="create-movie">
      <AppHeader onBack={() => navigate('/')} backLabel="Back to home" />

      <div className="create-movie-content">
        <div className="movie-hero-icon">🎬</div>
        <h1>Movies</h1>

        <ModeToggle solo={solo} onChange={setSolo} />

        <p className="subtitle">
          {solo
            ? 'Swipe through top-rated movies and build your personal watchlist.'
            : 'Swipe through top-rated movies. When you both swipe right - it\'s a match!'}
        </p>

        {/* Streaming Platforms */}
        <div className="filter-section" ref={platformRef}>
          <button className="filter-header" onClick={() => setPlatformOpen(o => !o)}>
            <span className="filter-header-left">
              <span className="filter-icon"><Icon name="tv" size={17} /></span>
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
                      className={`filter-btn ${active ? 'active plat-chip' : ''}`}
                      style={active ? platformChipStyle(p) : {}}
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
        <div className="filter-section" ref={genreRef}>
          <button className="filter-header" onClick={() => setGenreOpen(o => !o)}>
            <span className="filter-header-left">
              <span className="filter-icon"><Icon name="tag" size={17} /></span>
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
                {GENRES.map(({ name, emoji }) => {
                  const active = genres.includes(name)
                  return (
                    <button
                      key={name}
                      className={`filter-btn ${active ? 'active' : ''}`}
                      onClick={() => toggleGenre(name)}
                    >
                      {active
                        ? <span className="filter-check">✓</span>
                        : <span className="filter-emoji">{emoji}</span>}
                      {name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {anyFilter && (
          <button type="button" className="filters-reset" onClick={resetFilters}>
            Reset filters
          </button>
        )}

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
