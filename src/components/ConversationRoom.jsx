import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import confetti from 'canvas-confetti'
import { getSubtopicsForTopics } from '../lib/topics'
import {
  getUserToken,
  submitConversationSelections,
  getConversationMatches,
  subscribeToConversationSelections,
} from '../lib/room'
import SwipeCard from './SwipeCard'
import HomeLogo from './HomeLogo'
import { generateShareImage, downloadCanvas } from '../lib/shareImage'
import { track } from '../lib/analytics'
import './ConversationRoom.css'

const CARDS_PER_SESSION = 15

// Seeded shuffle so both users see the same card order in the same room
function seededShuffle(arr, seed) {
  const a = [...arr]
  let h = 0x9E3779B9
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 0x9E3779B9)
    h ^= h >>> 15
  }
  let t = (h >>> 0) + 0x6D2B79F5
  function rng() {
    t = (t + 0x6D2B79F5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function ConversationRoom({ room, onDone, isSolo = false }) {
  let rawTopic
  try { rawTopic = JSON.parse(room.topic_id) } catch { rawTopic = [] }
  const topicIds = Array.isArray(rawTopic) ? rawTopic : (rawTopic?.topicIds || [])
  const allSubtopics = getSubtopicsForTopics(topicIds)

  // Pick 15 cards, seeded by roomId so both partners see identical ordering
  const cards = useMemo(() => {
    const shuffled = seededShuffle(allSubtopics, room.id)
    return shuffled.slice(0, CARDS_PER_SESSION).map(sub => ({
      id: sub.id,
      title: sub.name,
      overview: sub.desc,
      emoji: sub.emoji,
      poster: null,
      rating: null,
      isOpen: null,
      // Keep reference to questions for results screen
      _questions: sub.questions || [],
      _topicName: sub.topicName,
      _topicEmoji: sub.topicEmoji,
    }))
  }, [allSubtopics, room.id])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [likedIds, setLikedIds] = useState([])        // IDs of right-swiped cards
  const likedIdsRef = useRef([])                      // sync ref — avoids stale closure on last card
  const [submitted, setSubmitted] = useState(false)
  const [partnerSubmitted, setPartnerSubmitted] = useState(false)
  const [matches, setMatches] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sharing, setSharing] = useState(false)
  const userToken = useRef(getUserToken())
  const hasConfettied = useRef(false)

  async function handleShare() {
    if (sharing || !matches) return
    setSharing(true)
    track('results_shared', { type: 'conversations', matches: matches.length, solo: isSolo })
    try {
      const items = cards
        .filter(c => matches.includes(c.id))
        .map(c => ({ emoji: c.emoji, name: c.title, question: c._questions?.[0] || '' }))
      const canvas = await generateShareImage({ mode: 'conversation', items, solo: isSolo })
      if (navigator.share && navigator.canShare) {
        try {
          const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
          const file = new File([blob], 'swaip-topics.png', { type: 'image/png' })
          if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Swaip Topics' }); return }
        } catch (e) { if (e.name === 'AbortError') return }
      }
      downloadCanvas(canvas, 'swaip-topics.png')
    } catch (e) { console.error('Share error:', e) }
    finally { setSharing(false) }
  }

  // Subscribe to partner's selections (together mode only)
  useEffect(() => {
    if (isSolo) return
    const unsub = subscribeToConversationSelections(
      room.id,
      userToken.current,
      () => setPartnerSubmitted(true)
    )
    return unsub
  }, [isSolo, room.id])

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

  async function handleSwipeDone() {
    if (submitted) return
    setLoading(true)
    try {
      await submitConversationSelections(room.id, userToken.current, likedIdsRef.current)
      setSubmitted(true)
      if (isSolo) {
        // Solo: own picks are the result
        setMatches(likedIdsRef.current)
        return
      }
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

  function handleSwipe(direction) {
    const card = cards[currentIndex]
    if (!card) return
    if (direction === 'right') {
      likedIdsRef.current = [...likedIdsRef.current, card.id]
      setLikedIds(likedIdsRef.current)
    }
    const nextIndex = currentIndex + 1
    setCurrentIndex(nextIndex)
    if (nextIndex >= cards.length) {
      // All cards swiped — auto-submit
      setTimeout(() => handleSwipeDone(), 400)
    }
  }

  // ── Results screen ──────────────────────────────────────────────────
  if (matches) {
    const matchedCards = cards.filter(c => matches.includes(c.id))

    return (
      <div className="conv-results-page">
        <div className="conv-results-topbar"><HomeLogo /></div>
        <div className="conv-results">
          {matchedCards.length > 0 ? (
            <>
              <div className="results-emoji">{isSolo ? '✨' : '🎉'}</div>
              <h2 className="results-title">{isSolo ? 'Your topics' : 'You both matched!'}</h2>
              <p className="results-subtitle">
                {isSolo
                  ? `${matchedCards.length} topic${matchedCards.length !== 1 ? 's' : ''} you want to explore`
                  : `${matchedCards.length} topic${matchedCards.length !== 1 ? 's' : ''} you both want to talk about`}
              </p>

              <div className="results-section">
                {matchedCards.map(card => (
                  <div key={card.id} className="result-subtopic-block">
                    <div className="result-chip matched">
                      {card.emoji} {card.title}
                    </div>
                    {card._questions && card._questions.length > 0 && (
                      <div className="result-questions">
                        <div className="result-questions-label">Deep talk questions</div>
                        {card._questions.map((q, i) => (
                          <div key={i} className="result-question">
                            <span className="question-num">{i + 1}</span>
                            <span>{q}</span>
                          </div>
                        ))}
                      </div>
                    )}
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

          <div className="conv-results-actions">
            {matchedCards.length > 0 && (
              <button className="btn conv-share-btn" onClick={handleShare} disabled={sharing}>
                {sharing ? '⏳ Generating…' : '📸 Share'}
              </button>
            )}
            <button className="btn btn-primary results-btn" onClick={onDone}>
              New Room
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Waiting for partner ─────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="conv-center">
        <div className="conv-waiting">
          <div className="waiting-icon">⏳</div>
          <h2>All done!</h2>
          <p className="waiting-text">
            You liked {likedIds.length} topic{likedIds.length !== 1 ? 's' : ''}. Waiting for your partner…
          </p>
          <div className="loader" />
        </div>
      </div>
    )
  }

  // ── Loading (auto-submit in progress) ──────────────────────────────
  if (loading) {
    return (
      <div className="conv-center">
        <div className="conv-waiting">
          <div className="loader" />
          <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>Submitting…</p>
        </div>
      </div>
    )
  }

  // ── Swipe UI ────────────────────────────────────────────────────────
  const currentCard = cards[currentIndex]
  const done = currentIndex >= cards.length

  if (done) {
    // Shouldn't normally show — handleSwipe triggers submit — but just in case
    return (
      <div className="conv-center">
        <div className="loader" />
      </div>
    )
  }

  return (
    <div className="conv-swipe-page">
      <div className="conv-swipe-topbar">
        <HomeLogo />
        <span className="conv-swipe-progress">{currentIndex + 1} / {cards.length}</span>
      </div>
      <div className="conv-swipe-header">
        <p className="conv-swipe-label">{isSolo ? 'Swipe right on topics you want to explore' : 'Swipe right on topics you want to talk about'}</p>
      </div>

      <div className="conv-swipe-area">
        <SwipeCard
          key={currentCard.id}
          item={currentCard}
          onSwipe={handleSwipe}
          active
        />
      </div>
    </div>
  )
}
