import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createFoodRoom, getUserToken } from '../lib/room'
import { geocodeLocation } from '../lib/placesApi'
import ModeToggle from '../components/ModeToggle'
import './CreateActivityRoom.css'

const RADIUS_OPTIONS = [
  { label: '1 km', value: 1000 },
  { label: '3 km', value: 3000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
  { label: '20 km', value: 20000 },
]

// Reverse-geocode coordinates → ISO country code (via Nominatim, non-blocking)
async function detectCountryCode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const data = await res.json()
    return (data.address?.country_code || '').toUpperCase() || null
  } catch {
    return null
  }
}

export default function CreateFoodRoom() {
  const navigate = useNavigate()
  const [locationText, setLocationText] = useState('')
  const [pinnedCoords, setPinnedCoords] = useState(null)
  const [pinnedCountryCode, setPinnedCountryCode] = useState(null)
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

    // After GPS succeeds: reverse-geocode for human label + country code
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
          setPinnedCountryCode((d.address?.country_code || '').toUpperCase() || null)
        })
        .catch(() => { setLocationText('My Location'); setPinnedCountryCode(null) })
        .finally(() => { clearTimeout(t); setGeoLoading(false) })
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
      let lat, lng, locationName, countryCode

      if (pinnedCoords) {
        lat = pinnedCoords.lat
        lng = pinnedCoords.lng
        locationName = locationText.trim() || 'My Location'
        countryCode = pinnedCountryCode // already fetched during GPS lookup
      } else {
        try {
          const geo = await geocodeLocation(locationText.trim())
          lat = geo.lat
          lng = geo.lng
          locationName = geo.name
        } catch (geoErr) {
          const msg = geoErr.message || ''
          if (msg.includes('No results')) {
            setError(`Couldn't find "${locationText.trim()}". Try a different city name.`)
          } else {
            setError(`Location search failed: ${msg}`)
          }
          setLoading(false)
          return
        }
        // Detect country from the resolved coordinates (non-blocking — null is fine)
        countryCode = await detectCountryCode(lat, lng)
      }

      const room = await createFoodRoom({ lat, lng, locationName, radius, countryCode, solo, playerCount })
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
        <div className="activity-hero-icon">🍽️</div>
        <h1>Food & Dining</h1>

        <ModeToggle solo={solo} onChange={setSolo} />

        {!solo && (
          <div className="player-count-row">
            <button
              className="player-count-select"
              onClick={() => setShowPlayerPicker(p => !p)}
            >
              <span>👥 {playerCount} people</span>
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
                    <span>{n} people</span>
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
            ? 'Swipe through cuisines and discover restaurants nearby — perfect for planning tonight\'s dinner.'
            : playerCount === 2
              ? 'Swipe through cuisines — when you match, discover real restaurants nearby you\'d both enjoy!'
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
              onChange={e => { setLocationText(e.target.value); setPinnedCoords(null); setPinnedCountryCode(null); setError(null) }}
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
