import { useState, useEffect, useRef, useCallback } from 'react'
import confetti from 'canvas-confetti'
import { getSubtopicsForTopics } from '../lib/topics'
import {
  getUserToken,
  submitConversationSelections,
  getConversationMatches,
  subscribeToConversationSelections,
} from '../lib/room'
import './ConversationRoom.css'

export default function ConversationRoom({ room, onDone }) {
  const topicIds = JSON.parse(room.topic_id)
  const allSubtopics = getSubtopicsForTopics(topicIds)

  const [selected, setSelected] = useState(new Set())
  const [submitted, setSubmitted] = useState(false)
  const [partnerSubmitted, setPartnerSubmitted] = useState(false)
  const [matches, setMatches] = useState(null)
  const [myPicks, setMyPicks] = useState([])
  const [showMyPicks, setShowMyPicks] = useState(false)
  const [loading, setLoading] = useState(false)
  const userToken = useRef(getUserToken())
  const hasConfettied = useRef(false)

  // Subscribe to partner's selections
  useEffect(() => {
    const unsub = subscribeToConversationSelections(
      room.id,
      userToken.current,
      () => setPartnerSubmitted(true)
    )
    return unsub
  }, [room.id])

  // Check for matches when both have submitted
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

  // Confetti on match reveal
  useEffect(() => {
    if (matches && matches.length > 0 && !hasConfettied.current) {
      hasConfettied.current = true
      const end = Date.now() + 1500
      const colors = ['#ff6b6b', '#ee5a24', '#2ecc71', '#f1c40f', '#9b59b6']
      function frame() {
        confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors })
        confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors })
        if (Date.now() < end) requestAnimationFrame(frame)
      }
      frame()
    }
  }, [matches])

  function toggleSubtopic(id) {
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
    const matchedSubs = allSubtopics.filter((s) => matches.includes(s.id))
    const myPickSubs = allSubtopics.filter((s) => myPicks.includes(s.id))
    const myNonMatchPicks = myPickSubs.filter((s) => !matches.includes(s.id))

    // Group matched by topic
    const groupByTopic = (subs) => {
      const groups = {}
      for (const s of subs) {
        if (!groups[s.topicName]) groups[s.topicName] = { emoji: s.topicEmoji, items: [] }
        groups[s.topicName].items.push(s)
      }
      return groups
    }

    return (
      <div className="conv-results-page">
        <div className="conv-results">
          {matchedSubs.length > 0 ? (
            <>
              <div className="results-emoji">🎉</div>
              <h2 className="results-title">It's a Match!</h2>
              <p className="results-subtitle">
                You both want to talk about {matchedSubs.length} topic{matchedSubs.length !== 1 ? 's' : ''}
              </p>
              <div className="results-section">
                {Object.entries(groupByTopic(matchedSubs)).map(([topic, { emoji, items }]) => (
                  <div key={topic} className="result-group">
                    <div className="result-group-header">{emoji} {topic}</div>
                    <div className="result-chips">
                      {items.map((s) => (
                        <div key={s.id} className="result-chip matched">
                          {s.emoji} {s.name}
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
                You didn't pick any of the same topics this time
              </p>
            </>
          )}

          {/* Reveal your picks toggle */}
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
                Share your screen to show your partner what you'd also love to talk about
              </p>
              {showMyPicks && (
                <div className="results-section my-picks">
                  {Object.entries(groupByTopic(myNonMatchPicks)).map(([topic, { emoji, items }]) => (
                    <div key={topic} className="result-group">
                      <div className="result-group-header">{emoji} {topic}</div>
                      <div className="result-chips">
                        {items.map((s) => (
                          <div key={s.id} className="result-chip my-pick">
                            {s.emoji} {s.name}
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

  // Waiting for partner after submitting
  if (submitted) {
    return (
      <div className="conv-center">
        <div className="conv-waiting">
          <div className="waiting-icon">⏳</div>
          <h2>Selections submitted!</h2>
          <p className="waiting-text">
            You picked {myPicks.length} topic{myPicks.length !== 1 ? 's' : ''}. Waiting for your partner...
          </p>
          <div className="loader" />
        </div>
      </div>
    )
  }

  // Subtopic selection — grouped by topic
  const grouped = {}
  for (const s of allSubtopics) {
    if (!grouped[s.topicId]) grouped[s.topicId] = { name: s.topicName, emoji: s.topicEmoji, items: [] }
    grouped[s.topicId].items.push(s)
  }

  return (
    <div className="conv-select">
      <div className="conv-header">
        <span className="conv-topic">Pick what interests you</span>
        {selected.size > 0 && (
          <span className="conv-count">{selected.size} selected</span>
        )}
      </div>

      {Object.entries(grouped).map(([topicId, { name, emoji, items }]) => (
        <div key={topicId} className="subtopic-section">
          <h3 className="subtopic-section-title">{emoji} {name}</h3>
          <div className="subtopic-grid">
            {items.map((sub) => (
              <button
                key={sub.id}
                className={`subtopic-chip ${selected.has(sub.id) ? 'selected' : ''}`}
                onClick={() => toggleSubtopic(sub.id)}
                title={sub.desc}
              >
                {selected.has(sub.id) && <span className="check">✓</span>}
                <span className="chip-emoji">{sub.emoji}</span>
                <span className="chip-name">{sub.name}</span>
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
