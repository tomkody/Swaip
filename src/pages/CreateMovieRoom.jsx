import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createMovieRoom, getUserToken } from '../lib/room'
import { PLATFORMS } from '../lib/platforms'
import './CreateMovieRoom.css'

export default function CreateMovieRoom() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState([]) // empty = All

  const allSelected = selected.length === 0

  function togglePlatform(id) {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  function selectAll() { setSelected([]) }

  async function handleCreate() {
    setLoading(true)
    try {
      getUserToken()
      const room = await createMovieRoom(selected)
      navigate(`/room/${room.id}`, { state: { isCreator: true } })
    } catch (err) {
      console.error('Failed to create room:', err)
      alert('Failed to create room. Please try again.')
    } finally {
      setLoading(false)
    }
  }

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

        <div className="platform-section">
          <p className="platform-title">Filter by streaming platform</p>
          <p className="platform-hint">Only your picks — your partner will see the same selection</p>

          <button
            className={`platform-all-btn ${allSelected ? 'active' : ''}`}
            onClick={selectAll}
          >
            {allSelected ? '✓ ' : ''}All Platforms
          </button>

          <div className="platform-grid">
            {PLATFORMS.map(p => {
              const active = selected.includes(p.id)
              return (
                <button
                  key={p.id}
                  className={`platform-btn ${active ? 'active' : ''}`}
                  style={active ? { background: p.bg, borderColor: p.border, color: p.color } : {}}
                  onClick={() => togglePlatform(p.id)}
                >
                  {active && <span className="platform-check">✓</span>}
                  {p.name}
                </button>
              )
            })}
          </div>
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
