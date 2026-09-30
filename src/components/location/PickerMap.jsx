import { useEffect, useImperativeHandle, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { TILES, mapyAvailable, markMapyDown, onMapyDown } from '../../lib/mapConfig'

// The only file that knows about Leaflet. The pin never moves: the map slides
// under it (as in Wolt or Uber), so the centre of the map IS the chosen point
// and there is no marker to lose off-screen or fumble with a thumb.
//
// The search circle is a DOM overlay sized from the zoom, not a map layer, so
// it can't lag a frame behind a pan the way a re-positioned layer does.

const EARTH_M = 40075016.686
const TILE = 256
// A move that starts this soon after a touch, click, wheel or key on the map is
// the user's. Everything else (search, GPS, fitting the radius, a resize) is ours.
const USER_INPUT_WINDOW_MS = 600

function metresPerPixel(lat, zoom) {
  return EARTH_M * Math.cos(lat * Math.PI / 180) / (TILE * 2 ** zoom)
}

// Zoom at which `radius` metres spans `px` screen pixels.
function zoomForRadius(lat, radius, px) {
  return Math.log2(EARTH_M * Math.cos(lat * Math.PI / 180) * px / (TILE * radius))
}

const reducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

export default function PickerMap({
  ref, center, radius, gpsFix, children,
  onMoveStart, onMoveEnd, onReady, onError,
}) {
  const boxRef = useRef(null)
  const mapElRef = useRef(null)
  const circleRef = useRef(null)
  const mapRef = useRef(null)
  const radiusRef = useRef(radius)
  const animatingZoomRef = useRef(false)
  const pendingRef = useRef(null)          // a move asked for mid-zoom, done at zoomend
  const handlers = useRef({})
  handlers.current = { onMoveStart, onMoveEnd, onReady, onError }

  const sizeCircle = (zoom, lat, animate = false) => {
    const el = circleRef.current
    if (!el) return
    const d = 2 * radiusRef.current / metresPerPixel(lat, zoom)
    el.style.transition = animate && !reducedMotion()
      ? 'width 250ms cubic-bezier(0,0,.25,1), height 250ms cubic-bezier(0,0,.25,1)'
      : 'none'
    el.style.width = `${d}px`
    el.style.height = `${d}px`
  }

  const fitZoom = (map, lat, r) => {
    const size = map.getSize()
    const px = Math.max(40, Math.min(size.x, size.y) / 2 - 28)
    const z = zoomForRadius(lat, r, px)
    return Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), z))
  }

  // Leaflet silently drops a zoom asked for while another zoom animates, so
  // requests that arrive then are merged into one and replayed at zoomend:
  // a queued pan keeps its target, a queued fit stays a fit.
  const queue = (req) => {
    const prev = pendingRef.current
    pendingRef.current = {
      c: req.c || prev?.c || null,
      animate: req.animate,
      fit: Boolean(req.fit || prev?.fit),
    }
  }

  const apply = (map, { c, animate, fit }) => {
    const target = c || map.getCenter()
    const z = fit ? fitZoom(map, target.lat, radiusRef.current) : map.getZoom()
    map.setView([target.lat, target.lng], z, { animate })
  }

  useImperativeHandle(ref, () => ({
    setCenter(c, { animate = !reducedMotion() } = {}) {
      const map = mapRef.current
      if (!map) return
      if (animatingZoomRef.current) { queue({ c, animate }); return }
      apply(map, { c, animate, fit: false })
    },
    fitRadius(c, r, { animate = !reducedMotion() } = {}) {
      radiusRef.current = r
      const map = mapRef.current
      if (!map) return
      sizeCircle(map.getZoom(), map.getCenter().lat)
      if (animatingZoomRef.current) { queue({ c, animate, fit: true }); return }
      apply(map, { c, animate, fit: true })
    },
    getCenter() {
      const c = mapRef.current?.getCenter()
      return c ? { lat: c.lat, lng: c.lng } : null
    },
    // apply, queue and fitZoom only touch refs and the map, so these methods
    // never go stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [])

  useEffect(() => {
    radiusRef.current = radius
    const map = mapRef.current
    if (map) sizeCircle(map.getZoom(), map.getCenter().lat)
  }, [radius])

  // Create the map once. StrictMode mounts twice in dev; remove() undoes it.
  useEffect(() => {
    const el = mapElRef.current
    const still = reducedMotion()
    const map = L.map(el, {
      center: [center.lat, center.lng],
      zoom: 13,
      zoomControl: false,
      zoomSnap: 0.25,
      wheelPxPerZoomLevel: 120,
      touchZoom: 'center',
      scrollWheelZoom: 'center',
      doubleClickZoom: 'center',
      bounceAtZoomLimits: false,
      keyboard: true,
      zoomAnimation: !still,
      fadeAnimation: !still,
      markerZoomAnimation: !still,
      inertia: !still,
      minZoom: 4,
      maxZoom: 18,
    })
    mapRef.current = map
    let disposed = false   // remove() fires one last moveend that nobody should act on

    map.attributionControl.setPrefix(false)
    map.attributionControl.setPosition('bottomleft')
    L.control.zoom({ position: 'topright', zoomInTitle: 'Zoom in', zoomOutTitle: 'Zoom out' }).addTo(map)
    map.setView([center.lat, center.lng], fitZoom(map, center.lat, radiusRef.current), { animate: false })
    sizeCircle(map.getZoom(), center.lat)

    // ── Tiles, with a way down from Mapy to OSM and from OSM to "no map" ──
    let layer = null
    let logo = null
    let loaded = 0
    let errors = 0
    let giveUpTimer = null
    const setTiles = (provider) => {
      if (disposed) return
      if (layer) map.removeLayer(layer)
      if (logo) { map.removeControl(logo); logo = null }
      loaded = 0
      errors = 0
      const cfg = TILES[provider]
      layer = L.tileLayer(cfg.url(), { ...cfg.options, tileSize: TILE, updateWhenZooming: false, keepBuffer: 1 })
      layer.on('tileload', () => {
        if (loaded++ === 0) { clearTimeout(giveUpTimer); handlers.current.onReady?.() }
      })
      layer.on('tileerror', () => {
        if (loaded > 0 || ++errors < 4) return
        if (provider === 'mapy') markMapyDown()
        else handlers.current.onError?.('tiles')
      })
      layer.addTo(map)
      if (provider === 'mapy') {
        // Mapy answers a bad key or spent credits with a 403 that is still a
        // valid PNG ("The API key is not authorized"), so the <img> loads and
        // Leaflet never sees an error. fetch() can read the status.
        const z = Math.round(map.getZoom())
        const p = map.project(map.getCenter(), z).divideBy(TILE).floor()
        fetch(L.Util.template(cfg.url(), { z, x: p.x, y: p.y }), { credentials: 'omit' })
          .then(res => { if (!res.ok) markMapyDown() })
          .catch(() => { /* network trouble: tileerror and the timer below cover it */ })
        const Logo = L.Control.extend({
          onAdd() {
            const a = L.DomUtil.create('a', 'loc-mapy-logo')
            a.href = 'https://mapy.com/'
            a.target = '_blank'
            a.rel = 'noopener'
            a.innerHTML = '<img src="https://api.mapy.com/img/api/logo.svg" height="30" alt="Mapy.com">'
            return a
          },
        })
        logo = new Logo({ position: 'bottomleft' }).addTo(map)
      }
      clearTimeout(giveUpTimer)
      giveUpTimer = setTimeout(() => {
        if (loaded > 0) return
        if (provider === 'mapy') markMapyDown()
        else handlers.current.onError?.('tiles')
      }, 9000)
    }
    setTiles(mapyAvailable() ? 'mapy' : 'osm')
    const offMapy = onMapyDown(() => setTiles('osm'))

    // ── Who moved the map ──
    let pointerDown = false
    let lastInput = 0
    let moveByUser = false
    const markInput = () => { lastInput = Date.now() }
    const onPointerDown = () => { pointerDown = true; markInput() }
    const onPointerUp = () => { pointerDown = false; markInput() }
    el.addEventListener('pointerdown', onPointerDown, true)
    el.addEventListener('wheel', markInput, { capture: true, passive: true })
    el.addEventListener('keydown', markInput, true)
    window.addEventListener('pointerup', onPointerUp, true)
    window.addEventListener('pointercancel', onPointerUp, true)

    map.on('movestart', () => {
      if (disposed) return
      moveByUser = pointerDown || Date.now() - lastInput < USER_INPUT_WINDOW_MS
      boxRef.current?.classList.add('is-moving')
      handlers.current.onMoveStart?.({ byUser: moveByUser })
    })
    map.on('moveend', () => {
      if (disposed) return
      boxRef.current?.classList.remove('is-moving')
      // A moveend without its own movestart (a resize) reports false.
      const byUser = moveByUser
      moveByUser = false
      const c = map.getCenter()
      handlers.current.onMoveEnd?.({ center: { lat: c.lat, lng: c.lng }, zoom: map.getZoom(), byUser })
    })
    map.on('zoomanim', e => { animatingZoomRef.current = true; sizeCircle(e.zoom, e.center.lat, true) })
    map.on('zoom', () => { if (!animatingZoomRef.current) sizeCircle(map.getZoom(), map.getCenter().lat) })
    map.on('zoomend', () => {
      animatingZoomRef.current = false
      sizeCircle(map.getZoom(), map.getCenter().lat)
      const pending = pendingRef.current
      if (pending && !disposed) {
        pendingRef.current = null
        apply(map, pending)
      }
    })
    map.on('resize', () => sizeCircle(map.getZoom(), map.getCenter().lat))

    // ── Keep Leaflet's centre on the pin when the box changes size ──
    // Leaflet only watches the window, but the box also shrinks when a hint
    // appears under it or the keyboard opens. invalidateSize({pan: true})
    // shifts the map to keep its centre, but a running pan or zoom rewrites
    // the position every frame and undoes that shift, so wait for it to land.
    const animating = () => {
      const pane = map.getPane('mapPane')
      return Boolean(pane && (pane.classList.contains('leaflet-pan-anim') || pane.classList.contains('leaflet-zoom-anim')))
    }
    const fitToBox = () => {
      if (disposed) return
      if (animating()) { map.once('moveend', fitToBox); return }
      map.invalidateSize({ pan: true, animate: false })
    }
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fitToBox) : null
    ro?.observe(el)

    // The sheet may still be settling into its final size: measure again and
    // re-fit the circle to what the map box really is.
    const raf = requestAnimationFrame(() => {
      if (disposed) return
      map.invalidateSize()
      map.setView(map.getCenter(), fitZoom(map, map.getCenter().lat, radiusRef.current), { animate: false })
    })

    return () => {
      disposed = true
      ro?.disconnect()
      cancelAnimationFrame(raf)
      clearTimeout(giveUpTimer)
      offMapy()
      el.removeEventListener('pointerdown', onPointerDown, true)
      el.removeEventListener('wheel', markInput, { capture: true })
      el.removeEventListener('keydown', markInput, true)
      window.removeEventListener('pointerup', onPointerUp, true)
      window.removeEventListener('pointercancel', onPointerUp, true)
      map.remove()
      // Leaflet 1.9 leaves a 250 ms zoom-end timer running after remove();
      // with the flag cleared it returns early instead of reading the gone pane.
      map._animatingZoom = false
      mapRef.current = null
      pendingRef.current = null
      animatingZoomRef.current = false
    }
    // Created once; later centres arrive through the ref methods.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The fix from "Use my location": a blue dot and a ring as wide as its
  // accuracy, drawn on the map so it stays put while the pin moves away.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !gpsFix) return
    const ll = [gpsFix.lat, gpsFix.lng]
    const ring = L.circle(ll, {
      radius: gpsFix.accuracy, interactive: false,
      color: '#2F7BF6', weight: 1, opacity: 0.6, fillColor: '#2F7BF6', fillOpacity: 0.1,
    }).addTo(map)
    const dot = L.circleMarker(ll, {
      radius: 6, interactive: false,
      color: '#FFFFFF', weight: 2, fillColor: '#2F7BF6', fillOpacity: 1,
    }).addTo(map)
    return () => { ring.remove(); dot.remove() }
  }, [gpsFix])

  return (
    <div ref={boxRef} className="loc-map">
      <div
        ref={mapElRef}
        className="loc-map-canvas"
        aria-label="Map. Move it to place the pin, or search above."
        role="application"
      />
      <div className="loc-overlay" aria-hidden="true">
        <div ref={circleRef} className="loc-circle" />
        <svg className="loc-pin" width="36" height="46" viewBox="0 0 36 46">
          <defs>
            <linearGradient id="locPinFill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#FF5E62" />
              <stop offset="1" stopColor="#FF8A47" />
            </linearGradient>
          </defs>
          <path d="M18 45c-1-4.5-4.2-8.6-8.1-12.7C5.6 27.8 2 23.7 2 17.5 2 8.7 9.2 2 18 2s16 6.7 16 15.5c0 6.2-3.6 10.3-7.9 14.8C22.2 36.4 19 40.5 18 45z" fill="url(#locPinFill)" stroke="#fff" strokeWidth="2.5" />
          <circle cx="18" cy="17.5" r="5.5" fill="#fff" />
        </svg>
        <span className="loc-pin-shadow" />
      </div>
      {children}
    </div>
  )
}
