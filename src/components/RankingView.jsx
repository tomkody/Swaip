import { useState, useEffect, useRef, useCallback } from 'react'
import { getUserToken, submitRankings, getRankings, subscribeToRankings, fetchRoomMatches, subscribeToSwipes } from '../lib/room'
import { generateShareImage, downloadCanvas } from '../lib/shareImage'
import './RankingView.css'

export default function RankingView({ matches: initialMatches, room, movies = [], onDone }) {
  const userToken = useRef(getUserToken())
  const [matches, setMatches] = useState(initialMatches)
  const [top3, setTop3] = useState([])
  const [phase, setPhase] = useState('rank') // 'rank' | 'results'
  const [partnerRanks, setPartnerRanks] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [sharing, setSharing] = useState(false)
  const dragFrom = useRef(null)

  // Check if partner already submitted + subscribe — results update in background
  const checkPartner = useCallback(async () => {
    const { partnerRanking, partnerSubmitted } = await getRankings(room.id, userToken.current)
    if (partnerSubmitted) setPartnerRanks(partnerRanking)
  }, [room.id])

  useEffect(() => {
    checkPartner()
    const unsub = subscribeToRankings(room.id, userToken.current, () => checkPartner())
    return unsub
  }, [room.id, checkPartner])

  // Keep polling for partner rankings every 15s while in results (they may still be picking)
  useEffect(() => {
    if (phase !== 'results') return
    const interval = setInterval(checkPartner, 15000)
    return () => clearInterval(interval)
  }, [phase, checkPartner])

  // Real-time match updates — fires even after we're in results
  useEffect(() => {
    const unsub = subscribeToSwipes(room.id, userToken.current, (itemId) => {
      const numId = Number(itemId)
      const matched = movies.find(m => m.id === numId || m.id === itemId)
      if (matched) {
        setMatches(prev => prev.find(m => m.id === matched.id) ? prev : [...prev, matched])
      }
    })
    return unsub
  }, [room.id, movies])

  // Poll for new matches every 12s
  useEffect(() => {
    const poll = async () => {
      const ids = await fetchRoomMatches(room.id, userToken.current)
      if (ids !== null && ids.length > 0 && movies.length > 0) {
        const fresh = movies.filter(m => ids.includes(m.id))
        if (fresh.length > 0) setMatches(fresh)
      }
    }
    poll()
    const interval = setInterval(poll, 12000)
    return () => clearInterval(interval)
  }, [room.id, movies])

  function toggleItem(item) {
    setTop3(prev => {
      const idx = prev.findIndex(m => m.id === item.id)
      if (idx !== -1) return prev.filter(m => m.id !== item.id)
      if (prev.length >= 3) return prev
      return [...prev, item]
    })
  }

  async function handleSubmit() {
    setSubmitting(true)
    // Always show results regardless of DB success
    setPhase('results')
    try {
      await submitRankings(room.id, userToken.current, top3.map(m => m.id))
    } catch (e) {
      console.error('Failed to save rankings:', e)
    } finally {
      setSubmitting(false)
    }
  }

  // Drag-to-reorder within top 3
  function onDragStart(e, idx) {
    dragFrom.current = idx
    e.dataTransfer.effectAllowed = 'move'
  }
  function onDragOver(e) { e.preventDefault() }
  function onDrop(e, idx) {
    e.preventDefault()
    const from = dragFrom.current
    if (from === null || from === idx) return
    setTop3(prev => {
      const arr = [...prev]
      const [item] = arr.splice(from, 1)
      arr.splice(idx, 0, item)
      return arr
    })
    dragFrom.current = null
  }

  async function handleShare() {
    if (sharing) return
    setSharing(true)
    try {
      const typeLabel = room.type === 'series' ? 'shows' : room.type === 'activities' ? 'activities' : 'movies'
      const canvas = await generateShareImage({
        title: matches.length === 1 ? matches[0].title : `${matches.length} ${typeLabel}`,
        posterUrl: matches.length === 1 ? (matches[0].poster || null) : null,
        items: matches.slice(0, 3),
        swipeCount: matches.length,
        mode: 'matches',
        typeLabel,
      })
      downloadCanvas(canvas, `swaip-matches.png`)
    } catch (err) { console.error('Share error:', err) }
    finally { setSharing(false) }
  }

  const emoji = room.type === 'series' ? '📺' : room.type === 'activities' ? '🎯' : '🎬'
  const typeLabel = room.type === 'series' ? 'shows' : room.type === 'activities' ? 'activities' : 'movies'

  // ── RESULTS ──────────────────────────────────────────────────────
  if (phase === 'results') {
    const hasMyPicks = top3.length > 0
    const rest = matches.filter(m => !top3.some(t => t.id === m.id))

    return (
      <div className="rv-page">
        {/* Hero */}
        <div className="rv-results-hero">
          <div className="rv-icon">{matches.length > 0 ? '🎉' : '😅'}</div>
          <h2>{matches.length > 0
            ? `You matched on ${matches.length} ${typeLabel}!`
            : `No matches this time`
          }</h2>
          <p className="rv-hero-sub">
            {matches.length === 0
              ? 'Try swiping more next time!'
              : hasMyPicks
                ? `We swiped through ${movies.length} ${typeLabel} and ${top3.length === 1 ? 'this is my #1 pick' : `these are my top ${top3.length}`}:`
                : `Here's everything you both want to watch:`}
          </p>
        </div>

        {/* My Top Picks — shown prominently */}
        {hasMyPicks && (
          <div className="rv-match-list">
            <p className="rv-label">🏆 My Top {top3.length}</p>
            {top3.map((m, i) => (
              <div key={m.id} className={`rv-result-card ${i === 0 ? 'rv-result-top' : ''}`}>
                {i === 0 && <div className="rv-top-badge">🏆 #1 Pick</div>}
                <div className="rv-result-card-inner">
                  <span className="rv-pick-num">#{i + 1}</span>
                  {m.poster
                    ? <img src={m.poster} alt={m.title} className="rv-result-poster" />
                    : <div className="rv-result-poster rv-result-poster-empty">{emoji}</div>}
                  <div className="rv-result-info">
                    <strong>{m.title}</strong>
                    <span>{m.year}{m.rating ? ` · ⭐ ${m.rating}` : ''}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Other matches */}
        {rest.length > 0 && (
          <div className="rv-match-list">
            <p className="rv-label">All Matches ({matches.length})</p>
            {rest.map(m => (
              <div key={m.id} className="rv-result-card">
                <div className="rv-result-card-inner">
                  {m.poster
                    ? <img src={m.poster} alt={m.title} className="rv-result-poster" />
                    : <div className="rv-result-poster rv-result-poster-empty">{emoji}</div>}
                  <div className="rv-result-info">
                    <strong>{m.title}</strong>
                    <span>{m.year}{m.rating ? ` · ⭐ ${m.rating}` : ''}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No picks — just show all matches flat */}
        {!hasMyPicks && matches.length > 0 && (
          <div className="rv-match-list">
            {matches.map(m => (
              <div key={m.id} className="rv-result-card">
                <div className="rv-result-card-inner">
                  {m.poster
                    ? <img src={m.poster} alt={m.title} className="rv-result-poster" />
                    : <div className="rv-result-poster rv-result-poster-empty">{emoji}</div>}
                  <div className="rv-result-info">
                    <strong>{m.title}</strong>
                    <span>{m.year}{m.rating ? ` · ⭐ ${m.rating}` : ''}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="rv-results-actions">
          <button
            className="btn rv-share-btn"
            onClick={handleShare}
            disabled={sharing || matches.length === 0}
          >
            {sharing ? '⏳ Generating…' : '📸 Share Results'}
          </button>
          <button className="btn btn-primary rv-submit" onClick={onDone}>
            Start New Room
          </button>
        </div>
      </div>
    )
  }

  // ── RANKING ───────────────────────────────────────────────────────
  const maxPicks = Math.min(matches.length, 3)
  const isInTop3 = id => top3.some(m => m.id === id)
  const rankOf = id => top3.findIndex(m => m.id === id) + 1

  return (
    <div className="rv-page">
      <div className="rv-ranking-header">
        <h2>Pick Your Top {maxPicks > 0 ? maxPicks : ''}</h2>
        <p>{matches.length} match{matches.length !== 1 ? 'es' : ''} · tap to rank · drag to reorder</p>
      </div>

      {/* Top 3 slots */}
      <div className="rv-slots">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className={`rv-slot ${top3[i] ? 'rv-slot-filled' : 'rv-slot-empty'}`}
            onDragOver={onDragOver}
            onDrop={e => onDrop(e, i)}
          >
            <span className="rv-slot-num">#{i + 1}</span>
            {top3[i] ? (
              <div className="rv-slot-content" draggable onDragStart={e => onDragStart(e, i)}>
                {top3[i].poster
                  ? <img src={top3[i].poster} alt={top3[i].title} className="rv-slot-poster" />
                  : <div className="rv-slot-poster rv-slot-poster-empty">{emoji}</div>}
                <p className="rv-slot-title">{top3[i].title}</p>
                <button className="rv-slot-remove" onClick={() => toggleItem(top3[i])}>✕</button>
              </div>
            ) : (
              <div className="rv-slot-placeholder">+</div>
            )}
          </div>
        ))}
      </div>

      {/* All matches */}
      <div className="rv-match-list">
        <p className="rv-label">All Matches ({matches.length})</p>
        {matches.length === 0 && <p className="rv-empty">No matches yet — submit to skip.</p>}
        {matches.map(m => {
          const inTop = isInTop3(m.id)
          const rank = rankOf(m.id)
          const full = top3.length >= 3 && !inTop
          return (
            <button
              key={m.id}
              className={`rv-match-item ${inTop ? 'rv-in-top3' : ''} ${full ? 'rv-full' : ''}`}
              onClick={() => !full && toggleItem(m)}
            >
              {m.poster
                ? <img src={m.poster} alt={m.title} className="rv-match-thumb" />
                : <div className="rv-match-thumb rv-match-thumb-empty">{emoji}</div>}
              <div className="rv-match-info">
                <strong>{m.title}</strong>
                <span>{m.year}{m.rating ? ` · ⭐ ${m.rating}` : ''}</span>
              </div>
              <div className={`rv-badge ${inTop ? 'rv-badge-ranked' : full ? 'rv-badge-full' : 'rv-badge-add'}`}>
                {inTop ? `#${rank}` : full ? '—' : '+'}
              </div>
            </button>
          )
        })}
      </div>

      <div className="rv-footer">
        <button className="btn btn-primary rv-submit" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Saving…' : top3.length > 0 ? `Lock In My Top ${top3.length} 🔒` : 'Skip & See Results'}
        </button>
      </div>
    </div>
  )
}
