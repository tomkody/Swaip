import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createMovieRoom, getUserToken } from '../lib/room'
import './CreateMovieRoom.css'

export default function CreateMovieRoom() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    setLoading(true)
    try {
      getUserToken()
      const room = await createMovieRoom()
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
          Swipe through 50 top-rated movies of all time. When you both swipe right on the same movie — it's a match!
        </p>

        <div className="movie-preview">
          <div className="preview-card">🍿</div>
          <div className="preview-card">🎥</div>
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
