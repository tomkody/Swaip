import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { createMovieRoom, getUserToken } from '../lib/room'
import { PLATFORMS } from '../lib/platforms'
import { loadMoviePool, filterMoviePool } from '../lib/tmdb'
import { LENGTH_OPTIONS, ERA_OPTIONS, FEW_MATCHES, countMatches, hasPrefs, prefsLabel } from '../lib/movieFilters'
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
  const [length, setLength] = useState('any')
  const [era, setEra] = useState('any')
  const [platformOpen, setPlatformOpen] = useState(false)
  const [genreOpen, setGenreOpen] = useState(false)
  const [tonightOpen, setTonightOpen] = useState(false)
  const [pool, setPool] = useState(null)   // catalog for the live count; loaded on first open
  const platformRef = useRef(null)
  const genreRef = useRef(null)
  const tonightRef = useRef(null)

  // Length/era are soft preferences (matching titles come first, the deck
  // never runs dry). The live count tells the pair how many close matches
  // lead the deck, so they can see when they've narrowed too far.
  useEffect(() => {
    if (!tonightOpen || pool) return
    let active = true
    loadMoviePool().then(p => { if (active) setPool(p) }).catch(() => {})
    return () => { active = false }
  }, [tonightOpen, pool])

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (platformOpen && platformRef.current && !platformRef.current.contains(e.target)) {
        setPlatformOpen(false)
      }
      if (genreOpen && genreRef.current && !genreRef.current.contains(e.target)) {
        setGenreOpen(false)
      }
      if (tonightOpen && tonightRef.current && !tonightRef.current.contains(e.target)) {
        setTonightOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [platformOpen, genreOpen, tonightOpen])

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
      const room = await createMovieRoom(platforms, genres, { solo, length, era })
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

  const prefs = { length, era }
  const anyFilter = platforms.length > 0 || genres.length > 0 || hasPrefs(prefs)
  const matchCount = pool && hasPrefs(prefs)
    ? countMatches(filterMoviePool(pool, platforms, genres), prefs)
    : null

  function resetFilters() {
    setPlatforms([]); setGenres([]); setLength('any'); setEra('any')
  }

  return (
    <div className="create-movie">
      <button className="back-btn" onClick={() => navigate('/')} aria-label="Back to home">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
      </button>

      <div className="create-movie-content">
        <div className="movie-hero-icon">🎬</div>
        <h1>Movies</h1>

        <ModeToggle solo={solo} onChange={setSolo} />

        <p className="subtitle">
          {solo
            ? 'Swipe through top-rated movies and build your personal watchlist.'
            : 'Swipe through top-rated movies. When you both swipe right — it\'s a match!'}
        </p>

        {/* Streaming Platforms */}
        <div className="filter-section" ref={platformRef}>
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

        {/* Tonight: length + era (soft preferences) */}
        <div className="filter-section" ref={tonightRef}>
          <button className="filter-header" onClick={() => setTonightOpen(o => !o)} aria-expanded={tonightOpen}>
            <span className="filter-header-left">
              <span className="filter-icon">⏱️</span>
              <span className="filter-header-title">Tonight</span>
              <span className="filter-badge">{prefsLabel(prefs)}</span>
            </span>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              className={`filter-arrow ${tonightOpen ? 'open' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {tonightOpen && (
            <div className="filter-body">
              <fieldset className="pref-group">
                <legend className="pref-legend">Length</legend>
                <div className="pref-chips">
                  {LENGTH_OPTIONS.map(o => (
                    <label key={o.id} className={`pref-chip ${length === o.id ? 'active' : ''}`}>
                      <input type="radio" name="length" value={o.id} checked={length === o.id} onChange={() => setLength(o.id)} />
                      {o.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="pref-group">
                <legend className="pref-legend">Released</legend>
                <div className="pref-chips">
                  {ERA_OPTIONS.map(o => (
                    <label key={o.id} className={`pref-chip ${era === o.id ? 'active' : ''}`} title={o.hint}>
                      <input type="radio" name="era" value={o.id} checked={era === o.id} onChange={() => setEra(o.id)} />
                      {o.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <p className="pref-note" aria-live="polite">
                {!hasPrefs(prefs)
                  ? 'Matching titles go first. The deck never runs out.'
                  : matchCount === null
                    ? 'Counting titles…'
                    : matchCount < FEW_MATCHES
                      ? `Only ${matchCount} close match${matchCount === 1 ? '' : 'es'} — similar picks follow right after.`
                      : `${matchCount} titles match and lead the deck. The rest follow.`}
              </p>
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
