import { useState, useEffect, useRef, useCallback } from 'react'
import { loadLib } from '../../lib/mapsLoader'
import './PlaceAutocomplete.css'

const STATIC_MAP_URL = (lat, lng, key) =>
  `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=13&size=600x160&scale=2` +
  `&markers=color:0x0EA5E9%7C${lat},${lng}` +
  `&style=feature:poi%7Cvisibility:off` +
  `&style=feature:transit%7Cvisibility:off` +
  `&key=${key}`

export default function PlaceAutocomplete({ value, onChange, disabled }) {
  const [inputText, setInputText] = useState(value?.displayName || '')
  const [suggestions, setSuggestions] = useState([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [mapsReady, setMapsReady] = useState(false)
  const [open, setOpen] = useState(false)

  const autocompleteRef = useRef(null)
  const placesRef = useRef(null)
  const hiddenMapRef = useRef(null)
  const debounceRef = useRef(null)
  const wrapperRef = useRef(null)
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

  // Load Maps once
  useEffect(() => {
    if (!apiKey) return
    Promise.all([loadLib('maps'), loadLib('places')])
      .then(([{ Map }, { AutocompleteService, PlacesService }]) => {
        autocompleteRef.current = new AutocompleteService()
        const dummyMap = new Map(hiddenMapRef.current, {
          center: { lat: 0, lng: 0 },
          zoom: 1,
        })
        placesRef.current = new PlacesService(dummyMap)
        setMapsReady(true)
      })
      .catch(() => {})
  }, [apiKey])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchSuggestions = useCallback(
    (query) => {
      if (!autocompleteRef.current || query.length < 2) {
        setSuggestions([])
        setOpen(false)
        return
      }
      setLoadingSearch(true)
      autocompleteRef.current.getPlacePredictions(
        { input: query, types: ['(cities)'] },
        (predictions, status) => {
          setLoadingSearch(false)
          const OK = window.google?.maps?.places?.PlacesServiceStatus?.OK || 'OK'
          if (status === OK && predictions?.length) {
            setSuggestions(predictions.slice(0, 6))
            setOpen(true)
          } else {
            setSuggestions([])
            setOpen(false)
          }
        }
      )
    },
    []
  )

  const handleInput = (e) => {
    const text = e.target.value
    setInputText(text)
    if (value) onChange(null) // clear confirmed selection when user re-types
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 280)
  }

  const handleSelect = (prediction) => {
    setInputText(prediction.description)
    setSuggestions([])
    setOpen(false)
    setLoadingSearch(true)

    placesRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['geometry', 'name', 'formatted_address', 'address_components'],
      },
      (place, status) => {
        setLoadingSearch(false)
        const OK = window.google?.maps?.places?.PlacesServiceStatus?.OK || 'OK'
        if (status === OK) {
          onChange({
            displayName: place.name,
            formattedAddress: place.formatted_address,
            placeId: prediction.place_id,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          })
        }
      }
    )
  }

  const handleClear = () => {
    setInputText('')
    onChange(null)
    setSuggestions([])
    setOpen(false)
  }

  // No API key — render plain text input
  if (!apiKey) {
    return (
      <div className="pac-wrapper">
        <div className="pac-input-row">
          <span className="pac-icon">📍</span>
          <input
            className="pac-input"
            type="text"
            placeholder="City, country or region…"
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value)
              onChange({ displayName: e.target.value, formattedAddress: e.target.value })
            }}
            disabled={disabled}
          />
        </div>
        <p className="pac-no-key">Add VITE_GOOGLE_MAPS_API_KEY for smart place search.</p>
      </div>
    )
  }

  return (
    <div className="pac-wrapper" ref={wrapperRef}>
      {/* Hidden div for PlacesService (needs a DOM node) */}
      <div ref={hiddenMapRef} style={{ display: 'none' }} />

      {/* Confirmed place card */}
      {value ? (
        <div className="pac-confirmed">
          <img
            className="pac-map-thumb"
            src={STATIC_MAP_URL(value.lat, value.lng, apiKey)}
            alt={value.displayName}
            loading="lazy"
          />
          <div className="pac-confirmed-info">
            <span className="pac-confirmed-name">📍 {value.displayName}</span>
            <span className="pac-confirmed-addr">{value.formattedAddress}</span>
          </div>
          <button className="pac-change-btn" onClick={handleClear} type="button">
            Change
          </button>
        </div>
      ) : (
        /* Search input */
        <div className="pac-search-area">
          <div className="pac-input-row">
            <span className="pac-icon">
              {loadingSearch ? (
                <span className="pac-spinner" />
              ) : (
                '📍'
              )}
            </span>
            <input
              className="pac-input"
              type="text"
              placeholder={mapsReady ? 'Search any city or region…' : 'Loading…'}
              value={inputText}
              onChange={handleInput}
              onFocus={() => suggestions.length > 0 && setOpen(true)}
              disabled={disabled || !mapsReady}
              autoComplete="off"
            />
            {inputText && (
              <button className="pac-clear-btn" onClick={handleClear} type="button">
                ✕
              </button>
            )}
          </div>

          {/* Dropdown */}
          {open && suggestions.length > 0 && (
            <ul className="pac-dropdown">
              {suggestions.map((s) => (
                <li
                  key={s.place_id}
                  className="pac-suggestion"
                  onMouseDown={() => handleSelect(s)}
                >
                  <span className="pac-suggest-icon">📍</span>
                  <span className="pac-suggest-main">{s.structured_formatting.main_text}</span>
                  <span className="pac-suggest-secondary">
                    {s.structured_formatting.secondary_text}
                  </span>
                </li>
              ))}
              <li className="pac-powered">
                <img
                  src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png"
                  alt="Powered by Google"
                  height="14"
                />
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
