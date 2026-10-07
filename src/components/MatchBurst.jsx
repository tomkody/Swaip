import { useEffect, useLayoutEffect, useRef } from 'react'
import { saveMatch } from '../lib/savedMatches'
import { prefersReducedMotion } from '../lib/motion'
import './MatchBurst.css'

// Every match after the first: no dialog to close, just the film itself
// lifting out of the deck, glowing in its own poster colours, throwing a few
// hearts and settling into the match counter. The first match keeps the full
// MatchModal moment.
const HEARTS = [
  { x: -78, y: -46, r: -18, d: 0 },
  { x: 74, y: -52, r: 16, d: 40 },
  { x: -96, y: 8, r: -28, d: 80 },
  { x: 98, y: 4, r: 24, d: 60 },
  { x: -40, y: -78, r: -8, d: 120 },
  { x: 44, y: -80, r: 10, d: 100 },
]
const DURATION_MS = 2600

export default function MatchBurst({ item, roomType = 'movies', onDone }) {
  const flightRef = useRef(null)

  // Aim the exit at the match counter wherever the header puts it. offset*
  // ignore the running transform, so this is the chip's resting centre.
  useLayoutEffect(() => {
    const f = flightRef.current
    const target = document.querySelector('.room-matches')
    if (!f || !target) return
    const r = target.getBoundingClientRect()
    f.style.setProperty('--tx', `${Math.round(r.left + r.width / 2 - (f.offsetLeft + f.offsetWidth / 2))}px`)
    f.style.setProperty('--ty', `${Math.round(r.top + r.height / 2 - (f.offsetTop + f.offsetHeight / 2))}px`)
  }, [])

  useEffect(() => {
    // The history entry the modal used to write.
    saveMatch({
      id: item.id,
      title: item.title,
      category: roomType,
      image: item.poster || null,
      year: item.year || null,
      rating: item.rating || null,
    })
    const t = setTimeout(onDone, prefersReducedMotion() ? 2200 : DURATION_MS)
    return () => clearTimeout(t)
    // One burst per item; the parent remounts it (key) for the next match.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  return (
    // Decorative: the room announces the match through its own live region.
    <div className="mb-layer" aria-hidden="true">
      <div className="mb-flight" ref={flightRef}>
        {item.poster && (
          <span className="mb-glow" style={{ backgroundImage: `url("${item.poster}")` }} aria-hidden="true" />
        )}
        <div className="mb-chip">
          <span className="mb-poster" aria-hidden="true">
            {item.poster
              ? <img src={item.poster} alt="" width="46" height="69" />
              : <span className="mb-poster-blank">🎬</span>}
            <span className="mb-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </span>
          </span>
          <span className="mb-text">
            <span className="mb-kicker">It’s a match</span>
            <span className="mb-title">{item.title}</span>
          </span>
        </div>
        <span className="mb-hearts" aria-hidden="true">
          {HEARTS.map((h, i) => (
            <span
              key={i}
              className="mb-heart"
              style={{ '--x': `${h.x}px`, '--y': `${h.y}px`, '--r': `${h.r}deg`, '--d': `${h.d}ms` }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </span>
          ))}
        </span>
      </div>
    </div>
  )
}
