import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createFoodRoom, getUserToken } from '../lib/room'
import LocationField from '../components/location/LocationField'
import ModeToggle from '../components/ModeToggle'
import './CreateActivityRoom.css'
import AppHeader from '../components/AppHeader'

export default function CreateFoodRoom() {
  const navigate = useNavigate()
  const [area, setArea] = useState(null)   // { lat, lng, radius, locationName, countryCode }
  const [areaMissing, setAreaMissing] = useState(false)
  const locationRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [solo, setSolo] = useState(false)
  const [playerCount, setPlayerCount] = useState(2)
  const [showPlayerPicker, setShowPlayerPicker] = useState(false)

  // Create Room without an area opens the map on the user's position, and
  // confirming it there creates the room straight away: one tap, not two.
  const createAfterPick = useRef(false)

  function handleCreate() {
    if (!area) {
      setAreaMissing(true)
      createAfterPick.current = true
      locationRef.current?.open({ confirmLabel: solo ? 'Start here' : 'Create room here' })
      return
    }
    createRoom(area)
  }

  async function createRoom(where) {
    setLoading(true)
    setError(null)
    try {
      getUserToken()
      const room = await createFoodRoom({ ...where, solo, playerCount })
      navigate(`/room/${room.id}`, { state: { isCreator: true, isSolo: solo } })
    } catch (err) {
      console.error('Failed to create room:', err)
      const msg = err?.message || err?.details || err?.hint || JSON.stringify(err) || 'Unknown error'
      setError(`Failed to create room: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  function handleAreaChange(a) {
    setArea(a)
    setAreaMissing(false)
    setError(null)
    if (createAfterPick.current) {
      createAfterPick.current = false
      createRoom(a)
    }
  }

  return (
    <div className="create-activity">
      <AppHeader onBack={() => navigate('/')} backLabel="Back to home" />

      <div className="create-activity-content">
        <div className="activity-hero-icon">🍽️</div>
        <h1>Food & Drinks</h1>

        <ModeToggle solo={solo} onChange={setSolo} />

        {!solo && (
          <div className="player-count-row">
            <button
              className="player-count-select"
              onClick={() => setShowPlayerPicker(p => !p)}
            >
              <span>
                👥 {playerCount} people
                {playerCount > 2 && <span className="beta-pill">Beta</span>}
              </span>
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                className={showPlayerPicker ? 'rotated' : ''}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showPlayerPicker && (
              <div className="player-count-dropdown">
                {[2, 3, 4, 5, 6].map(n => (
                  <button
                    key={n}
                    className={`player-count-option ${playerCount === n ? 'active' : ''}`}
                    onClick={() => { setPlayerCount(n); setShowPlayerPicker(false) }}
                  >
                    <span>
                      {n} people
                      {n > 2 && <span className="beta-pill">Beta</span>}
                    </span>
                    {playerCount === n && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="subtitle">
          {solo
            ? 'Swipe through cuisines and discover restaurants nearby - perfect for planning tonight\'s dinner.'
            : playerCount === 2
              ? 'Swipe through cuisines - when you match, discover real restaurants nearby you\'d both enjoy!'
              : `Up to ${playerCount} people swipe independently - see what everyone agrees on!`}
        </p>

        <div className="activity-form">
          <p className="form-label" id="search-area-label">Search area</p>
          <LocationField
            ref={locationRef}
            labelId="search-area-label"
            value={area}
            invalid={areaMissing && !area}
            onChange={handleAreaChange}
            onCancel={() => { createAfterPick.current = false }}
          />

          {error && <p className="create-error" role="alert">{error}</p>}

          <button
            className="btn btn-primary create-btn"
            disabled={loading}
            onClick={handleCreate}
          >
            {loading ? 'Creating…' : solo ? 'Start Now' : 'Create Room'}
          </button>
        </div>
      </div>
    </div>
  )
}
