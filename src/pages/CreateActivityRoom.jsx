import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createActivityRoom, getUserToken } from '../lib/room'
import { geocodeLocation } from '../lib/placesApi'
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

  function handleUseMyLocation() {
    setGeoLoading(true)
    setError(null)

    const failsafe = setTimeout(() => {
      setGeoLoading(false)
      setError('Could not detect your location. Please type a city name.')
    }, 20000)

    function applyCoords(latitude, longitude) {
      setPinnedCoords({ lat: latitude, lng: longitude })
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 6000)
      fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
        { headers: { 'Accept-Language': 'en' }, signal: ctrl.signal }
      )
        .then(r => r.json())
        .then(d => {
          setLocationText(
            d.address?.neighbourhood || d.address?.suburb ||
            d.address?.city_district || d.address?.city ||
            d.address?.town || d.address?.village || 'My Location'
          )
        })
        .catch(() => { setLocationText('My Location') })
        .finally(() => { clearTimeout(t); setGeoLoading(false) })
    }

    function tryIpFallback() {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 8000)
      fetch('https://ipapi.co/json/', { signal: ctrl.signal })
        .then(r => r.json())
        .then(d => {
          clearTimeout(t)
          if (!d.latitude || !d.longitude) throw new Error('no coords')
          clearTimeout(failsafe)
          setPinnedCoords({ lat: d.latitude, lng: d.longitude })
          setLocationText(d.city || d.region || 'My Location')
          setGeoLoading(false)
        })
        .catch(() => {
          clearTimeout(t)
          clearTimeout(failsafe)
          setGeoLoading(false)
          setError('Could not detect your location. Please type a city name.')
        })
    }

    if (!navigator.geolocation) {
      tryIpFallback()
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(failsafe)
        applyCoords(pos.coords.latitude, pos.coords.longitude)
      },
      () => { tryIpFallback() },
      { maximumAge: 300000 }
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
            setError('Google Maps API key issue — check the deployment environment variables (VITE_GOOGLE_MAPS_API_KEY).')
          } else if (msg.includes('No results')) {
            setError(`Couldn't find "${locationText.trim()}". Try a different city name.`)
          } else {
            setError(`Location search failed: ${msg}`)
          }
          setLoading(false)
          return
        }
      }

      const room = await createActivityRoom({ lat, lng, locationName, radius, solo })
      navigate(`/room/${room.id}`, { state: { isCreator: true, isSolo: solo } })
    } catch (err) {
      console.error('Failed to create room:', err)
      setError('Failed to create room. Please try again.')
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

        <div className="mode-toggle">
          <button className={`mode-btn ${!solo ? 'active' : ''}`} onClick={() => setSolo(false)}>
            👥 Together
          </button>
          <button className={`mode-btn ${solo ? 'active' : ''}`} onClick={() => setSolo(true)}>
            👤 Solo
          </button>
        </div>

        <p className="subtitle">
          {solo
            ? 'Swipe through activity categories and discover real places nearby just for you!'
            : 'Swipe through categories, find a match, then discover real places nearby you\'d both enjoy!'}
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
