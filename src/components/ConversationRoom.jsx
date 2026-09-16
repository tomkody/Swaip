import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import confetti from 'canvas-confetti'
import { prefersReducedMotion } from '../lib/motion'
import { getSubtopicsForTopics } from '../lib/topics'
import {
  getRoomToken,
  submitConversationSelections,
  getConversationMatches,
  subscribeToConversationSelections,
} from '../lib/room'
import SwipeCard from './SwipeCard'
import AppHeader from './AppHeader'
import Icon from './Icon'
import { generateShareImage, downloadCanvas } from '../lib/shareImage'
import { track } from '../lib/analytics'
import { seededShuffle } from '../lib/random'
import './ConversationRoom.css'

const CARDS_PER_SESSION = 15

// Per-room progress survives a reload — the same reason the movie room keeps it:
// a trip to the share sheet reloads the tab on iOS, and starting again from
// card 1 with the likes lost is worse than any of the alternatives.
const progressKey = id => `swaip_conv_progress_${id}`
function loadConvProgress(id) {
  try { return JSON.parse(sessionStorage.getItem(progressKey(id)) || 'null') } catch { return null }
}

// One question is a conversation starter; five per topic across five topics is
// a wall of text nobody reads. Show the first, keep the rest one tap away.
function TopicQuestions({ questions }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? questions : questions.slice(0, 1)
  const hidden = questions.length - shown.length
  return (
    <div className="result-questions">
      <div className="result-questions-label">Deep talk questions</div>
      {shown.map((q, i) => (
        <div key={i} className="result-question">
          <span className="question-num">{i + 1}</span>
          <span>{q}</span>
        </div>
      ))}
      {hidden > 0 && (
        <button type="button" className="result-questions-more" onClick={() => setExpanded(true)}>
          + {hidden} more question{hidden !== 1 ? 's' : ''}
        </button>
      )}
    </div>
  )
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
      eyebrow: sub.topicName ? `${sub.topicEmoji || ''} ${sub.topicName}`.trim() : null,
      poster: null,
      rating: null,
      isOpen: null,
      // Keep reference to questions for results screen
      _questions: sub.questions || [],
      _topicName: sub.topicName,
      _topicEmoji: sub.topicEmoji,
    }))
  }, [allSubtopics, room.id])

  const [saved] = useState(() => loadConvProgress(room.id))
  const [currentIndex, setCurrentIndex] = useState(saved?.index || 0)
  const [likedIds, setLikedIds] = useState(saved?.liked || [])        // IDs of right-swiped cards
  const likedIdsRef = useRef(saved?.liked || [])                      // sync ref — avoids stale closure on last card
  const [submitted, setSubmitted] = useState(Boolean(saved?.submitted))
  const [partnerSubmitted, setPartnerSubmitted] = useState(false)
  const [matches, setMatches] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sharing, setSharing] = useState(false)
  const userToken = useRef(getRoomToken(room.id))
  const historyRef = useRef([])                       // this session's swipes, newest last (undo)
  const [canUndo, setCanUndo] = useState(false)
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

  useEffect(() => {
    try {
      sessionStorage.setItem(progressKey(room.id), JSON.stringify({
        index: currentIndex, liked: likedIds, submitted,
      }))
    } catch { /* storage blocked — progress just won't survive a reload */ }
  }, [room.id, currentIndex, likedIds, submitted])

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
      checkMatches().catch(err => console.error('Failed to read topic matches:', err))
    }
  }, [submitted, partnerSubmitted, matches, checkMatches])

  // Realtime is one event: miss it (phone asleep, tab backgrounded, socket
  // dropped) and the waiting screen never resolves. Poll until it does.
  useEffect(() => {
    if (isSolo || !submitted || matches) return
    const t = setInterval(() => { checkMatches().catch(() => {}) }, 5000)
    return () => clearInterval(t)
  }, [isSolo, submitted, matches, checkMatches])

  // Confetti on match reveal
  useEffect(() => {
    if (matches && matches.length > 0 && !hasConfettied.current) {
      hasConfettied.current = true
      if (prefersReducedMotion()) return
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
    historyRef.current.push({ index: currentIndex, id: card.id, direction })
    setCanUndo(true)
    const nextIndex = currentIndex + 1
    setCurrentIndex(nextIndex)
    if (nextIndex >= cards.length) {
      // All cards swiped — auto-submit
      setTimeout(() => handleSwipeDone(), 400)
    }
  }

  // Nothing is written until the whole set is submitted, so stepping back here
  // is purely local — drop the like again and return to the card.
  function handleUndo() {
    const last = historyRef.current.pop()
    setCanUndo(historyRef.current.length > 0)
    if (!last) return
    if (last.direction === 'right') {
      likedIdsRef.current = likedIdsRef.current.filter(id => id !== last.id)
      setLikedIds(likedIdsRef.current)
    }
    setCurrentIndex(last.index)
  }

  // ── Results screen ──────────────────────────────────────────────────
  if (matches) {
    const matchedCards = cards.filter(c => matches.includes(c.id))

    return (
      <div className="conv-results-page">
        <AppHeader className="conv-results-topbar" />
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
                      <TopicQuestions questions={card._questions} />
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
                <Icon name="image" size={17} />
                {sharing ? 'Generating…' : 'Share'}
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
      <div className="conv-center has-app-header">
        <AppHeader className="center-app-header" />
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
      <div className="conv-center has-app-header">
        <AppHeader className="center-app-header" />
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
      <div className="conv-center has-app-header">
        <AppHeader className="center-app-header" />
        <div className="loader" />
      </div>
    )
  }

  return (
    <div className="conv-swipe-page">
      <AppHeader className="conv-swipe-topbar">
        <span className="conv-swipe-progress">{currentIndex + 1} / {cards.length}</span>
      </AppHeader>
      <div className="conv-swipe-header">
        <p className="conv-swipe-label">{isSolo ? 'Swipe right on topics you want to explore' : 'Swipe right on topics you want to talk about'}</p>
      </div>

      <div className="conv-swipe-area">
        <SwipeCard
          key={currentCard.id}
          item={currentCard}
          onSwipe={handleSwipe}
          onUndo={handleUndo}
          canUndo={canUndo}
          active
        />
      </div>
    </div>
  )
}
