import { useEffect, useRef } from 'react'
import { loadLib } from '../../lib/mapsLoader'
import './TripMap.css'

// Minimal light map style — clean look matching the app palette
const MAP_STYLE = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#f5f7fa' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#e8ecf2' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#bfe3f5' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f8fafc' }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
]

const CATEGORY_COLORS = {
  history:    '#8B5CF6',
  food:       '#F59E0B',
  nature:     '#10B981',
  nightlife:  '#EC4899',
  art:        '#6366F1',
  beach:      '#06B6D4',
  shopping:   '#F97316',
  monuments:  '#EF4444',
  adventure:  '#84CC16',
  wellness:   '#14B8A6',
  default:    '#0EA5E9',
}

export default function TripMap({ activities, centerCoords }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const infoWindowRef = useRef(null)

  // Initialise map once
  useEffect(() => {
    if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) return
    Promise.all([loadLib('maps'), loadLib('marker')]).then(
      ([{ Map, InfoWindow, ControlPosition }]) => {
        const center = centerCoords
          ? { lat: centerCoords.lat, lng: centerCoords.lng }
          : { lat: activities?.[0]?.lat ?? 48.8566, lng: activities?.[0]?.lng ?? 2.3522 }

        mapRef.current = new Map(containerRef.current, {
          center,
          zoom: 13,
          styles: MAP_STYLE,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: {
            position: ControlPosition.RIGHT_CENTER,
          },
          gestureHandling: 'cooperative',
        })

        infoWindowRef.current = new InfoWindow()
        placeMarkers(activities)
      }
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update markers when activities change (day switch)
  useEffect(() => {
    if (!mapRef.current) return
    placeMarkers(activities)
  }, [activities])  

  function placeMarkers(acts) {
    const g = window.google?.maps
    if (!g || !mapRef.current) return

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []
    if (!acts?.length) return

    const bounds = new g.LatLngBounds()
    const validActs = acts.filter((a) => a.lat && a.lng)

    validActs.forEach((act, idx) => {
      const color = CATEGORY_COLORS[act.category] ?? CATEGORY_COLORS.default

      const marker = new g.Marker({
        position: { lat: act.lat, lng: act.lng },
        map: mapRef.current,
        title: act.name,
        icon: {
          url:
            `data:image/svg+xml;charset=UTF-8,` +
            encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44">
                <filter id="s" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.25"/>
                </filter>
                <path filter="url(#s)" fill="${color}" d="M17 2C10.4 2 5 7.4 5 14c0 9 12 28 12 28s12-19 12-28c0-6.6-5.4-12-12-12z"/>
                <text x="17" y="17" text-anchor="middle" dominant-baseline="middle"
                  font-family="system-ui,sans-serif" font-size="12" font-weight="bold" fill="white">
                  ${idx + 1}
                </text>
              </svg>`
            ),
          scaledSize: new g.Size(34, 44),
          anchor: new g.Point(17, 44),
        },
        zIndex: 100 - idx,
      })

      marker.addListener('click', () => {
        infoWindowRef.current.setContent(`
          <div style="font-family:-apple-system,sans-serif;padding:4px 2px;max-width:200px">
            <div style="font-weight:700;font-size:14px;color:#0F172A;margin-bottom:4px">${act.name}</div>
            <div style="font-size:12px;color:#64748B">${act.time} · ${act.duration}</div>
            ${act.insiderTip ? `<div style="margin-top:6px;font-size:11px;color:#0284C7;font-style:italic">💡 ${act.insiderTip}</div>` : ''}
          </div>
        `)
        infoWindowRef.current.open(mapRef.current, marker)
      })

      markersRef.current.push(marker)
      bounds.extend({ lat: act.lat, lng: act.lng })
    })

    if (validActs.length > 1) {
      mapRef.current.fitBounds(bounds, { padding: 60 })
      g.event.addListenerOnce(mapRef.current, 'bounds_changed', () => {
        if (mapRef.current.getZoom() > 15) mapRef.current.setZoom(15)
      })
    } else if (validActs.length === 1) {
      mapRef.current.setCenter({ lat: validActs[0].lat, lng: validActs[0].lng })
      mapRef.current.setZoom(14)
    }
  }

  if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="trip-map-placeholder">
        <span>🗺️</span>
        <p>Add VITE_GOOGLE_MAPS_API_KEY to enable the map view.</p>
      </div>
    )
  }

  return <div className="trip-map-container" ref={containerRef} />
}
