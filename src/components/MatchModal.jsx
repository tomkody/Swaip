import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'
import './MatchModal.css'

export default function MatchModal({ item, onContinue, onDone }) {
  const hasConfettied = useRef(false)

  useEffect(() => {
    if (!hasConfettied.current) {
      hasConfettied.current = true
      const end = Date.now() + 1500
      const colors = ['#ff6b6b', '#ee5a24', '#2ecc71', '#f1c40f', '#9b59b6']

      function frame() {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors,
        })
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors,
        })
        if (Date.now() < end) requestAnimationFrame(frame)
      }
      frame()
    }
  }, [])

  return (
    <div className="match-overlay">
      <div className="match-modal">
        <div className="match-header">
          <span className="match-emoji">🎉</span>
          <h1 className="match-title">It's a Match!</h1>
          <p className="match-subtitle">You both picked the same thing</p>
        </div>

        <div className="match-card">
          {item.poster ? (
            <img src={item.poster} alt={item.title} className="match-poster" />
          ) : (
            <div className="match-poster match-poster-placeholder">🎬</div>
          )}
          <div className="match-info">
            <h2>{item.title}</h2>
            <div className="match-meta">
              {item.year && <span>{item.year}</span>}
              {item.rating && <span>★ {item.rating}</span>}
            </div>
          </div>
        </div>

        <div className="match-actions">
          <button className="btn btn-primary" onClick={onContinue}>
            Keep Swiping
          </button>
          <button className="btn btn-secondary" onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
