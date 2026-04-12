import { useState, useEffect, useRef, useCallback } from 'react'
import confetti from 'canvas-confetti'
import { ACTIVITIES, getActivitiesByCategory } from '../lib/activities'
import {
  getUserToken,
  submitConversationSelections,
  getConversationMatches,
  subscribeToConversationSelections,
} from '../lib/room'
import './ConversationRoom.css'

export default function ActivityRoom({ room, onDone }) {
  const grouped = getActivitiesByCategory()

  const [selected, setSelected] = useState(new Set())
  const [submitted, setSubmitted] = useState(false)
  const [partnerSubmitted, setPartnerSubmitted] = useState(false)
  const [matches, setMatches] = useState(null)
  const [myPicks, setMyPicks] = useState([])
  const [showMyPicks, setShowMyPicks] = useState(false)
  const [loading, setLoading] = useState(false)
  const userToken = useRef(getUserToken())
  const hasConfettied = useRef(false)

  useEffect(() => {
    const unsub = subscribeToConversationSelections(
      room.id,
      userToken.current,
      () => setPartnerSubmitted(true)
    )
    return unsub
  }, [room.id])

  const checkMatches = useCallback(async () => {
    const result = await getConversationMatches(room.id, userToken.current)
    if (result.partnerSubmitted) {
      setPartnerSubmitted(true)
      setMatches(result.matches)
    }
  }, [room.id])

  useEffect(() => {
    if (submitted && partnerSubmitted && !matches) {
      checkMatches()
    }
  }, [submitted, partnerSubmitted, matches, checkMatches])

  useEffect(() => {
    if (matches && matches.length > 0 && !hasConfettied.current) {
      hasConfettied.current = true
      const end = Date.now() + 1500
      const colors = ['#00B894', '#55efc4', '#FF5C6A', '#FFC84E', '#6C5CE7']
      function frame() {
        confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors })
        confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors })
        if (Date.now() < end) requestAnimationFrame(frame)
      }
      frame()
    }
  }, [matches])

  function toggleActivity(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit() {
    if (selected.size === 0) return
    setLoading(true)
    const picks = [...selected]
    setMyPicks(picks)
    try {
      await submitConversationSelections(room.id, userToken.current, picks)
      setSubmitted(true)
      const result = await getConversationMatches(room.id, userToken.current)
      if (result.partnerSubmitted) {
        setPartnerSubmitted(true)
        setMatches(result.matches)
      }
    } catch (err) {
      console.error('Failed to submit selections:', err)
    } finally {
      setLoading(false)
    }
  }

  // Results screen
  if (matches) {
    const matchedActs = ACTIVITIES.filter((a) => matches.includes(a.id))
    const myPickActs = ACTIVITIES.filter((a) => myPicks.includes(a.id))
    const myNonMatchPicks = myPickActs.filter((a) => !matches.includes(a.id))

    const groupByCategory = (acts) => {
      const groups = {}
      for (const a of acts) {
        if (!groups[a.category]) groups[a.category] = []
        groups[a.category].push(a)
      }
      return groups
    }

    return (
      <div className="conv-results-page">
        <div className="conv-results">
          {matchedActs.length > 0 ? (
            <>
              <div className="results-emoji">🎉</div>
              <h2 className="results-title">It's a Match!</h2>
              <p className="results-subtitle">
                You both want to do {matchedActs.length} activit{matchedActs.length !== 1 ? 'ies' : 'y'}
              </p>
              <div className="results-section">
                {Object.entries(groupByCategory(matchedActs)).map(([cat, items]) => (
                  <div key={cat} className="result-group">
                    <div className="result-group-header">{cat}</div>
                    <div className="result-chips">
                      {items.map((a) => (
                        <div key={a.id} className="result-chip matched">
                          {a.emoji} {a.name}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="results-emoji">😅</div>
              <h2 className="results-title">No matches</h2>
              <p className="results-subtitle">
                You didn't pick any of the same activities this time
              </p>
            </>
          )}

          {myNonMatchPicks.length > 0 && (
            <div className="reveal-section">
              <button
                className="reveal-toggle"
                onClick={() => setShowMyPicks(!showMyPicks)}
              >
                {showMyPicks ? 'Hide' : 'Show'} what else I picked ({myNonMatchPicks.length})
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  className={`reveal-arrow ${showMyPicks ? 'open' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <p className="reveal-hint">
                Share your screen to show your partner what you'd also love to do
              </p>
              {showMyPicks && (
                <div className="results-section my-picks">
                  {Object.entries(groupByCategory(myNonMatchPicks)).map(([cat, items]) => (
                    <div key={cat} className="result-group">
                      <div className="result-group-header">{cat}</div>
                      <div className="result-chips">
                        {items.map((a) => (
                          <div key={a.id} className="result-chip my-pick">
                            {a.emoji} {a.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button className="btn btn-primary results-btn" onClick={onDone}>
            New Room
          </button>
        </div>
      </div>
    )
  }

  // Waiting for partner
  if (submitted) {
    return (
      <div className="conv-center">
        <div className="conv-waiting">
          <div className="waiting-icon">⏳</div>
          <h2>Selections submitted!</h2>
          <p className="waiting-text">
            You picked {myPicks.length} activit{myPicks.length !== 1 ? 'ies' : 'y'}. Waiting for your partner...
          </p>
          <div className="loader" />
        </div>
      </div>
    )
  }

  // Activity selection — grouped by category
  return (
    <div className="conv-select">
      <div className="conv-header">
        <span className="conv-topic">Pick what you'd enjoy</span>
        {selected.size > 0 && (
          <span className="conv-count">{selected.size} selected</span>
        )}
      </div>

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="subtopic-section">
          <h3 className="subtopic-section-title">{category}</h3>
          <div className="subtopic-grid">
            {items.map((act) => (
              <button
                key={act.id}
                className={`subtopic-chip ${selected.has(act.id) ? 'selected' : ''}`}
                onClick={() => toggleActivity(act.id)}
                title={act.description}
              >
                {selected.has(act.id) && <span className="check">✓</span>}
                <span className="chip-emoji">{act.emoji}</span>
                <span className="chip-name">{act.name}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="submit-bar">
        <button
          className="btn btn-primary submit-btn"
          disabled={selected.size === 0 || loading}
          onClick={handleSubmit}
        >
          {loading ? 'Submitting...' : `Submit${selected.size > 0 ? ` (${selected.size})` : ''}`}
        </button>
      </div>
    </div>
  )
}
