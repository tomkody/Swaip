import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createSeriesRoom, getUserToken } from '../lib/room'
import './CreateSeriesRoom.css'

export default function CreateSeriesRoom() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    setLoading(true)
    try {
      getUserToken()
      const room = await createSeriesRoom()
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
          Swipe through 50 top-rated TV series of all time. When you both swipe right on the same show — it's a match!
        </p>

        <div className="series-preview">
          <div className="preview-card">📺</div>
          <div className="preview-card">🎭</div>
          <div className="preview-card">⭐</div>
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
