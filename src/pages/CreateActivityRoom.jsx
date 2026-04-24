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
  const [pinnedCoords, setPinnedCoords] = useState(null) // { lat, lng } from GPS — bypasses geocoding
  const [radius, setRadius] = useState(5000)
  const [loading, setLoading] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.')
      return
    }
    setGeoLoading(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        // Store exact GPS coordinates — no geocoding roundtrip
        setPinnedCoords({ lat: latitude, lng: longitude })
        // Reverse geocode just for the display label (does not affect actual coords used)
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
          )
          const data = await res.json()
          const label =
            data.address?.neighbourhood ||
            data.address?.suburb ||
            data.address?.city_district ||
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            'My Location'
          setLocationText(label)
        } catch {
          setLocationText('My Location')
        }
        setGeoLoading(false)
      },
      () => {
        setError('Could not get your location. Please type a city name.')
        setGeoLoading(false)
      }
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
        // Use exact GPS coordinates — skip geocoding entirely
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
          console.error('Geocode failed:', geoErr.message)
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

      const room = await createActivityRoom({ lat, lng, locationName, radius })
      navigate(`/room/${room.id}`, { state: { isCreator: true } })
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
        <p className="subtitle">
          Swipe through categories, find a match, then discover real places nearby you'd both enjoy!
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
            {loading ? 'Creating…' : 'Create Room'}
          </button>
        </div>
      </div>
    </div>
  )
}
