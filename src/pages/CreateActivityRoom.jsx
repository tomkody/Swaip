import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createActivityRoom, getUserToken } from '../lib/room'
import { geocodeLocation, reverseGeocode } from '../lib/placesApi'
import ModeToggle from '../components/ModeToggle'
import './CreateActivityRoom.css'

const RADIUS_OPTIONS = [
  { label: '1 km', value: 1000 },
  { label: '3 km', value: 3000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
  { label: '20 km', value: 20000 },
]

export default function CreateActivityRoom() {
  const navigate = useNavigate()
  const [locationText, setLocationText] = useState('')
  const [pinnedCoords, setPinnedCoords] = useState(null)
  const [radius, setRadius] = useState(5000)
  const [loading, setLoading] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [error, setError] = useState(null)
  const [solo, setSolo] = useState(false)
  const [playerCount, setPlayerCount] = useState(2)
  const [showPlayerPicker, setShowPlayerPicker] = useState(false)

  function handleUseMyLocation() {
    setGeoLoading(true)
    setError(null)

    // Safari on iOS requires explicit permission — if denied, GPS fails and
    // IP-based fallbacks can be 50–200 km off. We no longer silently fall back.
    function onDenied() {
      setGeoLoading(false)
      const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
      setError(
        isIOS
          ? 'Location access denied. Go to Settings → Safari → Location → Allow, then try again. Or type your city below.'
          : 'Location access denied. Please allow it in your browser settings, or type your city below.'
      )
    }

    function applyCoords(latitude, longitude) {
      setPinnedCoords({ lat: latitude, lng: longitude })
      reverseGeocode(latitude, longitude)
        .then(({ name }) => setLocationText(name))
        .catch(() => setLocationText('My Location'))
        .finally(() => setGeoLoading(false))
    }

    if (!navigator.geolocation) {
      setGeoLoading(false)
      setError('Geolocation is not supported by this browser. Please type your city below.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        applyCoords(latitude, longitude)
        // accuracy is in metres — anything above 200m means iOS gave approximate location
        if (accuracy > 200) {
          setError(
            `⚠️ Approximate location only (±${Math.round(accuracy / 1000 * 10) / 10} km). ` +
            `For precise results: Settings → Privacy & Security → Location Services → Safari Websites → enable Precise Location.`
          )
        }
      },
      onDenied,
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    )
  }

  async function handleCreate() {
    if (!locationText.trim() && !pinnedCoords) {
      setError('Please enter a location.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      getUserToken()

      let lat, lng, locationName
      if (pinnedCoords) {
        lat = pinnedCoords.lat
        lng = pinnedCoords.lng
        locationName = locationText.trim() || 'My Location'
      } else {
        try {
          const geo = await geocodeLocation(locationText.trim())
          lat = geo.lat
          lng = geo.lng
          locationName = geo.name
        } catch (geoErr) {
          const msg = geoErr.message || ''
          if (msg.includes('API key') || msg.includes('not configured') || msg.includes('403') || msg.includes('REQUEST_DENIED')) {
            setError('Location search is temporarily unavailable. Please try again in a moment.')
          } else if (msg.includes('No results')) {
            setError(`Couldn't find "${locationText.trim()}". Try a different city name.`)
          } else {
            setError(`Location search failed: ${msg}`)
          }
          setLoading(false)
          return
        }
      }

      const room = await createActivityRoom({ lat, lng, locationName, radius, solo, playerCount })
      navigate(`/room/${room.id}`, { state: { isCreator: true, isSolo: solo } })
    } catch (err) {
      console.error('Failed to create room:', err)
      const msg = err?.message || err?.details || err?.hint || JSON.stringify(err) || 'Unknown error'
      setError(`Failed to create room: ${msg}`)
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
            ? 'Swipe through activity categories and discover real places nearby just for you!'
            : playerCount === 2
              ? 'Swipe through categories, find a match, then discover real places nearby you\'d both enjoy!'
              : `Up to ${playerCount} people swipe independently — see what everyone agrees on!`}
        </p>

        <div className="activity-form">
          <label className="form-label">Where are you?</label>
          <div className="location-input-row">
            <input
              className="location-input"
              type="text"
              placeholder="City or address…"
              value={locationText}
              onChange={e => { setLocationText(e.target.value); setPinnedCoords(null); setError(null) }}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            <button
              className="geo-btn"
              onClick={handleUseMyLocation}
              disabled={geoLoading}
              title="Use my location"
            >
              {geoLoading ? <span className="geo-spinner" /> : '📍'}
            </button>
          </div>

          <label className="form-label" style={{ marginTop: 20 }}>Search radius</label>
          <div className="radius-chips">
            {RADIUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`radius-chip ${radius === opt.value ? 'active' : ''}`}
                onClick={() => setRadius(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {error && <p className="create-error">{error}</p>}

          <button
            className="btn btn-primary create-btn"
            disabled={loading || geoLoading}
            onClick={handleCreate}
          >
            {loading ? 'Creating…' : solo ? 'Start Now' : 'Create Room'}
          </button>
        </div>
      </div>
    </div>
  )
}
