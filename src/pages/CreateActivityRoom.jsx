import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createActivityRoom, getUserToken } from '../lib/room'
import './CreateActivityRoom.css'

export default function CreateActivityRoom() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    setLoading(true)
    try {
      getUserToken()
      const room = await createActivityRoom()
      navigate(`/room/${room.id}`, { state: { isCreator: true } })
    } catch (err) {
      console.error('Failed to create room:', err)
      alert('Failed to create room. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="create-activity">
      <button className="back-btn" onClick={() => navigate('/')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
      </button>

      <div className="create-activity-content">
        <div className="activity-hero-icon">🎯</div>
        <h1>Activities</h1>
        <p className="subtitle">
          Pick activities you'd both enjoy doing. From board games to hiking — find what you have in common!
        </p>

        <div className="activity-preview">
          <div className="preview-card">🎲</div>
          <div className="preview-card">🥾</div>
          <div className="preview-card">🎨</div>
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
