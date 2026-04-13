import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createSeriesRoom, getUserToken } from '../lib/room'
import { PLATFORMS } from '../lib/platforms'
import './CreateSeriesRoom.css'

export default function CreateSeriesRoom() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState([])

  const allSelected = selected.length === 0

  function togglePlatform(id) {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  async function handleCreate() {
    setLoading(true)
    try {
      getUserToken()
      const room = await createSeriesRoom(selected)
      navigate(`/room/${room.id}`, { state: { isCreator: true } })
    } catch (err) {
      console.error('Failed to create room:', err)
      alert('Failed to create room. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="create-series">
      <button className="back-btn" onClick={() => navigate('/')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
      </button>

      <div className="create-series-content">
        <div className="series-hero-icon">📺</div>
        <h1>TV Series</h1>
        <p className="subtitle">
          Swipe through top-rated TV shows. When you both swipe right on the same show — it's a match!
        </p>

        <div className="platform-section">
          <p className="platform-title">Filter by streaming platform</p>
          <p className="platform-hint">Only your picks — your partner will see the same selection</p>

          <button
            className={`platform-all-btn ${allSelected ? 'active' : ''}`}
            onClick={() => setSelected([])}
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
