import { lazy, Suspense, useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import { DEFAULT_RADIUS, formatRadius } from '../../lib/geo'
import { useDialogFocus } from '../../lib/useDialogFocus'
import './LocationField.css'

// The "Search area" row on the Food and Activities create pages. Tapping it
// opens the map sheet; the map library loads only then (or quietly once the
// page is idle), so the landing bundle doesn't carry Leaflet.
//
// value / onChange: { lat, lng, radius, locationName, countryCode } | null

const loadSheet = () => import('./LocationSheet')

// React.lazy remembers its first answer, including a failure turned into the
// error screen. Build a fresh one after a failure so "Try again" really does.
const makeSheet = () => lazy(() => loadSheet().catch(() => ({ default: SheetLoadError })))
let LocationSheet = makeSheet()

function SheetLoadError({ onCancel }) {
  const ref = useRef(null)
  const msgId = useId()
  useDialogFocus(ref, { onClose: onCancel })
  return (
    <div ref={ref} className="lf-fallback" role="alertdialog" aria-modal="true" aria-labelledby={msgId}>
      <p id={msgId}>The map couldn't load. Check your connection and try again.</p>
      <button type="button" className="btn btn-secondary" onClick={() => { LocationSheet = makeSheet(); onCancel() }}>Try again</button>
      <button type="button" className="lf-fallback-link" onClick={() => window.location.reload()}>Reload the page</button>
    </div>
  )
}

// Shown while the map chunk loads. No focus move here: the sheet takes focus
// when it mounts, and the button that opened it has to stay the one it returns to.
function SheetLoading({ onCancel }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])
  return (
    <div className="lf-fallback" role="status">
      <span className="lf-spinner" aria-hidden="true" />
      <span>Loading map…</span>
      <button type="button" className="btn btn-secondary" onClick={onCancel}>Close</button>
    </div>
  )
}

export default function LocationField({ ref, value, onChange, labelId, invalid = false, defaultRadius = DEFAULT_RADIUS }) {
  const [open, setOpen] = useState(false)
  const textId = useId()

  useImperativeHandle(ref, () => ({ open: () => setOpen(true) }), [])

  useEffect(() => {
    const idle = window.requestIdleCallback || (fn => setTimeout(fn, 1500))
    const cancel = window.cancelIdleCallback || clearTimeout
    const id = idle(() => { loadSheet().catch(() => {}) })
    return () => cancel(id)
  }, [])

  const close = () => setOpen(false)

  return (
    <>
      <button
        type="button"
        className={`lf-row${invalid ? ' is-invalid' : ''}${value ? ' is-set' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={[labelId, `${textId}-title`, `${textId}-sub`].filter(Boolean).join(' ')}
        aria-invalid={invalid || undefined}
        onPointerDown={() => { loadSheet().catch(() => {}) }}
        onClick={() => setOpen(true)}
      >
        <span className="lf-thumb" aria-hidden="true">
          <svg width="56" height="56" viewBox="0 0 56 56">
            <rect width="56" height="56" rx="12" className="lf-thumb-bg" />
            <path d="M-4 38 C 12 30, 22 44, 36 34 S 52 22, 62 26" className="lf-thumb-road" />
            <path d="M18 -4 C 22 14, 14 30, 24 60" className="lf-thumb-road" />
            <circle cx="28" cy="30" r="17" className="lf-thumb-circle" />
            <path d="M28 31c-.6-2.5-2.4-4.8-4.5-7.1-2.4-2.5-4.4-4.8-4.4-8.2A8.9 8.9 0 0128 7a8.9 8.9 0 018.9 8.7c0 3.4-2 5.7-4.4 8.2-2.1 2.3-3.9 4.6-4.5 7.1z" className="lf-thumb-pin" />
            <circle cx="28" cy="15.8" r="3" fill="#fff" />
          </svg>
        </span>
        <span className="lf-text">
          <span className="lf-title" id={`${textId}-title`}>{value?.locationName || 'Choose an area'}</span>
          <span className="lf-sub" id={`${textId}-sub`}>
            {value ? `Within ${formatRadius(value.radius)}` : invalid ? 'Choose an area to continue' : 'Search, or use your location'}
          </span>
        </span>
        <svg className="lf-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </button>

      {open && (
        <Suspense fallback={<SheetLoading onCancel={close} />}>
          <LocationSheet
            initialArea={value}
            defaultRadius={defaultRadius}
            onConfirm={area => { onChange(area); close() }}
            onCancel={close}
          />
        </Suspense>
      )}
    </>
  )
}
