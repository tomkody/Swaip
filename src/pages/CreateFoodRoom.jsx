import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createFoodRoom, getUserToken } from '../lib/room'
import './CreateFoodRoom.css'

export default function CreateFoodRoom() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    setLoading(true)
    try {
      getUserToken()
      const room = await createFoodRoom()
      navigate(`/room/${room.id}`, { state: { isCreator: true } })
    } catch (err) {
      console.error('Failed to create room:', err)
      alert('Failed to create room. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="create-food">
      <button className="back-btn" onClick={() => navigate('/')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
      </button>

      <div className="create-food-content">
        <div className="food-hero-icon">🍽️</div>
        <h1>Food & Dining</h1>
        <p className="subtitle">
          End the "what's for dinner?" debate. Swipe through cuisines — when you both say yes, it's a match!
        </p>

        <div className="food-preview">
          <span>🍕</span>
          <span>🍔</span>
          <span>🍝</span>
          <span>🌮</span>
          <span>🍣</span>
          <span>🥡</span>
        </div>

        <button
          className="btn btn-primary create-btn"
          disabled={loading}
          onClick={handleCreate}
        >
          {loading ? 'Creating…' : 'Create Room'}
        </button>
      </div>
    </div>
  )
}
