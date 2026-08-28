import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getUserToken, submitRankings, getRankings, subscribeToRankings, fetchRoomMatches, subscribeToSwipes, fetchRoomPicks, subscribeToRoomPicks, MOVIE_SENTINELS } from '../lib/room'
import { getPlatformMeta, getWatchUrl } from '../lib/platforms'
import { generateShareImage, downloadCanvas } from '../lib/shareImage'
import { track } from '../lib/analytics'
import RoomChat from './RoomChat'
import './RankingView.css'

// "Where to watch" brand chips for a movie/series result (nothing for places).
function PlatformBadges({ platforms }) {
  if (!platforms || platforms.length === 0) return null
  const metas = platforms.map(getPlatformMeta).filter(Boolean)
  if (metas.length === 0) return null
  return (
    <div className="rv-plats">
      {metas.map(p => (
        <span key={p.id} className="rv-plat" style={{ color: p.color, background: p.bg, borderColor: p.border }}>
          {p.name}
        </span>
      ))}
    </div>
  )
}

export default function RankingView({ matches: initialMatches, liked = [], room, movies = [], onDone, isSolo = false, playerCount = 2, voteCounts = {} }) {
  const userToken = useRef(getUserToken())
  // Movie/series rooms may legitimately contain TMDB ids 1999/2999 — only treat
  // the real DONE sentinel as one there (undefined → the default set elsewhere).
  const sentinels = (room.type === 'movies' || room.type === 'series') ? MOVIE_SENTINELS : undefined
  const [matches, setMatches] = useState(initialMatches)
  const [top3, setTop3] = useState([])
  const [phase, setPhase] = useState('rank') // 'rank' | 'results'
  const [partnerRanks, setPartnerRanks] = useState(null)
  const [rankingsOff, setRankingsOff] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sharing, setSharing] = useState(false)
  const dragFrom = useRef(null)

  // ── Partner picks (live comparison without leaving the app) ──────────────
  const [picks, setPicks] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshedAt, setRefreshedAt] = useState(null)
  const [tick, setTick] = useState(0)          // re-renders the "updated Xm ago" label

  const refreshPicks = useCallback(async () => {
    if (isSolo) return
    setRefreshing(true)
    try {
      const [p, ids] = await Promise.all([
        fetchRoomPicks(room.id, userToken.current, sentinels),
        fetchRoomMatches(room.id, userToken.current, playerCount, sentinels),
      ])
      if (p) setPicks(p)
      if (ids && ids.length > 0 && movies.length > 0) {
        const fresh = movies.filter(m => ids.includes(m.id))
        if (fresh.length > 0) setMatches(fresh)
      }
      setRefreshedAt(Date.now())
    } catch (e) {
      console.error('Failed to refresh partner picks:', e)
    } finally {
      setRefreshing(false)
    }
  }, [isSolo, room.id, playerCount, movies, sentinels])

  // Load once, then live-update whenever anyone else swipes.
  useEffect(() => {
    if (isSolo) return
    refreshPicks()
    const unsub = subscribeToRoomPicks(room.id, userToken.current, () => refreshPicks())
    return unsub
  }, [isSolo, room.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the "updated Xm ago" label honest.
  useEffect(() => {
    if (isSolo) return
    const t = setInterval(() => setTick(n => n + 1), 30000)
    return () => clearInterval(t)
  }, [isSolo])

  const agoLabel = (() => {
    void tick
    if (!refreshedAt) return ''
    const secs = Math.round((Date.now() - refreshedAt) / 1000)
    if (secs < 45) return 'Updated just now'
    const mins = Math.round(secs / 60)
    return `Updated ${mins}m ago`
  })()

  // Partner ranking subscription — together mode only
  const rankingsDeadRef = useRef(false)
  const checkPartner = useCallback(async () => {
    if (isSolo || rankingsDeadRef.current) return
    const { partnerRanking, partnerSubmitted, unavailable } = await getRankings(room.id, userToken.current)
    if (unavailable) { rankingsDeadRef.current = true; setRankingsOff(true); return }
    if (partnerSubmitted) setPartnerRanks(partnerRanking)
  }, [isSolo, room.id])

  // One button refreshes both partner picks and their locked-in top 3
  const refreshAll = useCallback(() => {
    refreshPicks()
    checkPartner()
  }, [refreshPicks, checkPartner])

  // ── Recommendation: which pick to play, once both have locked in a Top 3 ──
  // Weight each ranking slot (#1=3, #2=2, #3=1). A title in BOTH top 3s wins
  // over one in only a single list; among those, the higher combined weight
  // wins (so #1+#2 beats #2+#3). Ties break toward the better single slot.
  const recommendation = useMemo(() => {
    const bothRanked = !isSolo && top3.length > 0 && Array.isArray(partnerRanks) && partnerRanks.length > 0
    if (!bothRanked) return null
    const slotWeight = pos => (pos > 0 ? 4 - pos : 0) // pos is 1-based; 0 = not ranked
    const myPos = id => top3.findIndex(m => m.id === id) + 1
    const theirPos = id => partnerRanks.indexOf(id) + 1
    const ids = Array.from(new Set([...top3.map(m => m.id), ...partnerRanks]))
    const scored = ids.map(id => {
      const mp = myPos(id), tp = theirPos(id)
      return {
        movie: movies.find(m => m.id === id),
        mp, tp, inBoth: mp > 0 && tp > 0,
        score: slotWeight(mp) + slotWeight(tp),
        bestSlot: Math.min(mp || 99, tp || 99),
      }
    }).filter(s => s.movie)
    // Final tie-break by id so BOTH partners resolve an exact tie to the same
    // title (the scoring is symmetric, but without this the winner fell back to
    // array order, which differs per person → each side saw a different pick).
    scored.sort((a, b) =>
      (b.inBoth - a.inBoth) || (b.score - a.score) || (a.bestSlot - b.bestSlot) || (a.movie.id - b.movie.id)
    )
    return scored[0] || null
  }, [isSolo, top3, partnerRanks, movies])

  useEffect(() => {
    if (isSolo) return
    checkPartner()
    const unsub = subscribeToRankings(room.id, userToken.current, () => checkPartner())
    return unsub
  }, [isSolo, room.id, checkPartner])

  useEffect(() => {
    if (phase !== 'results' || isSolo) return
    const interval = setInterval(checkPartner, 15000)
    return () => clearInterval(interval)
  }, [phase, isSolo, checkPartner])

  // Real-time match updates — together mode only
  useEffect(() => {
    if (isSolo) return
    const unsub = subscribeToSwipes(room.id, userToken.current, (itemId) => {
      const numId = Number(itemId)
      const matched = movies.find(m => m.id === numId || m.id === itemId)
      if (matched) {
        setMatches(prev => prev.find(m => m.id === matched.id) ? prev : [...prev, matched])
      }
    }, playerCount)
    return unsub
  }, [isSolo, room.id, movies, playerCount])

  // Poll for new matches — together mode only
  useEffect(() => {
    if (isSolo) return
    const poll = async () => {
      const ids = await fetchRoomMatches(room.id, userToken.current, playerCount, sentinels)
      if (ids !== null && ids.length > 0 && movies.length > 0) {
        const fresh = movies.filter(m => ids.includes(m.id))
        if (fresh.length > 0) setMatches(fresh)
      }
    }
    poll()
    const interval = setInterval(poll, 12000)
    return () => clearInterval(interval)
  }, [isSolo, room.id, movies, playerCount, sentinels])

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
    track('rankings_locked', { type: room.type, picks: top3.length })
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
    track('results_shared', { type: room.type, matches: matches.length, solo: isSolo })
    setSharing(true)
    try {
      const typeLabel = room.type === 'series' ? 'shows' : room.type === 'activities' ? 'activities' : room.type === 'food' ? 'restaurants' : 'movies'
      const canvas = await generateShareImage({
        title: matches.length === 1 ? matches[0].title : `${matches.length} ${typeLabel}`,
        posterUrl: matches.length === 1 ? (matches[0].poster || null) : null,
        items: matches.slice(0, 3),
        swipeCount: matches.length,
        mode: 'matches',
        typeLabel,
        solo: isSolo,
        recommendation: recommendation?.movie?.title || null,
      })
      // Try native share sheet first (mobile), fall back to download
      if (navigator.share && navigator.canShare) {
        try {
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
          const file = new File([blob], 'swaip-matches.png', { type: 'image/png' })
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: 'Swaip Results' })
            return
          }
        } catch (shareErr) {
          if (shareErr.name !== 'AbortError') console.warn('Share failed, falling back:', shareErr)
          else return // user cancelled — don't download
        }
      }
      downloadCanvas(canvas, `swaip-matches.png`)
    } catch (err) { console.error('Share error:', err) }
    finally { setSharing(false) }
  }

  const emoji = room.type === 'series' ? '📺' : room.type === 'activities' ? '🎯' : room.type === 'food' ? '🍽️' : '🎬'
  const typeLabel = room.type === 'series' ? 'shows' : room.type === 'activities' ? 'activities' : room.type === 'food' ? 'restaurants' : 'movies'
  // "1 movie" not "1 movies"
  const typeSingular = room.type === 'series' ? 'show' : room.type === 'activities' ? 'activity' : room.type === 'food' ? 'restaurant' : 'movie'
  const countLabel = n => `${n} ${n === 1 ? typeSingular : typeLabel}`

  // ── RESULTS ──────────────────────────────────────────────────────
  if (phase === 'results') {
    const hasMyPicks = top3.length > 0
    const rest = matches.filter(m => !top3.some(t => t.id === m.id))

    return (
      <div className="rv-page">
        <Link to="/" className="rv-brand" aria-label="Back to home"><span className="rv-brand-name">Swaip</span><span className="rv-brand-tld">.app</span></Link>

        {/* Hero */}
        <div className="rv-results-hero">
          {matches.length > 0 ? (
            <div className="celebrate-badge celebrate-badge--heart rv-icon">
              <svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </div>
          ) : (
            <div className="celebrate-badge celebrate-badge--muted rv-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
          )}
          <h2>{matches.length > 0
            ? isSolo ? `Your picks: ${countLabel(matches.length)}` : `You matched on ${countLabel(matches.length)}!`
            : isSolo ? `Nothing picked this time` : `No matches this time`
          }</h2>
          {(() => {
            // Skip the subtitle once we have ranked picks — the "My Top 3" label
            // below already says it.
            let sub = ''
            if (matches.length === 0) {
              sub = isSolo ? 'Swipe right on more next time!' : playerCount > 2 ? 'No unanimous group picks — try again with fewer people or different picks!' : 'Try swiping more next time!'
            } else if (!hasMyPicks) {
              sub = isSolo ? 'Everything you liked:' : playerCount > 2 ? `Everything your group of ${playerCount} all agreed on:` : `Here's everything you both want to watch:`
            }
            return sub ? <p className="rv-hero-sub">{sub}</p> : null
          })()}
        </div>

        {/* Recommended pick — once both have locked in a Top 3 */}
        {recommendation && (() => {
          const m = recommendation.movie
          const why = recommendation.inBoth
            ? `You ranked it #${recommendation.mp} · your partner ranked it #${recommendation.tp}`
            : recommendation.mp > 0
              ? `Your #${recommendation.mp} pick — no title landed in both top 3s`
              : `Your partner's #${recommendation.tp} pick — no title landed in both top 3s`
          return (
            <div className="rv-reco">
              <p className="rv-reco-eyebrow">{recommendation.inBoth ? '✨ You both ranked this — play it' : '💡 Closest call'}</p>
              <div className="rv-reco-card">
                {m.poster
                  ? <img src={m.poster} alt={m.title} className="rv-reco-poster" />
                  : <div className="rv-reco-poster rv-result-poster-empty">{emoji}</div>}
                <div className="rv-reco-info">
                  <strong>{m.title}</strong>
                  <span className="rv-reco-meta">{m.year}{m.rating ? ` · ⭐ ${m.rating}` : ''}</span>
                  <span className="rv-reco-why">{why}</span>
                  <PlatformBadges platforms={m.platforms} />
                </div>
              </div>

              {/* One-tap action — turn the decision into doing it */}
              {(() => {
                const isPlace = room.type === 'food' || room.type === 'activities'
                if (isPlace) {
                  const q = encodeURIComponent([m.title, m.address].filter(Boolean).join(' '))
                  return (
                    <div className="rv-reco-watch-row">
                      <a className="rv-reco-watch rv-reco-watch--neutral" href={`https://www.google.com/maps/search/?api=1&query=${q}`} target="_blank" rel="noopener noreferrer">
                        📍 Get directions
                      </a>
                    </div>
                  )
                }
                const metas = (m.platforms || []).map(getPlatformMeta).filter(Boolean).slice(0, 3)
                if (metas.length === 0) {
                  return (
                    <div className="rv-reco-watch-row">
                      <a className="rv-reco-watch rv-reco-watch--neutral" href={getWatchUrl(undefined, m.title)} target="_blank" rel="noopener noreferrer">
                        🔍 Find where to watch
                      </a>
                    </div>
                  )
                }
                const multi = metas.length > 1
                return (
                  <div className={`rv-reco-watch-row ${multi ? 'is-multi' : ''}`}>
                    {metas.map(meta => (
                      <a
                        key={meta.id}
                        className="rv-reco-watch"
                        href={getWatchUrl(meta.id, m.title)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => track('watch_clicked', { type: room.type, platform: meta.id })}
                        style={{ background: meta.color === '#ffffff' ? '#000000' : meta.color, color: '#fff' }}
                      >
                        ▶ {multi ? meta.name : `Watch on ${meta.name}`}
                      </a>
                    ))}
                  </div>
                )
              })()}
            </div>
          )
        })()}

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
                    <PlatformBadges platforms={m.platforms} />
                    {m.isOpen != null && (
                      <span className={`rv-hours ${m.isOpen ? 'rv-hours--open' : 'rv-hours--closed'}`}>
                        {m.isOpen ? '● Open' : '● Closed'}
                        {m.isOpen && m.closesAt ? ` · until ${m.closesAt}` : ''}
                        {!m.isOpen && m.opensAt ? ` · opens ${m.opensAt}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Partner's / group's locked-in Top 3 — live, with manual refresh */}
        {!isSolo && !rankingsOff && (() => {
          const groupWord = playerCount > 2 ? 'The group' : 'Partner'
          const rankItems = (partnerRanks || [])
            .map(id => movies.find(m => m.id === id))
            .filter(Boolean)
          const mutual = new Set(picks?.mutualIds || [])
          const submitted = partnerRanks != null

          return (
            <div className="rv-match-list rv-partner-block rv-top3-block">
              <div className="rv-partner-head">
                <div className="rv-partner-headtext">
                  <p className="rv-label rv-label--tight">🏆 {groupWord}'s Top {rankItems.length > 0 ? rankItems.length : 3}</p>
                  <p className="rv-partner-status">
                    {submitted
                      ? `Locked in${agoLabel ? ` · ${agoLabel}` : ''}`
                      : `Waiting for ${playerCount > 2 ? 'the group' : 'your partner'} to lock in…`}
                  </p>
                </div>
                <button
                  className={`rv-refresh ${refreshing ? 'is-busy' : ''}`}
                  onClick={refreshAll}
                  disabled={refreshing}
                  aria-label="Refresh partner top 3"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-2.64-6.36" /><polyline points="21 3 21 9 15 9" />
                  </svg>
                  {refreshing ? 'Refreshing' : 'Refresh'}
                </button>
              </div>

              {rankItems.length === 0 ? (
                <p className="rv-empty">
                  {submitted
                    ? `${playerCount > 2 ? 'The group' : 'They'} didn't rank anything.`
                    : `Nothing yet — tap Refresh once ${playerCount > 2 ? 'they' : 'your partner'} finishes ranking.`}
                </p>
              ) : (
                rankItems.map((m, i) => {
                  const isMutual = mutual.has(m.id)
                  return (
                    <div key={m.id} className={`rv-result-card ${isMutual ? 'rv-partner-mutual' : ''}`}>
                      <div className="rv-result-card-inner">
                        <span className="rv-pick-num">#{i + 1}</span>
                        {m.poster
                          ? <img src={m.poster} alt={m.title} className="rv-result-poster" />
                          : <div className="rv-result-poster rv-result-poster-empty">{emoji}</div>}
                        <div className="rv-result-info">
                          <strong>{m.title}</strong>
                          <span>{m.year}{m.rating ? ` · ⭐ ${m.rating}` : ''}</span>
                          <PlatformBadges platforms={m.platforms} />
                        </div>
                        {isMutual && <span className="rv-partner-tag rv-partner-tag--match">✓ Both</span>}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )
        })()}

        {/* Other matches — only when there are pinned top picks above */}
        {hasMyPicks && rest.length > 0 && (
          <div className="rv-match-list">
            <p className="rv-label">{isSolo ? `All Picks (${matches.length})` : playerCount > 2 ? `Group Picks (${matches.length})` : `All Matches (${matches.length})`}</p>
            {rest.map(m => (
              <div key={m.id} className="rv-result-card">
                <div className="rv-result-card-inner">
                  {m.poster
                    ? <img src={m.poster} alt={m.title} className="rv-result-poster" />
                    : <div className="rv-result-poster rv-result-poster-empty">{emoji}</div>}
                  <div className="rv-result-info">
                    <strong>{m.title}</strong>
                    <span>{m.year}{m.rating ? ` · ⭐ ${m.rating}` : ''}</span>
                    <PlatformBadges platforms={m.platforms} />
                    {playerCount > 2 && voteCounts[m.id] && (
                      <span className="rv-vote-count">{voteCounts[m.id]}/{playerCount} voted</span>
                    )}
                    {m.isOpen != null && (
                      <span className={`rv-hours ${m.isOpen ? 'rv-hours--open' : 'rv-hours--closed'}`}>
                        {m.isOpen ? '● Open' : '● Closed'}
                        {m.isOpen && m.closesAt ? ` · until ${m.closesAt}` : ''}
                        {!m.isOpen && m.opensAt ? ` · opens ${m.opensAt}` : ''}
                      </span>
                    )}
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
                    <PlatformBadges platforms={m.platforms} />
                    {playerCount > 2 && voteCounts[m.id] && (
                      <span className="rv-vote-count">{voteCounts[m.id]}/{playerCount} voted</span>
                    )}
                    {m.isOpen != null && (
                      <span className={`rv-hours ${m.isOpen ? 'rv-hours--open' : 'rv-hours--closed'}`}>
                        {m.isOpen ? '● Open' : '● Closed'}
                        {m.isOpen && m.closesAt ? ` · until ${m.closesAt}` : ''}
                        {!m.isOpen && m.opensAt ? ` · opens ${m.opensAt}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* What the partner / group picked — live, with manual refresh */}
        {!isSolo && (() => {
          const mutual = new Set(picks?.mutualIds || [])
          const partnerItems = (picks?.partnerIds || [])
            .map(id => movies.find(m => m.id === id))
            .filter(Boolean)
            .sort((a, b) => (mutual.has(b.id) ? 1 : 0) - (mutual.has(a.id) ? 1 : 0))
          const groupWord = playerCount > 2 ? 'the group' : 'your partner'
          const othersDone = picks?.othersDone || 0
          const status = picks == null
            ? 'Loading…'
            : othersDone > 0
              ? (playerCount > 2
                  ? `${othersDone} of ${playerCount - 1} finished swiping`
                  : 'Finished swiping')
              : partnerItems.length > 0 ? 'Still swiping…' : 'Nothing picked yet'

          return (
            <div className="rv-match-list rv-partner-block">
              <div className="rv-partner-head">
                <div className="rv-partner-headtext">
                  <p className="rv-label rv-label--tight">What {groupWord} picked</p>
                  <p className="rv-partner-status">
                    {status}{agoLabel ? ` · ${agoLabel}` : ''}
                  </p>
                </div>
                <button
                  className={`rv-refresh ${refreshing ? 'is-busy' : ''}`}
                  onClick={refreshAll}
                  disabled={refreshing}
                  aria-label="Refresh partner picks"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-2.64-6.36" /><polyline points="21 3 21 9 15 9" />
                  </svg>
                  {refreshing ? 'Refreshing' : 'Refresh'}
                </button>
              </div>

              {partnerItems.length === 0 ? (
                <p className="rv-empty">
                  {othersDone > 0
                    ? `${playerCount > 2 ? 'Nobody' : 'They'} picked anything this time.`
                    : `Nothing yet — you'll see picks here as ${groupWord} swipes.`}
                </p>
              ) : (
                partnerItems.map(m => {
                  const isMutual = mutual.has(m.id)
                  const count = picks?.countsById?.[m.id]
                  return (
                    <div key={m.id} className={`rv-result-card ${isMutual ? 'rv-partner-mutual' : ''}`}>
                      <div className="rv-result-card-inner">
                        {m.poster
                          ? <img src={m.poster} alt={m.title} className="rv-result-poster" />
                          : <div className="rv-result-poster rv-result-poster-empty">{emoji}</div>}
                        <div className="rv-result-info">
                          <strong>{m.title}</strong>
                          <span>{m.year}{m.rating ? ` · ⭐ ${m.rating}` : ''}</span>
                          <PlatformBadges platforms={m.platforms} />
                        </div>
                        {isMutual
                          ? <span className="rv-partner-tag rv-partner-tag--match">✓ Both</span>
                          : playerCount > 2 && count
                            ? <span className="rv-partner-tag">{count}/{playerCount}</span>
                            : <span className="rv-partner-tag">Theirs</span>}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )
        })()}

        {/* Post-match chat — sort out the details together, right here */}
        {!isSolo && <RoomChat roomId={room.id} />}

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
        <p>{matches.length} {isSolo ? 'pick' : 'match'}{matches.length !== 1 ? 's' : ''} · tap to rank · drag to reorder</p>
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

      {/* Matches / picks list */}
      <div className="rv-match-list">
        <p className="rv-label">{isSolo ? `✨ Your Picks (${matches.length})` : `🤝 Mutual Matches (${matches.length})`}</p>
        {matches.length === 0 && <p className="rv-empty">{isSolo ? 'Nothing picked yet.' : 'No matches yet — still waiting for your partner.'}</p>}
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
                    <PlatformBadges platforms={m.platforms} />
                {m.isOpen != null && (
                  <span className={`rv-hours ${m.isOpen ? 'rv-hours--open' : 'rv-hours--closed'}`}>
                    {m.isOpen ? '● Open' : '● Closed'}
                    {m.isOpen && m.closesAt ? ` · until ${m.closesAt}` : ''}
                    {!m.isOpen && m.opensAt ? ` · opens ${m.opensAt}` : ''}
                  </span>
                )}
              </div>
              <div className={`rv-badge ${inTop ? 'rv-badge-ranked' : full ? 'rv-badge-full' : 'rv-badge-add'}`}>
                {inTop ? `#${rank}` : full ? '—' : '+'}
              </div>
            </button>
          )
        })}
      </div>

      {/* My full selection — all movies I swiped right on (together mode only) */}
      {liked.length > 0 && !isSolo && (
        <div className="rv-match-list rv-my-selection">
          <p className="rv-label">👤 My Selection ({liked.length})</p>
          <p className="rv-selection-note">Everything you liked — waiting to see what your partner picked too.</p>
          {liked.map(m => {
            const isMatch = matches.some(x => x.id === m.id)
            return (
              <div key={m.id} className={`rv-match-item rv-selection-item ${isMatch ? 'rv-selection-matched' : ''}`}>
                {m.poster
                  ? <img src={m.poster} alt={m.title} className="rv-match-thumb" />
                  : <div className="rv-match-thumb rv-match-thumb-empty">{emoji}</div>}
                <div className="rv-match-info">
                  <strong>{m.title}</strong>
                  <span>{m.year}{m.rating ? ` · ⭐ ${m.rating}` : ''}</span>
                    <PlatformBadges platforms={m.platforms} />
                </div>
                {isMatch && <span className="rv-selection-match-badge">✓ Match</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* Chat is available the moment swiping ends, not only after locking in */}
      {!isSolo && <RoomChat roomId={room.id} />}

      <div className="rv-footer">
        <button className="btn btn-primary rv-submit" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Saving…' : top3.length > 0 ? `Lock In My Top ${top3.length} 🔒` : 'Skip & See Results'}
        </button>
      </div>
    </div>
  )
}
