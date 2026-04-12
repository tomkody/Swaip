import { useState, useEffect, useRef } from 'react'
import { getUserToken, submitRankings, getRankings, subscribeToRankings } from '../lib/room'
import './RankingView.css'

export default function RankingView({ matches, room, onDone }) {
  const userToken = useRef(getUserToken())
  const [top3, setTop3] = useState([])
  const [phase, setPhase] = useState('rank') // 'rank' | 'wait' | 'results'
  const [partnerRanks, setPartnerRanks] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const dragFrom = useRef(null)

  // Check if partner already submitted + subscribe
  useEffect(() => {
    getRankings(room.id, userToken.current).then(({ partnerRanking, partnerSubmitted }) => {
      if (partnerSubmitted) setPartnerRanks(partnerRanking)
    })
    const unsub = subscribeToRankings(room.id, userToken.current, () => {
      getRankings(room.id, userToken.current).then(({ partnerRanking }) => {
        setPartnerRanks(partnerRanking)
      })
    })
    return unsub
  }, [room.id])

  // Move to results once partner submits (if we already submitted)
  useEffect(() => {
    if (partnerRanks && phase === 'wait') setPhase('results')
  }, [partnerRanks, phase])

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
    return (
      <div className="rv-page rv-center">
        <div className="rv-results">
          <div className="rv-icon">🎯</div>
          <h2>Combined Top Picks</h2>
          {combined.length > 0 && (
            <div className="rv-section">
              <p className="rv-label">Both of you picked these ✓</p>
              {combined.map((r, i) => (
                <div key={r.item.id} className="rv-result-item rv-both">
                  <span className="rv-pos">#{i + 1}</span>
                  {r.item.poster
                    ? <img src={r.item.poster} alt={r.item.title} className="rv-thumb" />
                    : <div className="rv-thumb rv-thumb-empty">{emoji}</div>}
                  <div className="rv-result-info">
                    <strong>{r.item.title}</strong>
                    <span>You #{r.myRank} · Them #{r.partnerRank}</span>
                  </div>
                  <span className="rv-both-badge">Match</span>
                </div>
              ))}
            </div>
          )}
          {oneOnly.length > 0 && (
            <div className="rv-section">
              <p className="rv-label">One of you picked these</p>
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
          {unranked.length > 0 && (
            <div className="rv-section">
              <p className="rv-label">Other matches</p>
              {unranked.map(m => (
                <div key={m.id} className="rv-result-item rv-unranked">
                  {m.poster
                    ? <img src={m.poster} alt={m.title} className="rv-thumb" />
                    : <div className="rv-thumb rv-thumb-empty">{emoji}</div>}
                  <div className="rv-result-info"><strong>{m.title}</strong></div>
                </div>
              ))}
            </div>
          )}
          {scored.length === 0 && unranked.length === 0 && (
            <p className="rv-empty">No matches to show.</p>
          )}
          <button className="btn btn-primary rv-done-btn" onClick={onDone}>New Room</button>
        </div>
      </div>
    )
  }

  // WAITING
  if (phase === 'wait') {
    return (
      <div className="rv-page rv-center">
        <div className="rv-wait">
          <div className="rv-icon" style={{ animation: 'pulse 2s ease infinite' }}>⏳</div>
          <h2>Waiting for your partner…</h2>
          <p>They're picking their top picks</p>
          <div className="rv-wait-list">
            {top3.length === 0
              ? <p className="rv-empty">You skipped rankings</p>
              : top3.map((m, i) => (
                <div key={m.id} className="rv-wait-item">
                  <span className="rv-wait-rank">#{i + 1}</span>
                  {m.poster
                    ? <img src={m.poster} alt={m.title} className="rv-thumb" />
                    : <div className="rv-thumb rv-thumb-empty">{emoji}</div>}
                  <span className="rv-wait-title">{m.title}</span>
                </div>
              ))}
          </div>
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
