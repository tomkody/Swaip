import { useState, useEffect, useRef, useCallback } from 'react'
import { getUserToken, submitRankings, getRankings, subscribeToRankings, fetchRoomMatches } from '../lib/room'
import './RankingView.css'

export default function RankingView({ matches: initialMatches, room, movies = [], onDone }) {
  const userToken = useRef(getUserToken())
  const [matches, setMatches] = useState(initialMatches)
  const [top3, setTop3] = useState([])
  const [phase, setPhase] = useState('rank') // 'rank' | 'wait' | 'results'
  const [partnerRanks, setPartnerRanks] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)
  const dragFrom = useRef(null)

  const checkPartner = useCallback(async () => {
    const { partnerRanking, partnerSubmitted } = await getRankings(room.id, userToken.current)
    if (partnerSubmitted) {
      setPartnerRanks(partnerRanking)
      return true
    }
    return false
  }, [room.id])

  // Check if partner already submitted + subscribe
  useEffect(() => {
    checkPartner()
    const unsub = subscribeToRankings(room.id, userToken.current, () => checkPartner())
    return unsub
  }, [room.id, checkPartner])

  // Auto-poll every 15s while waiting
  useEffect(() => {
    if (phase !== 'wait') return
    const interval = setInterval(() => checkPartner(), 15000)
    return () => clearInterval(interval)
  }, [phase, checkPartner])

  // Move to results once partner submits (if we already submitted)
  useEffect(() => {
    if (partnerRanks && phase === 'wait') setPhase('results')
  }, [partnerRanks, phase])

  async function handleRefresh() {
    setRefreshing(true)
    // Re-fetch matches from DB
    const ids = await fetchRoomMatches(room.id, userToken.current)
    if (ids !== null && movies.length > 0) {
      setMatches(movies.filter(m => ids.includes(m.id)))
    }
    // Check partner rankings
    await checkPartner()
    setLastRefresh(new Date())
    setRefreshing(false)
  }

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
    try {
      await submitRankings(room.id, userToken.current, top3.map(m => m.id))
      if (partnerRanks) setPhase('results')
      else setPhase('wait')
    } catch (e) {
      console.error(e)
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

  function getResults() {
    const myMap = {}
    top3.forEach((m, i) => { myMap[m.id] = i + 1 })
    const partnerMap = {}
    if (partnerRanks) partnerRanks.forEach((id, i) => { partnerMap[id] = i + 1 })

    const allIds = [...new Set([...Object.keys(myMap).map(Number), ...(partnerRanks || []).map(Number)])]
    const scored = allIds.map(id => {
      const myRank = myMap[id] || null
      const partnerRank = partnerMap[id] || null
      const item = matches.find(m => m.id === id)
      const score = (myRank ? 4 - myRank : 0) + (partnerRank ? 4 - partnerRank : 0)
      return { item, myRank, partnerRank, score, both: !!(myRank && partnerRank) }
    }).filter(r => r.item).sort((a, b) => b.score - a.score || (a.myRank || 99) - (b.myRank || 99))

    const rankedIds = new Set(allIds)
    const unranked = matches.filter(m => !rankedIds.has(m.id))
    return { scored, unranked }
  }

  const emoji = room.type === 'series' ? '📺' : room.type === 'activities' ? '🎯' : '🎬'

  // RESULTS
  if (phase === 'results') {
    const { scored, unranked } = getResults()
    const combined = scored.filter(r => r.both)
    const oneOnly = scored.filter(r => !r.both)
    const hasRankings = scored.length > 0
    const typeLabel = room.type === 'series' ? 'shows' : room.type === 'activities' ? 'activities' : 'movies'

    return (
      <div className="rv-page">
        {/* Hero summary */}
        <div className="rv-results-hero">
          <div className="rv-icon">🎉</div>
          <h2>You matched on {matches.length} {typeLabel}!</h2>
          <p>{matches.length === 0 ? 'No matches this time.' : 'Here\'s everything you both agreed on:'}</p>
        </div>

        {/* ALL matched movies — always shown first */}
        {matches.length > 0 && (
          <div className="rv-match-list" style={{ paddingTop: 0 }}>
            <p className="rv-label">All matches ({matches.length})</p>
            {matches.map(m => {
              const myRank = top3.findIndex(t => t.id === m.id) + 1 || null
              const partnerRank = partnerRanks ? (partnerRanks.indexOf(m.id) + 1) || null : null
              const isTopMatch = myRank && partnerRank
              return (
                <div key={m.id} className={`rv-match-item rv-match-static ${isTopMatch ? 'rv-in-top3' : ''}`}>
                  {m.poster
                    ? <img src={m.poster} alt={m.title} className="rv-match-thumb" />
                    : <div className="rv-match-thumb rv-match-thumb-empty">{emoji}</div>}
                  <div className="rv-match-info">
                    <strong>{m.title}</strong>
                    <span>{m.year}{m.rating ? ` · ⭐ ${m.rating}` : ''}</span>
                  </div>
                  {(myRank || partnerRank) && (
                    <div className="rv-rank-tags">
                      {myRank && <span className="rv-rank-tag rv-rank-you">You #{myRank}</span>}
                      {partnerRank && <span className="rv-rank-tag rv-rank-them">Them #{partnerRank}</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Priority rankings — shown only if someone ranked */}
        {hasRankings && (
          <div className="rv-match-list" style={{ paddingTop: 0 }}>
            <p className="rv-label" style={{ marginTop: 8 }}>Priority picks</p>
            {combined.length > 0 && combined.map((r, i) => (
              <div key={r.item.id} className="rv-result-item rv-both">
                <span className="rv-pos">#{i + 1}</span>
                {r.item.poster
                  ? <img src={r.item.poster} alt={r.item.title} className="rv-thumb" />
                  : <div className="rv-thumb rv-thumb-empty">{emoji}</div>}
                <div className="rv-result-info">
                  <strong>{r.item.title}</strong>
                  <span>You #{r.myRank} · Them #{r.partnerRank}</span>
                </div>
                <span className="rv-both-badge">✓ Both</span>
              </div>
            ))}
            {oneOnly.map(r => (
              <div key={r.item.id} className="rv-result-item">
                {r.item.poster
                  ? <img src={r.item.poster} alt={r.item.title} className="rv-thumb" />
                  : <div className="rv-thumb rv-thumb-empty">{emoji}</div>}
                <div className="rv-result-info">
                  <strong>{r.item.title}</strong>
                  <span>{r.myRank ? `You #${r.myRank}` : '—'} · {r.partnerRank ? `Them #${r.partnerRank}` : '—'}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {matches.length === 0 && <p className="rv-empty" style={{ padding: '0 20px' }}>Try swiping more next time!</p>}

        <div className="rv-footer">
          <button className="btn btn-primary rv-submit" onClick={onDone}>Start New Room</button>
        </div>
      </div>
    )
  }

  // WAITING
  if (phase === 'wait') {
    const partnerTop3Items = partnerRanks
      ? partnerRanks.map(id => matches.find(m => m.id === id)).filter(Boolean)
      : null

    return (
      <div className="rv-page">
        <div className="rv-wait-page">
          <div className="rv-wait-header">
            <div className="rv-icon">🔒</div>
            <h2>Picks locked in!</h2>
            <p>Waiting for your partner to lock in theirs…</p>
          </div>

          <div className="rv-screenshot-hint">
            <span className="rv-screenshot-icon">📸</span>
            <span>Make a screenshot and send it to your friend!</span>
          </div>

          <div className="rv-wait-cols">
            {/* My picks */}
            <div className="rv-wait-col">
              <p className="rv-wait-col-label">Your picks</p>
              {top3.length > 0 ? top3.map((m, i) => (
                <div key={m.id} className="rv-wait-item">
                  <span className="rv-wait-rank">#{i + 1}</span>
                  {m.poster
                    ? <img src={m.poster} alt={m.title} className="rv-thumb" />
                    : <div className="rv-thumb rv-thumb-empty">{emoji}</div>}
                  <span className="rv-wait-title">{m.title}</span>
                </div>
              )) : <p className="rv-wait-none">No picks</p>}
            </div>

            {/* Partner picks */}
            <div className="rv-wait-col">
              <p className="rv-wait-col-label">Their picks</p>
              {partnerTop3Items ? partnerTop3Items.map((m, i) => (
                <div key={m.id} className="rv-wait-item rv-wait-partner">
                  <span className="rv-wait-rank rv-wait-rank-partner">#{i + 1}</span>
                  {m.poster
                    ? <img src={m.poster} alt={m.title} className="rv-thumb" />
                    : <div className="rv-thumb rv-thumb-empty">{emoji}</div>}
                  <span className="rv-wait-title">{m.title}</span>
                </div>
              )) : (
                <div className="rv-wait-pending">
                  <div className="rv-wait-dots">
                    <span /><span /><span />
                  </div>
                  <p>Still picking…</p>
                </div>
              )}
            </div>
          </div>

          <div className="rv-refresh-row">
            <button className="rv-refresh-btn" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? '⟳ Checking…' : '⟳ Refresh'}
            </button>
            {lastRefresh && (
              <span className="rv-refresh-hint">
                Checked {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <p className="rv-refresh-hint" style={{ marginTop: 8, textAlign: 'center' }}>Auto-checks every 15 seconds</p>
        </div>
      </div>
    )
  }

  // RANKING
  const isInTop3 = id => top3.some(m => m.id === id)
  const rankOf = id => top3.findIndex(m => m.id === id) + 1

  return (
    <div className="rv-page">
      <div className="rv-ranking-header">
        <h2>Pick Your Top {matches.length >= 3 ? 3 : matches.length}</h2>
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
              <div
                className="rv-slot-content"
                draggable
                onDragStart={e => onDragStart(e, i)}
              >
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
