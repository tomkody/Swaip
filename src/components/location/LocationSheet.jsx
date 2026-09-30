import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import PickerMap from './PickerMap'
import {
  getBestPosition, accuracyLevel, formatAccuracy, formatRadius, distanceM,
  RADIUS_STEPS, DEFAULT_RADIUS,
} from '../../lib/geo'
import { browserContext, locationHelp, openInSafari } from '../../lib/browserContext'
import { suggest, reverse, clearGeocoderCache, searchCredit } from '../../lib/geocoder'
import { useDialogFocus } from '../../lib/useDialogFocus'
import './LocationSheet.css'

// Full-screen "Choose an area" sheet. The pin in the middle of the map is the
// answer; search and "Use my location" only move the map. A fix from an iPhone
// with Precise Location off can be kilometres out, and now it is just a place
// to start dragging from instead of the room's centre.
//
// Nothing in here calls Google: see lib/mapConfig.js for why.

const LAST_AREA_KEY = 'swaip_last_area'
const MAX_LABEL_LOOKUPS = 12

// Where the map opens when we know nothing yet. The pin can't be confirmed
// from here until the user searches, locates or moves the map.
const HOME_BY_TZ = {
  'Europe/Prague': { lat: 50.0875, lng: 14.4213 },
  'Europe/Bratislava': { lat: 48.1486, lng: 17.1077 },
  'Europe/Warsaw': { lat: 52.2297, lng: 21.0122 },
  'Europe/Berlin': { lat: 52.52, lng: 13.405 },
  'Europe/Vienna': { lat: 48.2082, lng: 16.3738 },
  'Europe/Budapest': { lat: 47.4979, lng: 19.0402 },
  'Europe/London': { lat: 51.5072, lng: -0.1276 },
}

function homeCenter() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return HOME_BY_TZ[tz] || HOME_BY_TZ['Europe/Prague']
  } catch {
    return HOME_BY_TZ['Europe/Prague']
  }
}

// This device only, rounded like the rooms are (~110 m). Just the point and
// the radius: the area's name comes from the geocoder, whose terms don't allow
// keeping its answers, so it is looked up again next time.
function loadLastArea() {
  try {
    const a = JSON.parse(localStorage.getItem(LAST_AREA_KEY) || 'null')
    if (a && Number.isFinite(a.lat) && Number.isFinite(a.lng) && RADIUS_STEPS.includes(a.radius)) {
      return { lat: a.lat, lng: a.lng, radius: a.radius }
    }
  } catch { /* private mode, bad JSON */ }
  return null
}

function saveLastArea(area) {
  try {
    const round = n => Math.round(n * 1000) / 1000
    localStorage.setItem(LAST_AREA_KEY, JSON.stringify({ lat: round(area.lat), lng: round(area.lng), radius: area.radius }))
  } catch { /* storage full or blocked: not worth a word */ }
}

const nearestStep = r => RADIUS_STEPS.reduce((best, s) => (Math.abs(s - r) < Math.abs(best - r) ? s : best), RADIUS_STEPS[0])
const kmWords = r => (r >= 1000 ? `${r / 1000} kilometre${r === 1000 ? '' : 's'}` : `${r} metres`)
const touchDevice = () => Boolean(window.matchMedia?.('(pointer: coarse)').matches)

export default function LocationSheet({ initialArea, defaultRadius = DEFAULT_RADIUS, onConfirm, onCancel }) {
  const titleId = useId()
  const listId = useId()
  const sheetRef = useRef(null)
  const mapRef = useRef(null)
  const inputRef = useRef(null)
  const resultsRef = useRef(null)
  const ctx = useMemo(() => browserContext(), [])
  const browserName = ctx.ios ? 'Safari' : 'your browser'
  const debug = useMemo(() => {
    try { return new URLSearchParams(window.location.search).get('geodebug') === '1' } catch { return false }
  }, [])

  const init = useMemo(() => {
    const from = initialArea || loadLastArea()
    if (from) {
      return {
        center: { lat: from.lat, lng: from.lng },
        radius: nearestStep(from.radius || defaultRadius),
        touched: true,
        label: from.locationName ? { name: from.locationName, countryCode: from.countryCode ?? null, lat: from.lat, lng: from.lng } : null,
      }
    }
    return { center: homeCenter(), radius: defaultRadius, touched: false, label: null }
  }, [initialArea, defaultRadius])

  const [center, setCenter] = useState(init.center)
  const centerRef = useRef(init.center)
  const [radius, setRadius] = useState(init.radius)
  const radiusRef = useRef(init.radius)
  const [touched, setTouched] = useState(init.touched)
  const [label, setLabel] = useState(init.label)
  const labelRef = useRef(init.label)
  const [labelBusy, setLabelBusy] = useState(false)
  const [mapStatus, setMapStatus] = useState('loading')
  const [gpsFix, setGpsFix] = useState(null)
  const [locating, setLocating] = useState(false)
  const [help, setHelp] = useState(null)       // { text, why?, action?, tone }
  const [showWhy, setShowWhy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [debugLines, setDebugLines] = useState([])

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searchStatus, setSearchStatus] = useState('idle') // idle | loading | ok | empty | error
  const [listOpen, setListOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [source, setSource] = useState(null)
  const justPicked = useRef(false)
  const resultsFor = useRef(null)       // the query the shown results answer
  const enterSearch = useRef(null)      // AbortController of a search started by Enter
  const cancelTyping = useRef(null)     // cancels the debounced search in flight

  const followGps = useRef(false)
  const locateAbort = useRef(null)
  const labelAbort = useRef(null)
  const labelTimer = useRef(null)
  const confirmAbort = useRef(null)
  const safariTimer = useRef(null)
  const announceTimer = useRef(null)
  const lookups = useRef(0)

  const updateLabel = l => { labelRef.current = l; setLabel(l) }

  // Clear the live region first, so the same sentence twice is still spoken.
  const say = msg => {
    clearTimeout(announceTimer.current)
    setAnnounce('')
    announceTimer.current = setTimeout(() => setAnnounce(msg), 60)
  }

  useDialogFocus(sheetRef, { onClose: onCancel })

  // The page behind stays put and out of reach while the sheet is open.
  // Layout effect: its cleanup runs before useDialogFocus hands focus back.
  useLayoutEffect(() => {
    const root = document.getElementById('root')
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    root?.setAttribute('inert', '')
    return () => {
      document.body.style.overflow = prevOverflow
      root?.removeAttribute('inert')
    }
  }, [])

  useEffect(() => () => {
    locateAbort.current?.abort()
    labelAbort.current?.abort()
    confirmAbort.current?.abort()
    enterSearch.current?.abort()
    clearTimeout(labelTimer.current)
    clearTimeout(safariTimer.current)
    clearTimeout(announceTimer.current)
    clearGeocoderCache()
  }, [])

  // The on-screen keyboard doesn't shrink the layout on iOS, so cap the result
  // list at what is visible above it.
  useLayoutEffect(() => {
    const vv = window.visualViewport
    const box = resultsRef.current
    if (!listOpen || !vv || !box) return
    const fit = () => {
      const room = vv.offsetTop + vv.height - box.getBoundingClientRect().top - 8
      box.style.setProperty('--loc-results-room', `${Math.max(96, Math.round(room))}px`)
    }
    fit()
    vv.addEventListener('resize', fit)
    vv.addEventListener('scroll', fit)
    return () => {
      vv.removeEventListener('resize', fit)
      vv.removeEventListener('scroll', fit)
    }
  }, [listOpen, results])

  // ── Naming the pinned spot ────────────────────────────────────────────────
  const labelFits = (l, c, r) => Boolean(l) && distanceM(l, c) <= Math.max(250, 0.1 * r)

  async function lookupLabel(c, { force = false } = {}) {
    if (!force && lookups.current >= MAX_LABEL_LOOKUPS) return null
    lookups.current++
    labelAbort.current?.abort()
    const ctrl = new AbortController()
    labelAbort.current = ctrl
    setLabelBusy(true)
    try {
      const r = await reverse(c.lat, c.lng, { signal: ctrl.signal })
      if (r && !ctrl.signal.aborted) {
        const l = { ...r, lat: c.lat, lng: c.lng }
        updateLabel(l)
        return l
      }
    } catch { /* the name is a nicety; the pin still works */ }
    finally { if (labelAbort.current === ctrl) setLabelBusy(false) }
    return null
  }

  function scheduleLabel(c) {
    clearTimeout(labelTimer.current)
    if (labelFits(labelRef.current, c, radiusRef.current)) return
    labelTimer.current = setTimeout(() => lookupLabel(c), 1000)
  }

  // ── Map events ────────────────────────────────────────────────────────────
  function handleMoveStart({ byUser }) {
    if (!byUser) return
    followGps.current = false
    cancelEnterSearch()
    if (listOpen) setListOpen(false)
  }

  function handleMoveEnd({ center: c, byUser }) {
    centerRef.current = c
    setCenter(c)
    if (byUser) {
      if (!touched) setTouched(true)
      if (help?.tone === 'ok') setHelp(null)
    }
    scheduleLabel(c)
  }

  // ── Radius ────────────────────────────────────────────────────────────────
  const stepIndex = Math.max(0, RADIUS_STEPS.indexOf(radius))
  function handleRadius(e) {
    const r = RADIUS_STEPS[Number(e.target.value)] ?? DEFAULT_RADIUS
    radiusRef.current = r
    setRadius(r)
    mapRef.current?.fitRadius(null, r)
  }

  // ── Use my location ───────────────────────────────────────────────────────
  const pushDebug = ev => setDebugLines(lines => [...lines.slice(-30), ev])

  async function handleLocate() {
    locateAbort.current?.abort()
    cancelEnterSearch()
    const ctrl = new AbortController()
    locateAbort.current = ctrl
    followGps.current = true
    setLocating(true)
    setHelp(null)
    setShowWhy(false)
    say('Finding your location…')
    if (debug) setDebugLines([{ tMs: 0, type: `context ${ctx.kind}${ctx.app ? ` (${ctx.app})` : ''}` }])
    try {
      const fix = await getBestPosition({
        signal: ctrl.signal,
        // Only WebKit keeps a denial for the life of the page; Chrome asks again.
        rememberDenial: ctx.ios,
        onEvent: debug ? pushDebug : undefined,
        onFix: f => {
          setGpsFix(f)
          if (followGps.current && !f.stale) mapRef.current?.setCenter(f)
        },
      })
      setGpsFix({ lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy })
      if (followGps.current) {
        mapRef.current?.setCenter(fix)
        centerRef.current = { lat: fix.lat, lng: fix.lng }
        setTouched(true)
        lookupLabel(centerRef.current, { force: true })
      }
      const acc = formatAccuracy(fix.accuracy)
      let h
      if (fix.approximate) {
        h = { ...locationHelp(ctx, 'approximate', { accuracy: acc }), tone: 'warn' }
      } else if (fix.stale) {
        const mins = Math.max(1, Math.round(fix.ageMs / 60000))
        const ago = mins >= 90 ? `${Math.round(mins / 60)} h` : `${mins} min`
        h = { text: `This is where your phone last knew it was, ${ago} ago. Move the map to where you are.`, tone: 'warn' }
      } else if (accuracyLevel(fix.accuracy, radiusRef.current) !== 'good') {
        h = { ...locationHelp(ctx, 'rough', { accuracy: acc }), tone: 'warn' }
      } else {
        h = { text: `Located to ${acc}.`, tone: 'ok' }
      }
      setHelp(h)
      say(h.text)
    } catch (e) {
      if (e?.kind === 'aborted') return
      const outcome = e?.kind === 'denied' ? (e.earlier ? 'denied-earlier' : 'denied') : (e?.kind || 'unavailable')
      const h = locationHelp(ctx, outcome)
      setHelp({ ...h, tone: 'warn' })
      say(h.text)
    } finally {
      if (locateAbort.current === ctrl) setLocating(false)
    }
  }

  async function handleHelpAction() {
    if (help?.action === 'open-safari') {
      if (!openInSafari(ctx)) { setHelp(h => h && { ...h, action: 'copy-link' }); return }
      // The hand-off fails silently when an app update breaks it. If we are
      // still on screen a moment later, offer the link instead.
      clearTimeout(safariTimer.current)
      safariTimer.current = setTimeout(() => {
        if (document.visibilityState === 'visible') {
          setHelp(h => (h?.action === 'open-safari' ? { ...h, action: 'copy-link' } : h))
        }
      }, 1500)
      return
    }
    if (help?.action === 'copy-link') {
      try {
        await navigator.clipboard.writeText(window.location.href)
        setHelp({ text: `Link copied. Open ${browserName} and paste it into the address bar.`, tone: 'ok' })
      } catch {
        setHelp(h => ({ ...h, text: `${h.text} Copy the address from the menu and open it in ${browserName}.`, action: null }))
      }
    }
  }

  // ── Search ────────────────────────────────────────────────────────────────
  function cancelEnterSearch() {
    if (!enterSearch.current) return
    enterSearch.current.abort()
    enterSearch.current = null
    setSearchStatus(s => (s === 'loading' ? 'idle' : s))
  }

  useEffect(() => {
    if (justPicked.current) { justPicked.current = false; return }
    const q = query.trim()
    if (q.length < 3) {
      resultsFor.current = null
      setResults([])
      setSearchStatus('idle')
      setListOpen(false)
      setActive(-1)
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(() => runSearch(q, ctrl.signal), 300)
    const cancel = () => { clearTimeout(t); ctrl.abort() }
    cancelTyping.current = cancel
    return cancel
    // runSearch reads the latest centre and radius through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  async function runSearch(q, signal) {
    setSearchStatus('loading')
    try {
      const r = await suggest(q, { near: touched ? centerRef.current : null, radius: radiusRef.current, signal })
      if (signal?.aborted) return null
      resultsFor.current = q
      setResults(r.results)
      setSource(r.source)
      setSearchStatus(r.results.length ? 'ok' : 'empty')
      setActive(-1)
      setListOpen(true)
      say(r.results.length
        ? `${r.results.length} place${r.results.length === 1 ? '' : 's'} found.`
        : `No places found for "${q}".`)
      return r.results
    } catch {
      if (signal?.aborted) return null
      resultsFor.current = null
      setResults([])
      setSearchStatus('error')
      setListOpen(true)
      say("Search isn't working right now. Move the map to your area instead.")
      return null
    }
  }

  function pick(r) {
    // Skip the search the new input text would trigger (only if it changes).
    if (r.label !== query) justPicked.current = true
    cancelTyping.current?.()
    cancelEnterSearch()
    resultsFor.current = null
    setQuery(r.label)
    setListOpen(false)
    setResults([])
    setActive(-1)
    setSearchStatus('idle')
    locateAbort.current?.abort()
    followGps.current = false
    clearTimeout(labelTimer.current)
    labelAbort.current?.abort()
    updateLabel({ name: r.label, countryCode: r.countryCode, lat: r.lat, lng: r.lng })
    centerRef.current = { lat: r.lat, lng: r.lng }
    setTouched(true)
    setHelp(null)
    mapRef.current?.setCenter(r)
    // Blur only to put the on-screen keyboard away; keyboard users keep focus.
    if (touchDevice()) inputRef.current?.blur()
    say(`Pin moved to ${r.label}.`)
  }

  async function handleSearchKey(e) {
    if (e.key === 'ArrowDown' && results.length) {
      e.preventDefault()
      setListOpen(true)
      setActive(i => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp' && results.length) {
      e.preventDefault()
      setListOpen(true)
      setActive(i => (i <= 0 ? results.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const q = query.trim()
      if (listOpen && results[active]) { pick(results[active]); return }
      // Only take the first result if it answers what is typed now, not what
      // was typed before the last few letters.
      const fresh = listOpen && searchStatus !== 'loading' && resultsFor.current === q
      if (fresh && results[0]) { pick(results[0]); return }
      if (q.length >= 2) {
        cancelTyping.current?.()
        enterSearch.current?.abort()
        const ctrl = new AbortController()
        enterSearch.current = ctrl
        const found = await runSearch(q, ctrl.signal)
        if (enterSearch.current === ctrl) enterSearch.current = null
        if (!ctrl.signal.aborted && found?.[0]) pick(found[0])
      }
    } else if (e.key === 'Escape' && listOpen) {
      // First Escape closes the list, the next one the sheet. preventDefault
      // stops Chrome and Safari from also clearing a type=search field.
      e.preventDefault()
      e.stopPropagation()
      e.nativeEvent?.stopImmediatePropagation?.()
      setListOpen(false)
      setActive(-1)
    }
  }

  function clearSearch() {
    cancelEnterSearch()
    resultsFor.current = null
    setQuery('')
    setResults([])
    setListOpen(false)
    setActive(-1)
    inputRef.current?.focus()
  }

  // ── Confirm ───────────────────────────────────────────────────────────────
  async function handleConfirm() {
    if (!touched || confirming) return
    const c = mapRef.current?.getCenter() || centerRef.current
    const r = radiusRef.current
    let l = labelRef.current
    if (!l || distanceM(l, c) > Math.max(250, 0.25 * r)) {
      setConfirming(true)
      clearTimeout(labelTimer.current)
      const ctrl = new AbortController()
      confirmAbort.current = ctrl
      let timedOut = false
      const t = setTimeout(() => { timedOut = true; ctrl.abort() }, 2500)
      try {
        const found = await reverse(c.lat, c.lng, { signal: ctrl.signal })
        if (found) l = { ...found, lat: c.lat, lng: c.lng }
      } catch { /* fall back below */ }
      clearTimeout(t)
      // Closed while we were naming the spot: nothing to confirm any more.
      if (ctrl.signal.aborted && !timedOut) return
      setConfirming(false)
    }
    const d = l ? distanceM(l, c) : Infinity
    const area = {
      lat: c.lat,
      lng: c.lng,
      radius: r,
      locationName: (d <= r && l?.name) || 'Selected area',
      countryCode: (d <= 50000 && l?.countryCode) || null,
    }
    saveLastArea(area)
    onConfirm(area)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const showLabel = Boolean(label) && distanceM(label, center) <= Math.max(250, 0.25 * radius)
  const placeLine = !touched
    ? 'Search, use your location, or move the map.'
    : showLabel ? label.name : (labelBusy ? 'Finding the area name…' : 'Pinned area')
  const credit = source ? searchCredit(source) : null
  const activeId = listOpen && active >= 0 ? `${listId}-opt-${active}` : undefined

  return createPortal(
    <div
      ref={sheetRef}
      className="loc-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <header className="loc-head">
        <h2 id={titleId} className="loc-title">Choose an area</h2>
        <button type="button" className="loc-close" aria-label="Close" onClick={onCancel}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <div className="loc-search">
        <svg className="loc-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" />
        </svg>
        <input
          ref={inputRef}
          id={`${listId}-input`}
          className="loc-search-input"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          placeholder="Search a street, area or city"
          aria-label="Search a street, area or city"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={listOpen}
          aria-controls={listId}
          aria-activedescendant={activeId}
          value={query}
          onChange={e => { cancelEnterSearch(); setQuery(e.target.value) }}
          onKeyDown={handleSearchKey}
          onFocus={() => { if (results.length) setListOpen(true) }}
        />
        {searchStatus === 'loading' && <span className="loc-search-spinner" aria-hidden="true" />}
        {query && searchStatus !== 'loading' && (
          <button type="button" className="loc-search-clear" aria-label="Clear search" onClick={clearSearch}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
              <path d="M7 7l10 10M17 7L7 17" />
            </svg>
          </button>
        )}

        {listOpen && (
          <div className="loc-results" ref={resultsRef}>
            <ul id={listId} role="listbox" aria-label="Places">
              {results.map((r, i) => (
                <li
                  key={r.id + i}
                  id={`${listId}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={`loc-result${i === active ? ' is-active' : ''}`}
                  // mousedown, not click: keeps focus in the input on desktop.
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => pick(r)}
                >
                  <span className="loc-result-name">{r.name}</span>
                  {r.detail && <span className="loc-result-detail">{r.detail}</span>}
                </li>
              ))}
            </ul>
            {searchStatus === 'empty' && (
              <p className="loc-results-note">No places found for "{query.trim()}". Try a street or city name.</p>
            )}
            {searchStatus === 'error' && (
              <p className="loc-results-note">Search isn't working right now. Move the map to your area instead.</p>
            )}
            {credit && searchStatus === 'ok' && (
              <a className="loc-results-credit" href={credit.href} target="_blank" rel="noopener noreferrer">
                {source === 'mapy' && (
                  <img className="loc-results-logo" src="https://api.mapy.com/img/api/logo.svg" height="14" alt="Mapy.com" />
                )}
                {credit.text}
              </a>
            )}
          </div>
        )}
      </div>

      <PickerMap
        ref={mapRef}
        center={centerRef.current}
        radius={radius}
        gpsFix={gpsFix}
        onMoveStart={handleMoveStart}
        onMoveEnd={handleMoveEnd}
        onReady={() => setMapStatus('ready')}
        onError={() => setMapStatus('error')}
      >
        {mapStatus === 'loading' && <div className="loc-map-skeleton skeleton" aria-hidden="true" />}
        {mapStatus === 'error' && (
          <p className="loc-map-error">The map didn't load. You can still search for a place.</p>
        )}
        {(!touched || locating) && (
          <span className="loc-chip" aria-hidden="true">
            {locating ? 'Finding you…' : 'Move the map to place the pin'}
          </span>
        )}
        <button
          type="button"
          className={`loc-locate${locating ? ' is-busy' : ''}`}
          aria-label="Use my location"
          aria-busy={locating || undefined}
          title="Use my location"
          onClick={handleLocate}
        >
          {locating ? <span className="loc-locate-spinner" aria-hidden="true" /> : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="6.5" /><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
            </svg>
          )}
        </button>
      </PickerMap>

      <div className="loc-panel">
        <div className="loc-range-head">
          <label className="loc-range-label" htmlFor={`${listId}-range`}>Within</label>
          <span className="loc-range-value" aria-hidden="true">{formatRadius(radius)}</span>
        </div>
        <input
          id={`${listId}-range`}
          className="loc-range"
          type="range"
          min="0"
          max={RADIUS_STEPS.length - 1}
          step="1"
          value={stepIndex}
          disabled={confirming}
          aria-valuetext={kmWords(radius)}
          onChange={handleRadius}
          style={{ '--loc-fill': `${(stepIndex / (RADIUS_STEPS.length - 1)) * 100}%` }}
        />
        <div className="loc-ticks" aria-hidden="true">
          {RADIUS_STEPS.map(s => <span key={s} className={s === radius ? 'is-on' : ''}>{s / 1000}</span>)}
        </div>

        {help && (
          <div className={`loc-help loc-help--${help.tone || 'warn'}`}>
            <p>
              {help.text}
              {help.why && (
                <>
                  {' '}
                  <button type="button" className="loc-why" aria-expanded={showWhy} onClick={() => setShowWhy(v => !v)}>
                    {showWhy ? 'Hide' : 'Why?'}
                  </button>
                </>
              )}
            </p>
            {help.why && showWhy && <p className="loc-help-why">{help.why}</p>}
            {help.action && (
              <button type="button" className="loc-help-action" onClick={handleHelpAction}>
                {help.action === 'open-safari' ? 'Open in Safari' : 'Copy link'}
              </button>
            )}
          </div>
        )}

        <p className={`loc-place${touched ? '' : ' is-hint'}`}>
          {touched && (
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 22s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z" fill="currentColor" />
              <circle cx="12" cy="10" r="2.6" fill="var(--bg)" />
            </svg>
          )}
          <span>{placeLine}</span>
        </p>

        <button
          type="button"
          className="btn btn-primary loc-confirm"
          disabled={!touched || confirming}
          onClick={handleConfirm}
        >
          {confirming ? 'Setting area…' : 'Use this area'}
        </button>

        {debug && (
          <pre className="loc-debug" aria-label="Location diagnostics">
            {debugLines.map((l, i) => (
              <div key={i}>
                +{l.tMs}ms {l.type}
                {l.accuracy != null && ` ±${Math.round(l.accuracy)}m`}
                {l.ageMs != null && ` age ${Math.round(l.ageMs / 1000)}s`}
                {l.code != null && ` code ${l.code}`}
                {l.approximate && ' approximate'}
                {l.kind && ` ${l.kind}`}
              </div>
            ))}
          </pre>
        )}
      </div>

      <div className="loc-live" role="status" aria-live="polite">{announce}</div>
    </div>,
    document.body,
  )
}
