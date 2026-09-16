import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { getRoomToken, submitRankings, getRankings, subscribeToRankings, fetchRoomMatches, subscribeToSwipes, fetchRoomPicks, subscribeToRoomPicks, combineRankings, MOVIE_SENTINELS } from '../lib/room'
import { getPlatformMeta, getWatchUrl, platformChipStyle } from '../lib/platforms'
import { generateShareImage, downloadCanvas } from '../lib/shareImage'
import { track } from '../lib/analytics'
import { seededShuffle } from '../lib/random'
import { successFeedback } from '../lib/haptics'
import AppHeader from './AppHeader'
import Icon from './Icon'
import './RankingView.css'

// "Decide for us" — a little roulette over the matches for the moment nobody
// wants to choose. Purely local (each player can roll their own); driven from
// the click handler with timeouts, no effects.
function DecideForUs({ matches, emoji, onRolled, seed }) {
  const [spinIndex, setSpinIndex] = useState(null)   // index while spinning / final
  const [spinning, setSpinning] = useState(false)
  const [rolls, setRolls] = useState(0)
  const timerRef = useRef(null)

  const roll = () => {
    if (spinning || matches.length < 2) return
    setSpinning(true)
    setRolls(n => n + 1)
    onRolled?.()
    // The first roll is seeded by the room so both people land on the SAME
    // title — "we can't choose, let the app choose" is worthless if it answers
    // differently on each phone. A deliberate re-roll after that is your own.
    const picked = rolls === 0 ? seededShuffle(matches, seed)[0] : null
    const seededIndex = picked ? matches.findIndex(m => m.id === picked.id) : -1
    const winner = seededIndex >= 0 ? seededIndex : Math.floor(Math.random() * matches.length)
    // ~18 hops with an easing slowdown, landing on the winner
    const hops = 18 + ((winner - ((18 - 1) % matches.length) + matches.length) % matches.length)
    let i = 0
    const step = () => {
      setSpinIndex(i % matches.length)
      i++
      if (i <= hops) {
        const t = i / hops
        timerRef.current = setTimeout(step, 40 + 260 * t * t)   // ease-out
      } else {
        setSpinning(false)
      }
    }
    step()
  }

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const current = spinIndex != null ? matches[spinIndex] : null
  return (
    <div className="rv-dice">
      {current && (
        <div className={`rv-dice-card ${spinning ? 'is-spinning' : 'is-landed'}`}>
          {current.poster
            ? <img src={current.poster} alt="" className="rv-dice-poster" />
            : <span className="rv-dice-poster rv-dice-poster--empty">{emoji}</span>}
          <div className="rv-dice-info">
            {!spinning && <span className="rv-dice-eyebrow">{rolls > 1 ? '🎲 Your re-roll' : "🎉 Tonight's pick"}</span>}
            <strong>{current.title}</strong>
          </div>
        </div>
      )}
      <button className="rv-dice-btn" onClick={roll} disabled={spinning}>
        <Icon name="shuffle" size={17} />
        {spinning ? 'Rolling…' : spinIndex == null ? "Can't choose? Decide for us" : 'Roll again'}
      </button>
    </div>
  )
}

// "Where to watch" brand chips for a movie/series result (nothing for places).
// With a title, each chip is a real link straight to that platform's search
// for the title (tap Netflix, land on Netflix already searching for it).
// Without one (the ranking picker, where the chip sits inside a <button> and
// a nested link would be invalid markup) it stays a plain, non-interactive span.
function PlatformBadges({ platforms, title, roomType }) {
  if (!platforms || platforms.length === 0) return null
  const metas = platforms.map(getPlatformMeta).filter(Boolean)
  if (metas.length === 0) return null
  return (
    <div className="rv-plats">
      {metas.map(p => title ? (
        <a
          key={p.id}
          className="rv-plat plat-chip"
          style={platformChipStyle(p)}
          href={getWatchUrl(p.id, title)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => { e.stopPropagation(); track('watch_clicked', { type: roomType, platform: p.id, from: 'badge' }) }}
        >
          {p.name}
        </a>
      ) : (
        <span key={p.id} className="rv-plat plat-chip" style={platformChipStyle(p)}>
          {p.name}
        </span>
      ))}
    </div>
  )
}

export default function RankingView({ matches: initialMatches, liked = [], room, movies = [], onDone, isSolo = false, playerCount = 2, voteCounts = {}, isFallback = false }) {
  const userToken = useRef(getRoomToken(room.id))
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

  // Funnel: results screen reached (once per mount)
  useEffect(() => {
    track('results_viewed', { type: room.type, matches: initialMatches.length, solo: isSolo })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Partner picks (live comparison without leaving the app) ──────────────
  const [picks, setPicks] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshedAt, setRefreshedAt] = useState(null)
  const [tick, setTick] = useState(0)          // re-renders the "updated Xm ago" label

  // Realtime fires once per partner swipe, and the poll below overlaps with it,
  // which used to send the same two queries several times per second. One
  // refresh runs at a time; anything requested meanwhile collapses into a
  // single follow-up.
  const refreshBusyRef = useRef(false)
  const refreshQueuedRef = useRef(false)
  const refreshPicks = useCallback(async () => {
    if (isSolo) return
    if (refreshBusyRef.current) { refreshQueuedRef.current = true; return }
    refreshBusyRef.current = true
    setRefreshing(true)
    try {
      const [p, ids] = await Promise.all([
        fetchRoomPicks(room.id, userToken.current, sentinels),
        fetchRoomMatches(room.id, userToken.current, playerCount, sentinels),
      ])
      if (p) setPicks(p)
      if (ids && movies.length > 0) {
        const fresh = movies.filter(m => ids.includes(m.id))
        // In a pair an empty answer is real (a like was taken back). Group place
        // rooms may be showing best-voted fallbacks, so only replace with news.
        if (fresh.length > 0 || playerCount <= 2) setMatches(fresh)
      }
      setRefreshedAt(Date.now())
    } catch (e) {
      console.error('Failed to refresh partner picks:', e)
    } finally {
      setRefreshing(false)
      refreshBusyRef.current = false
      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false
        setTimeout(() => refreshPicksRef.current?.(), 250)
      }
    }
  }, [isSolo, room.id, playerCount, movies, sentinels])
  // A match that disappears (taken back) can't stay in the top 3 either.
  useEffect(() => {
    const ids = new Set(matches.map(m => m.id))
    setTop3(prev => (prev.every(m => ids.has(m.id)) ? prev : prev.filter(m => ids.has(m.id))))
  }, [matches])
  const refreshPicksRef = useRef(null)
  useEffect(() => { refreshPicksRef.current = refreshPicks }, [refreshPicks])

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
  const [othersLocked, setOthersLocked] = useState(0)
  const checkPartner = useCallback(async () => {
    if (isSolo || rankingsDeadRef.current) return
    const { partnerRanking, partnerSubmitted, unavailable, othersRankings } = await getRankings(room.id, userToken.current)
    if (unavailable) { rankingsDeadRef.current = true; setRankingsOff(true); return }
    setOthersLocked(othersRankings?.length || 0)
    // In a group, one arbitrary player's list was being shown as "the group's
    // top 3" — combine everyone else's instead.
    if (partnerSubmitted) {
      setPartnerRanks(playerCount > 2 ? combineRankings(othersRankings) : partnerRanking)
    }
  }, [isSolo, room.id, playerCount])

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

  // Poll for new matches — together mode only (solo has nothing to reconcile;
  // the first fetch happens in refreshPicks on mount)
  useEffect(() => {
    if (isSolo) return
    const poll = async () => {
      const ids = await fetchRoomMatches(room.id, userToken.current, playerCount, sentinels)
      if (ids !== null && movies.length > 0) {
        const fresh = movies.filter(m => ids.includes(m.id))
        if (fresh.length > 0 || playerCount <= 2) setMatches(fresh)
      }
    }
    const interval = setInterval(poll, 12000)
    return () => clearInterval(interval)
  }, [isSolo, room.id, movies, playerCount, sentinels])

  // Ranking a list of one is busywork: lock it in automatically. Only once the
  // others have finished swiping, though — an early single match can still grow.
  const autoLockedRef = useRef(false)
  useEffect(() => {
    if (phase !== 'rank' || autoLockedRef.current) return
    if (matches.length !== 1 || top3.length > 0) return
    const everyoneDone = isSolo || (picks != null && picks.othersDone >= playerCount - 1)
    if (!everyoneDone) return
    autoLockedRef.current = true
    const only = matches[0]
    setTop3([only])
    setPhase('results')
    submitRankings(room.id, userToken.current, [only.id]).catch(e => console.error('Failed to save rankings:', e))
  }, [phase, matches, top3.length, isSolo, picks, playerCount, room.id])

  function toggleItem(item) {
    setTop3(prev => {
      const idx = prev.findIndex(m => m.id === item.id)
      if (idx !== -1) return prev.filter(m => m.id !== item.id)
      if (prev.length >= 3) return prev
      return [...prev, item]
    })
  }

  async function handleSubmit() {
    successFeedback()
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

  // Drag-to-reorder within the top 3 — pointer events, so it works with a
  // finger on phones (HTML5 drag-and-drop never fires on touch screens).
  // Press a filled tile, move it over another slot, let go: they swap.
  const slotRefs = useRef([])
  const dragRef = useRef(null)            // { from, pointerId, x0, y0, moved }
  const [drag, setDrag] = useState(null)  // { from, dx, dy, over } while moving
  const slotAt = (x, y) => slotRefs.current.findIndex(el => {
    if (!el) return false
    const r = el.getBoundingClientRect()
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
  })
  function onTilePointerDown(e, idx) {
    if (!top3[idx] || e.button > 0 || e.target.closest('.rv-slot-remove')) return
    dragRef.current = { from: idx, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  function onTilePointerMove(e) {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0
    if (!d.moved && Math.hypot(dx, dy) < 6) return
    d.moved = true
    const over = slotAt(e.clientX, e.clientY)
    setDrag({ from: d.from, dx, dy, over })
  }
  function onTilePointerEnd(e) {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    dragRef.current = null
    setDrag(null)
    if (!d.moved) return
    const over = slotAt(e.clientX, e.clientY)
    if (over < 0 || over === d.from) return
    setTop3(prev => {
      const arr = [...prev]
      const to = Math.min(over, arr.length - 1)
      ;[arr[d.from], arr[to]] = [arr[to], arr[d.from]]
      return arr
    })
    track('top3_reordered', { type: room.type })
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

  const isPlaceRoom = room.type === 'food' || room.type === 'activities'
  // Places have no year, and `{m.year}{rating && ` · …`}` rendered a stray
  // leading " · " for every restaurant. Build the line from what exists.
  const metaLine = m => [
    m.year || null,
    m.rating ? `⭐ ${m.rating}` : null,
    isPlaceRoom ? (m.distance || null) : (m.runtime || null),
  ].filter(Boolean).join(' · ')
  // Places can't be "watched" — the useful action on a result is getting there.
  // Rendered only in results cards; the ranking picker wraps each row in a
  // <button>, where a nested <a> would be invalid markup.
  const directionsLink = m => (isPlaceRoom && (m.lat || m.address)) ? (
    <a
      className="rv-directions"
      href={mapsUrl(m)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => { e.stopPropagation(); track('directions_clicked', { type: room.type }) }}
    >
      📍 Directions
    </a>
  ) : null
  const mapsUrl = m => {
    const q = encodeURIComponent([m.title, m.address].filter(Boolean).join(' '))
    return m.lat && m.lng
      ? `https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${q}`
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
    // With exactly one match there is nothing to compare: the recommendation,
    // "My Top 1" and the partner's top 3 were all the same title, three times.
    const singleMatch = matches.length === 1

    return (
      <div className="rv-page">
        <div className="rv-header"><AppHeader /></div>

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
              sub = isSolo
                ? 'Everything you liked:'
                : playerCount > 2
                  ? `Everything your group of ${playerCount} all agreed on:`
                  : isPlaceRoom
                    ? `Here's everywhere you both want to go:`
                    : `Here's everything you both want to watch:`
            }
            return sub ? <p className="rv-hero-sub">{sub}</p> : null
          })()}
        </div>

        {/* Can't-choose roulette — only useful with 2+ matches */}
        {matches.length >= 2 && (
          <DecideForUs matches={matches} emoji={emoji} seed={room.id} onRolled={() => track('dice_rolled', { type: room.type })} />
        )}

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
                  <span className="rv-reco-meta">{metaLine(m)}</span>
                  <span className="rv-reco-why">{why}</span>
                  <PlatformBadges platforms={m.platforms} title={m.title} roomType={room.type} />
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
        {hasMyPicks && !singleMatch && (
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
                    <span>{metaLine(m)}</span>
                  <PlatformBadges platforms={m.platforms} title={m.title} roomType={room.type} />
                  {directionsLink(m)}
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
        {!isSolo && !rankingsOff && !singleMatch && (() => {
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
                      ? playerCount > 2
                        ? `Combined from ${othersLocked} of ${playerCount - 1}${agoLabel ? ` · ${agoLabel}` : ''}`
                        : `Locked in${agoLabel ? ` · ${agoLabel}` : ''}`
                      : `Waiting for ${playerCount > 2 ? 'the group' : 'your partner'} to lock in…`}
                  </p>
                </div>
                <button
                  className={`rv-refresh ${refreshing ? 'is-busy' : ''}`}
                  onClick={refreshAll}
                  disabled={refreshing}
                  aria-label="Update your partner's status"
                >
                  <Icon name="refresh" size={15} strokeWidth={2.4} />
                  {refreshing ? 'Updating…' : 'Update'}
                </button>
              </div>

              {rankItems.length === 0 ? (
                <p className="rv-empty">
                  {submitted
                    ? `${playerCount > 2 ? 'The group' : 'They'} didn't rank anything.`
                    : `Nothing yet. Tap Update once ${playerCount > 2 ? 'they finish' : 'your partner finishes'} ranking.`}
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
                          <span>{metaLine(m)}</span>
                          <PlatformBadges platforms={m.platforms} title={m.title} roomType={room.type} />
                          {directionsLink(m)}
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
                    <span>{metaLine(m)}</span>
                  <PlatformBadges platforms={m.platforms} title={m.title} roomType={room.type} />
                  {directionsLink(m)}
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

        {/* No picks — just show all matches flat. A lone match lands here too,
            unless the recommendation card above is already showing it. */}
        {matches.length > 0 && (!hasMyPicks || singleMatch) && !recommendation && (
          <div className="rv-match-list">
            {matches.map(m => (
              <div key={m.id} className="rv-result-card">
                <div className="rv-result-card-inner">
                  {m.poster
                    ? <img src={m.poster} alt={m.title} className="rv-result-poster" />
                    : <div className="rv-result-poster rv-result-poster-empty">{emoji}</div>}
                  <div className="rv-result-info">
                    <strong>{m.title}</strong>
                    <span>{metaLine(m)}</span>
                  <PlatformBadges platforms={m.platforms} title={m.title} roomType={room.type} />
                  {directionsLink(m)}
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
          const matchIds = new Set(matches.map(m => m.id))
          const allPartnerItems = (picks?.partnerIds || [])
            .map(id => movies.find(m => m.id === id))
            .filter(Boolean)
          // Matches are already listed above — show only what they liked on their own.
          const partnerItems = allPartnerItems.filter(m => !mutual.has(m.id) && !matchIds.has(m.id))
          const hiddenMatches = allPartnerItems.length - partnerItems.length
          const groupWord = playerCount > 2 ? 'the group' : 'your partner'
          const othersDone = picks?.othersDone || 0
          // Nothing to show and nothing left to wait for — drop the whole block
          // rather than leave an empty section on the results page.
          if (picks != null && othersDone > 0 && (picks.partnerIds || []).length === 0) return null
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
                  <p className="rv-label rv-label--tight">{playerCount > 2 ? 'Also liked by the group' : 'Also liked by your partner'}</p>
                  <p className="rv-partner-status">
                    {status}{agoLabel ? ` · ${agoLabel}` : ''}
                  </p>
                </div>
                {rankingsOff && (
                  <button
                    className={`rv-refresh ${refreshing ? 'is-busy' : ''}`}
                    onClick={refreshAll}
                    disabled={refreshing}
                    aria-label="Update your partner's status"
                  >
                    <Icon name="refresh" size={15} strokeWidth={2.4} />
                    {refreshing ? 'Updating…' : 'Update'}
                  </button>
                )}
              </div>

              {partnerItems.length === 0 ? (
                <p className="rv-empty">
                  {hiddenMatches > 0
                    ? `Everything ${groupWord} liked is already in your matches.`
                    : othersDone > 0
                      ? `${playerCount > 2 ? 'Nobody' : 'They'} didn't pick anything this time.`
                      : `Nothing yet. You'll see picks here as ${groupWord} swipes.`}
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
                          <span>{metaLine(m)}</span>
                          <PlatformBadges platforms={m.platforms} title={m.title} roomType={room.type} />
                          {directionsLink(m)}
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

        {/* Action buttons */}
        <div className="rv-results-actions">
          <button
            className="btn rv-share-btn"
            onClick={handleShare}
            disabled={sharing || matches.length === 0}
          >
            <Icon name="image" size={17} />
            {sharing ? 'Generating…' : 'Share results'}
          </button>
          {matches.length > 0 && (
            <button className="btn rv-share-btn" onClick={() => setPhase('rank')}>
              <Icon name="grip" size={17} />
              {top3.length > 0 ? 'Edit my top 3' : 'Rank my top 3'}
            </button>
          )}
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
  const likedOnly = liked.filter(m => !matches.some(x => x.id === m.id))
  const rankOf = id => top3.findIndex(m => m.id === id) + 1

  return (
    <div className="rv-page">
      <div className="rv-header"><AppHeader /></div>
      <div className="rv-ranking-header">
        <h2>{maxPicks > 0 ? `Pick Your Top ${maxPicks}` : 'Nothing to rank yet'}</h2>
        <p>{maxPicks > 0
          ? `${matches.length} ${isSolo ? (matches.length === 1 ? 'pick' : 'picks') : (matches.length === 1 ? 'match' : 'matches')} · tap to rank${top3.length > 1 ? ' · drag tiles to reorder' : ''}`
          : isSolo ? 'You didn\u2019t swipe right on anything.' : 'You can come back and rank once you match on something.'}</p>
      </div>

      {/* Top 3 slots */}
      <div className="rv-slots">
        {[0, 1, 2].map(i => {
          const dragging = drag?.from === i
          const target = drag && drag.over === i && drag.from !== i && top3[i]
          return (
            <div
              key={i}
              ref={el => { slotRefs.current[i] = el }}
              className={`rv-slot ${top3[i] ? 'rv-slot-filled' : 'rv-slot-empty'} ${target ? 'is-drop-target' : ''}`}
            >
              <span className="rv-slot-num">#{i + 1}</span>
              {top3[i] ? (
                <div
                  className={`rv-slot-content ${dragging ? 'is-dragging' : ''}`}
                  style={dragging ? { transform: `translate(${drag.dx}px, ${drag.dy}px) scale(1.06)` } : undefined}
                  onPointerDown={e => onTilePointerDown(e, i)}
                  onPointerMove={onTilePointerMove}
                  onPointerUp={onTilePointerEnd}
                  onPointerCancel={onTilePointerEnd}
                >
                  {top3[i].poster
                    ? <img src={top3[i].poster} alt={top3[i].title} className="rv-slot-poster" draggable={false} />
                    : <div className="rv-slot-poster rv-slot-poster-empty">{emoji}</div>}
                  <p className="rv-slot-title">{top3[i].title}</p>
                  <button className="rv-slot-remove" onClick={() => toggleItem(top3[i])} aria-label={`Remove ${top3[i].title} from your top 3`}>✕</button>
                </div>
              ) : (
                <div className="rv-slot-placeholder">+</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Matches / picks list */}
      <div className="rv-match-list">
        <p className="rv-label">
          {isSolo ? `✨ Your Picks (${matches.length})`
            : isFallback ? `🔥 Most wanted (${matches.length})`
              : `🤝 Mutual Matches (${matches.length})`}
        </p>
        {isFallback && (
          <p className="rv-selection-note">
            Nobody picked all the same ones, so these are what got the most votes.
          </p>
        )}
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
                <span>{metaLine(m)}</span>
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
      {!isSolo && likedOnly.length > 0 && (
        <div className="rv-match-list rv-my-selection">
          <p className="rv-label">Only you liked ({likedOnly.length})</p>
          <p className="rv-selection-note">Not a match yet. These turn into matches if {playerCount > 2 ? 'everyone else' : 'your partner'} likes them too.</p>
          {likedOnly.map(m => {
            const isMatch = matches.some(x => x.id === m.id)
            return (
              <div key={m.id} className={`rv-match-item rv-selection-item ${isMatch ? 'rv-selection-matched' : ''}`}>
                {m.poster
                  ? <img src={m.poster} alt={m.title} className="rv-match-thumb" />
                  : <div className="rv-match-thumb rv-match-thumb-empty">{emoji}</div>}
                <div className="rv-match-info">
                  <strong>{m.title}</strong>
                  <span>{metaLine(m)}</span>
                  <PlatformBadges platforms={m.platforms} title={m.title} roomType={room.type} />
                  {directionsLink(m)}
                </div>
                {isMatch && <span className="rv-selection-match-badge">✓ Match</span>}
              </div>
            )
          })}
        </div>
      )}

      <div className="rv-footer">
        <button className="btn btn-primary rv-submit" onClick={handleSubmit} disabled={submitting}>
          {top3.length > 0 && !submitting && <Icon name="lock" size={17} strokeWidth={2.4} />}
          {submitting ? 'Saving…' : top3.length > 0 ? `Lock in my top ${top3.length}` : 'Skip & see results'}
        </button>
      </div>
    </div>
  )
}
