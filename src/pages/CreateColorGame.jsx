import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createColorGameRoom, getUserToken } from '../lib/room'
import ModeToggle from '../components/ModeToggle'
import { ROUNDS_PER_GAME } from '../lib/colorGame'
import './CreateColorGame.css'

export default function CreateColorGame() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [solo, setSolo] = useState(false)

  async function handleCreate() {
    setLoading(true)
    try {
      getUserToken()
      const room = await createColorGameRoom({ solo })
      navigate(`/room/${room.id}`, { state: { isCreator: true, isSolo: solo } })
    } catch (err) {
      console.error('Failed to create game:', err)
      alert('Failed to create the game. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="create-cg">
      <button className="back-btn" onClick={() => navigate('/')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
      </button>

      <div className="create-cg-hero" aria-hidden="true">🎨</div>
      <h1>Color Duel <span className="create-cg-beta">Beta</span></h1>

      <div style={{ maxWidth: 360, margin: '0 auto' }}>
        <ModeToggle solo={solo} onChange={setSolo} />
      </div>

      <p className="subtitle">
        {solo
          ? `${ROUNDS_PER_GAME} rounds: a movie or series poster with the colour drained — mix the shade you remember and see how close you get.`
          : `${ROUNDS_PER_GAME} rounds: you both see a drained poster and mix the colour from memory. Closest guess takes the round — who knows their movies better?`}
      </p>

      <div className="create-cg-demo" aria-hidden="true">
        <span className="create-cg-chip" style={{ background: '#E8CF43' }} />
        <span className="create-cg-chip" style={{ background: '#4DA46A' }} />
        <span className="create-cg-chip" style={{ background: '#CE2C2F' }} />
        <span className="create-cg-chip" style={{ background: '#4718B2' }} />
        <span className="create-cg-chip" style={{ background: '#DF9AB2' }} />
      </div>

      <button className="btn btn-primary create-cg-btn" onClick={handleCreate} disabled={loading}>
        {loading ? 'Creating…' : solo ? 'Play solo' : 'Create Game'}
      </button>
      <p className="create-cg-attrib">Posters via TMDB</p>
    </div>
  )
}
