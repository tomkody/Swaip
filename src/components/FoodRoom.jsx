import { useState, useCallback, useRef, useEffect } from 'react'
import confetti from 'canvas-confetti'
import { getUserToken, recordSwipe, subscribeToSwipes, fetchRoomMatches, checkFoodMatches } from '../lib/room'
import { getFoodItems } from '../lib/foodItems'
import { saveMatch } from '../lib/savedMatches'
import { generateShareImage, downloadCanvas } from '../lib/shareImage'
import SwipeCard from './SwipeCard'
import './FoodRoom.css'

export default function FoodRoom({ room, onDone }) {
  const userToken = useRef(getUserToken())
  const items = useRef(getFoodItems(room.id))

  const [currentIndex, setCurrentIndex] = useState(0)
  const [matches, setMatches] = useState([])
  const [matchItem, setMatchItem] = useState(null)
  const [isDone, setIsDone] = useState(false)
  const [doneMatches, setDoneMatches] = useState(null)
  const [sharing, setSharing] = useState(false)
  const swipeCount = useRef(0)
  const isDoneRef = useRef(false)

  useEffect(() => { isDoneRef.current = isDone }, [isDone])

  // Subscribe to partner swipes — same pattern as Room.jsx
  useEffect(() => {
    const unsub = subscribeToSwipes(room.id, userToken.current, (itemId) => {
      const matched = items.current.find(m => m.id === Number(itemId))
      if (matched) {
        setMatches(prev => prev.find(m => m.id === matched.id) ? prev : [...prev, matched])
        setDoneMatches(prev => {
          if (prev === null) return null
          if (prev.find(m => m.id === matched.id)) return prev
          return [...prev, matched]
        })
        if (!isDoneRef.current) {
          setMatchItem(matched)
          saveMatch({ id: matched.id, title: matched.title, category: 'food', image: null })
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } })
        }
      }
    })
    return unsub
  }, [room.id])

  // Poll for new food matches every 12s (both before and after done — partner may finish later)
  useEffect(() => {
    const poll = async () => {
      const matched = await checkFoodMatches(room.id, userToken.current, items.current.map(i => i.id))
      if (matched.length > 0) {
        const matchedItems = items.current.filter(i => matched.includes(i.id))
        setMatches(matchedItems)
        setDoneMatches(prev => {
          if (prev === null) return prev
          return matchedItems
        })
      }
    }
    const interval = setInterval(poll, 12000)
    return () => clearInterval(interval)
  }, [room.id])

  const handleSwipe = useCallback(async (direction) => {
    const item = items.current[currentIndex]
    if (!item) return
    swipeCount.current += 1

    try {
      const isMatch = await recordSwipe(room.id, userToken.current, item.id, direction)
      if (isMatch && direction === 'right') {
        setMatchItem(item)
        setMatches(prev => [...prev, item])
        saveMatch({ id: item.id, title: item.title, category: 'food', image: null })
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } })
      }
    } catch (err) {
      console.error('recordSwipe error:', err)
    }

    setCurrentIndex(i => i + 1)
  }, [currentIndex, room.id])

  function handleDone() {
    // Close modal and go to results immediately — no async blocking
    setMatchItem(null)
    setIsDone(true)
    // Fetch authoritative matches in background and update if better
    checkFoodMatches(room.id, userToken.current, items.current.map(i => i.id))
      .then(matched => {
        if (matched.length > 0) {
          setDoneMatches(items.current.filter(i => matched.includes(i.id)))
        } else {
          // Fallback to whatever real-time matches we already have
          setDoneMatches(prev => prev ?? matches)
        }
      })
      .catch(() => {
        setDoneMatches(prev => prev ?? matches)
      })
  }

  async function handleShare(item) {
    if (sharing) return
    setSharing(true)
    try {
      const canvas = await generateShareImage({ title: item.title, posterUrl: null, emoji: item.emoji, swipeCount: swipeCount.current })
      downloadCanvas(canvas, `swaip-${item.title.replace(/\s+/g, '-').toLowerCase()}.png`)
    } catch (err) { console.error('Share error:', err) }
    finally { setSharing(false) }
  }

  // ── Match modal ────────────────────────────────────────────────
  if (matchItem) {
    return (
      <div className="food-match-overlay">
        <div className="food-match-modal">
          <span className="food-match-emoji-big">🎉</span>
          <h1>It's a Match!</h1>
          <p className="food-match-subtitle">You both picked the same thing</p>

          <div className="food-match-card">
            <div className="food-match-item-emoji">{matchItem.emoji}</div>
            <div className="food-match-item-info">
              <h2>{matchItem.title}</h2>
              <p>{matchItem.overview}</p>
            </div>
          </div>

          <button
            className="food-share-btn"
            onClick={() => handleShare(matchItem)}
            disabled={sharing}
          >
            {sharing ? 'Generating…' : '📸 Share to Stories'}
          </button>

          <div className="food-match-actions">
            {currentIndex < items.current.length ? (
              <button className="btn btn-primary" onClick={() => setMatchItem(null)}>
                Keep Swiping
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleDone}>
                See All Matches
              </button>
            )}
            <button className="btn btn-secondary" onClick={handleDone}>
              Done — See All Matches
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Results ────────────────────────────────────────────────────
  if (isDone || currentIndex >= items.current.length) {
    // Always use the longer list — doneMatches grows as partner keeps swiping
    const results = (doneMatches !== null && doneMatches.length >= matches.length)
      ? doneMatches
      : matches
    const stillLoading = doneMatches === null
    return (
      <div className="food-results">
        <div className="food-results-inner">
          {stillLoading && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>
              Checking for matches…
            </p>
          )}
          {results.length > 0 ? (
            <>
              <div className="food-results-icon">🎊</div>
              <h2 className="food-results-title">Your food matches!</h2>
              <p className="food-results-sub">You both agreed on {results.length} option{results.length !== 1 ? 's' : ''}.</p>
              <div className="food-results-list">
                {results.map(item => (
                  <div key={item.id} className="food-result-item">
                    <span className="food-result-emoji">{item.emoji}</span>
                    <div>
                      <div className="food-result-title">{item.title}</div>
                      <div className="food-result-desc">{item.overview}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="food-results-icon">😅</div>
              <h2 className="food-results-title">No matches yet</h2>
              <p className="food-results-sub">You didn't agree on any cuisine this time. Try again!</p>
            </>
          )}
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 24 }} onClick={onDone}>
            Go home
          </button>
        </div>
      </div>
    )
  }

  // ── Swipe ──────────────────────────────────────────────────────
  const current = items.current[currentIndex]

  return (
    <div className="food-room">
      <div className="food-header">
        <span className="food-phase-label">🍽️ Food & Dining</span>
        <div className="food-header-right">
          {matches.length > 0 && (
            <span className="food-match-count">{matches.length} match{matches.length !== 1 ? 'es' : ''}</span>
          )}
          <span className="food-progress">{currentIndex + 1} / {items.current.length}</span>
        </div>
      </div>

      <div className="food-cards">
        <SwipeCard key={current.id} item={current} onSwipe={handleSwipe} active />
      </div>

      <div className="food-footer">
        <button className="done-early-btn" onClick={handleDone}>
          I'm done swiping{matches.length > 0 ? ` · ${matches.length} match${matches.length !== 1 ? 'es' : ''}` : ''}
        </button>
      </div>
    </div>
  )
}
