import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { getRoom, getUserToken, recordSwipe, subscribeToSwipes, subscribeToRoomActive, subscribeToRoomPicks, fetchRoomPicks, fetchPartnerSwipeCount, markRoomActive, isRoomSolo, getRoomPlayerCount, DONE_ITEM_ID, MOVIE_SENTINELS } from '../lib/room'
import { PLATFORMS } from '../lib/platforms'
import { fetchTopRatedMovies } from '../lib/tmdb'
import { normalizePrefs } from '../lib/movieFilters'
import { fetchTopRatedSeries } from '../lib/seriesFetch'
import SwipeCard from '../components/SwipeCard'
import MatchModal from '../components/MatchModal'
import ConversationRoom from '../components/ConversationRoom'
import ActivityRoom from '../components/ActivityRoom'
import FoodRoom from '../components/FoodRoom'
import ColorGameRoom from '../components/ColorGameRoom'
import RankingView from '../components/RankingView'
import InvitePanel from '../components/InvitePanel'
import AppHeader from '../components/AppHeader'
import Icon from '../components/Icon'
import { seededShuffle } from '../lib/random'
import { ACTIVITY_CATEGORIES } from '../lib/activities'
import { FOOD_CATEGORIES } from '../lib/foodCategories'
import { track } from '../lib/analytics'
import { isPushSupported, enablePushForRoom, notifyRoom } from '../lib/push'
import './Room.css'

// Centred room states (join, waiting, transitions, errors) share one shell:
// the app header on top, the content centred in the remaining height.
function RoomShell({ children, className = '' }) {
  return (
    <div className="room-page">
      <AppHeader />
      <div className={`room-center ${className}`}>{children}</div>
    </div>
  )
}

// What the invited person is about to do, in plain words.
const JOIN_COPY = {
  movies:        { emoji: '🎬', label: 'Movies',        title: 'Pick a movie together',        desc: 'Say yes to every film you’d happily watch. When you both say yes, it’s a match.', cta: 'Start swiping' },
  series:        { emoji: '📺', label: 'TV Series',     title: 'Pick your next show together', desc: 'Say yes to every show you’d happily binge. When you both say yes, it’s a match.', cta: 'Start swiping' },
  food:          { emoji: '🍽️', label: 'Food & Drinks', title: 'Decide where to eat',          desc: 'Pick what you’re craving, then swipe through real places nearby. When you both say yes, it’s a match.', cta: 'See the options' },
  activities:    { emoji: '🎯', label: 'Activities',    title: 'Find something to do',         desc: 'Pick what you’re in the mood for, then swipe through real places nearby. When you both say yes, it’s a match.', cta: 'See the options' },
  conversations: { emoji: '💬', label: 'Conversations', title: 'Find something to talk about', desc: 'Pick the topics you’d love to talk about. You’ll only see the ones you both chose.', cta: 'See the topics' },
  colorgame:     { emoji: '🎨', label: 'Color Duel',    title: 'Play Color Duel',              desc: 'Posters with the colour drained. Mix the shade you remember, closest guess wins the round.', cta: 'Start guessing' },
}

function parseRoomFilters(raw) {
  const none = { platforms: [], genres: [], region: undefined, prefs: normalizePrefs() }
  if (!raw) return none
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return { ...none, platforms: parsed } // legacy
    return {
      platforms: parsed.platforms || [],
      genres: parsed.genres || [],
      region: parsed.region,
      prefs: normalizePrefs(parsed),
    }
  } catch {
    return none
  }
}

// Per-room progress survives a reload. iOS Safari happily reloads the tab
// after a trip to the share sheet — i.e. right after sending the invite — and
// without this the creator came back as an "invitee" at card 1 with no likes.
const progressKey = id => `swaip_progress_${id}`
function loadProgress(id) {
  try { return JSON.parse(sessionStorage.getItem(progressKey(id)) || 'null') } catch { return null }
}

export default function Room() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [saved] = useState(() => loadProgress(roomId))
  const isCreator = location.state?.isCreator || saved?.creator || false

  const [room, setRoom] = useState(null)
  const [isSolo, setIsSolo] = useState(location.state?.isSolo || false)
  const [movies, setMovies] = useState([])
  const moviesRef = useRef([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [matchItem, setMatchItem] = useState(null)
  const [matches, setMatches] = useState([])
  const [partnerDone, setPartnerDone] = useState(false)
  const [partnerStop, setPartnerStop] = useState(Infinity)  // partner's last-swiped deck position
  const [liked, setLiked] = useState([])
  const [isDone, setIsDone] = useState(false)
  const isDoneRef = useRef(false)
  // Undo: this session's swipes, newest last. Each entry keeps its insert
  // promise so a take-back is always written after the vote it replaces.
  const historyRef = useRef([])
  const [canUndo, setCanUndo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [partnerJoined, setPartnerJoined] = useState(!isCreator || (location.state?.isSolo || false) || Boolean(saved?.started))
  const [partnerJustJoined, setPartnerJustJoined] = useState(false)
  const [hasJoined, setHasJoined] = useState(isCreator || Boolean(saved?.started))
  const [invited, setInvited] = useState(false)       // shared / copied / showed QR at least once
  const [remindSolo, setRemindSolo] = useState(false) // one-time nudge before going solo
  const [pushState, setPushState] = useState('idle')  // idle | enabled | denied
  const [othersProgress, setOthersProgress] = useState(null) // invitee: how many picks the creator already made
  const userToken = useRef(getUserToken())

  useEffect(() => {
    async function init() {
      try {
        const roomData = await getRoom(roomId)
        if (!roomData) {
          setError('Room not found')
          setLoading(false)
          return
        }
        setRoom(roomData)

        // Solo flag can come from room data (for page refreshes) or location state (first load)
        const solo = isRoomSolo(roomData) || (location.state?.isSolo || false)
        setIsSolo(solo)
        if (solo) {
          setPartnerJoined(true)
        }

        const { platforms, genres, region, prefs } = parseRoomFilters(roomData.platforms ?? roomData.topic_id)
        let deck = []
        if (roomData.type === 'movies') {
          deck = await fetchTopRatedMovies(roomData.id, platforms, genres, region, prefs)
        } else if (roomData.type === 'series') {
          deck = await fetchTopRatedSeries(roomData.id, platforms, genres, region)
        }
        setMovies(deck)
        if (saved && deck.length > 0) {
          setCurrentIndex(Math.min(saved.index || 0, deck.length))
          setLiked(deck.filter(m => (saved.liked || []).includes(m.id)))
          if (saved.done) setIsDone(true)
        }
      } catch (err) {
        setError('Failed to load room')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [roomId]) // eslint-disable-line react-hooks/exhaustive-deps -- location.state is a one-shot nav payload, not a reactive dep

  // Detect the partner joining (creator only, non-solo). Realtime fires instantly
  // when the joiner flips the room to 'active'; a slow poll is kept only as a
  // fallback in case a realtime event is missed.
  useEffect(() => {
    if (!isCreator || partnerJoined || isSolo) return
    let fired = false
    let active = true
    const trigger = () => {
      if (fired || !active) return
      fired = true
      setPartnerJustJoined(true)
      setTimeout(() => {
        setPartnerJustJoined(false)
        setPartnerJoined(true)
      }, 2500)
    }
    const unsub = subscribeToRoomActive(roomId, trigger)
    const interval = setInterval(async () => {
      const latest = await getRoom(roomId)
      if (latest?.status === 'active') trigger()
    }, 5000)
    return () => { active = false; unsub(); clearInterval(interval) }
  }, [isCreator, partnerJoined, isSolo, roomId])

  // ── Invite funnel: the invitee just opened the link ──────────────────────
  // 64% of rooms never get a second swiper and today we can't tell whether the
  // link never reached them or they bounced right here. So: log the open, and
  // show live social proof ("your friend already picked 6") while they decide.
  useEffect(() => {
    if (isCreator || hasJoined || !room) return
    track('invite_opened', { type: room.type })
    let active = true
    const sentinels = (room.type === 'movies' || room.type === 'series') ? MOVIE_SENTINELS : undefined
    const load = () => fetchPartnerSwipeCount(roomId, userToken.current, 0, sentinels)
      .then(n => { if (active) setOthersProgress(n) })
      .catch(() => {})
    load()
    const t = setInterval(load, 4000)
    return () => { active = false; clearInterval(t) }
  }, [isCreator, hasJoined, room, roomId])

  // Keep refs in sync so subscription callbacks always see current values
  useEffect(() => { isDoneRef.current = isDone }, [isDone])
  useEffect(() => { moviesRef.current = movies }, [movies])
  const matchesRef = useRef([])
  useEffect(() => { matchesRef.current = matches }, [matches])

  useEffect(() => {
    if (!room || (room.type !== 'movies' && room.type !== 'series') || isSolo) return

    const unsubSwipes = subscribeToSwipes(roomId, userToken.current, (itemId) => {
      const matched = moviesRef.current.find((m) => m.id === itemId)
      if (matched) {
        // Always update real-time matches list (deduped). RankingView also
        // listens and polls, so a match landing after "I'm done" still shows.
        setMatches((prev) => prev.find(m => m.id === matched.id) ? prev : [...prev, matched])
        // Only show match-modal overlay while still actively swiping
        if (!isDoneRef.current) {
          track('match', { type: room.type })
          setMatchItem(matched)
        }
      }
    }, 2, {
      // Partner took back a like with undo: the match is gone for us too.
      isMatched: id => matchesRef.current.some(m => m.id === id),
      onUnmatch: id => {
        setMatches(prev => prev.filter(m => m.id !== id))
        setMatchItem(cur => (cur && cur.id === id ? null : cur))
      },
    })

    return () => unsubSwipes()
  }, [room, roomId, isSolo])

  // Let the still-swiping user know once they reach a card their partner never
  // got to. We flag "done" from the partner's DONE_ITEM_ID sentinel (tap done or
  // deck exhausted), then record how far they'd swiped — the banner only shows
  // once THIS user passes that point (currentIndex >= partnerStop), i.e. exactly
  // at the first card the partner didn't reach.
  useEffect(() => {
    if (isSolo || (room?.type !== 'movies' && room?.type !== 'series')) return
    let active = true
    let handled = false
    const markDone = async () => {
      if (!active || handled) return
      handled = true
      setPartnerDone(true)
      const n = await fetchPartnerSwipeCount(roomId, userToken.current, 0, MOVIE_SENTINELS)
      if (active) setPartnerStop(n)
    }
    const check = () => fetchRoomPicks(roomId, userToken.current, MOVIE_SENTINELS)
      .then(p => { if (p && p.othersDone > 0) markDone() })
      .catch(() => {})
    check() // initial
    const unsub = subscribeToRoomPicks(roomId, userToken.current, (swipe) => {
      if (Number(swipe.item_id) === DONE_ITEM_ID) markDone()
    })
    // Realtime can drop the single DONE event; poll as a fallback until caught.
    const poll = setInterval(() => { if (!handled) check() }, 5000)
    return () => { active = false; clearInterval(poll); unsub() }
  }, [isSolo, room?.type, roomId])

  const handleSwipe = useCallback(
    async (direction) => {
      const movie = movies[currentIndex]
      if (!movie) return

      if (direction === 'right') {
        setLiked((prev) => [...prev, movie])
      }
      // Advance immediately — the next card shouldn't wait on the network, and
      // leaving the old card up until the insert returns invited double swipes.
      setCurrentIndex((i) => i + 1)
      const entry = { index: currentIndex, movie, direction, pending: null, undone: false }
      historyRef.current.push(entry)
      setCanUndo(true)

      if (!isSolo) {
        try {
          entry.pending = recordSwipe(roomId, userToken.current, movie.id, direction)
          const isMatch = await entry.pending
          if (isMatch && !entry.undone) {
            track('match', { type: room.type })
            notifyRoom(roomId, 'match', { from: userToken.current, itemId: movie.id })
            setMatchItem(movie)
            setMatches((prev) => prev.find(m => m.id === movie.id) ? prev : [...prev, movie])
          }
        } catch (err) {
          console.error('Failed to record swipe:', err)
        }
      }
    },
    [movies, currentIndex, roomId, isSolo, room?.type]
  )

  // Step back one card. Taking back a like writes a newer 'left' vote (swipes
  // are append-only), so a match that like created disappears for both.
  const handleUndo = useCallback(async () => {
    const last = historyRef.current.pop()
    setCanUndo(historyRef.current.length > 0)
    if (!last) return
    last.undone = true
    setCurrentIndex(last.index)
    track('swipe_undo', { type: room?.type || 'movies', direction: last.direction })
    if (last.direction !== 'right') return
    setLiked(prev => prev.filter(m => m.id !== last.movie.id))
    setMatches(prev => prev.filter(m => m.id !== last.movie.id))
    if (isSolo) return
    try {
      await last.pending?.catch(() => {})
      await recordSwipe(roomId, userToken.current, last.movie.id, 'left')
    } catch (err) {
      console.error('Failed to take back a like:', err)
    }
  }, [isSolo, roomId, room?.type])

  // Tell the room this user finished swiping (sentinel row, ignored as a pick).
  // Lets the partner's results screen show "finished" vs "still swiping".
  const doneSignalledRef = useRef(false)
  const signalDone = useCallback(async () => {
    if (isSolo || doneSignalledRef.current) return
    doneSignalledRef.current = true
    track('swiping_done', { type: room?.type || 'movies', swiped: currentIndex, matches: matches.length })
    try { await recordSwipe(roomId, userToken.current, DONE_ITEM_ID, 'right') }
    catch (err) { console.error('Failed to signal done:', err) }
  }, [isSolo, roomId, currentIndex, matches.length, room?.type])

  // Deck exhausted counts as finished too.
  useEffect(() => {
    if (!isSolo && movies.length > 0 && currentIndex >= movies.length) signalDone()
  }, [isSolo, movies.length, currentIndex, signalDone])

  useEffect(() => {
    if (!room) return
    try {
      sessionStorage.setItem(progressKey(roomId), JSON.stringify({
        creator: isCreator,
        started: partnerJoined || hasJoined,
        index: currentIndex,
        liked: liked.map(m => m.id),
        done: isDone,
      }))
    } catch { /* storage blocked — progress just won't survive a reload */ }
  }, [room, roomId, isCreator, partnerJoined, hasJoined, currentIndex, liked, isDone])

  if (loading) {
    return (
      <div className="room-skeleton">
        <div className="skeleton skel-card" />
        <div className="skeleton skel-line skel-line--title" />
        <div className="skeleton skel-line skel-line--meta" />
        <div className="skel-chips">
          <div className="skeleton skel-chip" />
          <div className="skeleton skel-chip" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <RoomShell>
        <p className="error-text">{error}</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          Go Home
        </button>
      </RoomShell>
    )
  }

  // Joiner welcome screen — the first thing an invited person ever sees of
  // Swaip, so it says what the app is, what happens next, and shows the deck.
  if (!isCreator && !hasJoined) {
    const info = JOIN_COPY[room.type] || JOIN_COPY.movies
    const group = getRoomPlayerCount(room) > 2
    const teaser = (room.type === 'movies' || room.type === 'series')
      ? movies.slice(0, 3).filter(m => m.poster)
      : []
    const tiles = room.type === 'food'
      ? seededShuffle(FOOD_CATEGORIES, room.id).slice(0, 3)
      : room.type === 'activities'
        ? seededShuffle(ACTIVITY_CATEGORIES, room.id).slice(0, 3)
        : []
    const join = () => { markRoomActive(roomId); notifyRoom(roomId, 'joined', { from: userToken.current }); track('joined', { type: room.type }); setHasJoined(true) }

    return (
      <RoomShell className="join-center">
        <div className="join-screen">
          {teaser.length === 3 ? (
            <div className="join-posters" aria-hidden="true">
              {teaser.map((m, i) => (
                <img key={m.id} src={m.poster} alt="" className={`join-poster join-poster--${i}`} width="120" height="180" />
              ))}
            </div>
          ) : tiles.length === 3 ? (
            <div className="join-posters" aria-hidden="true">
              {tiles.map((c, i) => (
                <div key={c.id} className={`join-poster join-tile join-poster--${i}`} style={{ background: c.gradient }}>
                  <span className="join-tile-emoji">{c.emoji}</span>
                  <span className="join-tile-label">{c.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="join-icon" aria-hidden="true">{info.emoji}</div>
          )}
          <p className="join-invited">{group ? 'You’ve been invited to a group' : 'Your friend invited you'}</p>
          <h1 className="join-title">{info.title}</h1>
          <p className="join-desc">{info.desc}</p>
          <ol className="join-steps">
            <li><span>1</span>You swipe on your phone</li>
            <li><span>2</span>{group ? 'Everyone swipes on theirs' : 'They swipe on theirs'}</li>
            <li><span>3</span>You see what you agree on</li>
          </ol>
          {othersProgress > 0 && (
            <p className="join-progress">
              {group ? 'The group has' : 'Your friend has'} already made <strong>{othersProgress}</strong> {othersProgress === 1 ? 'pick' : 'picks'}
            </p>
          )}
          <button className="btn btn-primary join-btn" onClick={join}>
            {info.cta} <Icon name="arrowRight" size={18} strokeWidth={2.4} />
          </button>
          <p className="join-fine">Free · No sign-up · About two minutes</p>
        </div>
      </RoomShell>
    )
  }

  // Partner just joined — show transition screen to creator
  if (partnerJustJoined) {
    return (
      <RoomShell>
        <div className="partner-joined">
          <div className="partner-joined-icon">🎉</div>
          <h2>Your friend joined!</h2>
          <p>Starting now…</p>
          <div className="partner-joined-bar"><div className="partner-joined-fill" /></div>
        </div>
      </RoomShell>
    )
  }

  // Creator waiting for partner — one primary action (send the invite), two
  // equal secondary ones inside InvitePanel, then quiet text options.
  if (isCreator && !partnerJoined) {
    const pc = getRoomPlayerCount(room)
    const category = room.type === 'movies' ? '🎬 Movies' : room.type === 'series' ? '📺 TV Series' : room.type === 'activities' ? '🎯 Activities' : room.type === 'food' ? '🍽️ Food & Drinks' : room.type === 'colorgame' ? '🎨 Color Duel' : `💬 ${room.topic_name}`
    return (
      <RoomShell>
        <div className="waiting">
          <div className="waiting-category">{category}</div>
          <div className="waiting-pulse" aria-hidden="true"><span></span><span></span><span></span></div>
          <h1 className="waiting-title">{pc > 2 ? 'Waiting for your group' : 'Waiting for your partner'}</h1>
          <p className="waiting-sub">
            {pc > 2 ? 'Send everyone the link. You all swipe the same deck.' : 'Send them the link. You both swipe the same deck.'}
          </p>
          <InvitePanel roomId={roomId} type={room.type} onInteract={() => setInvited(true)} />

          <div className="waiting-quiet">
            {isPushSupported() && pushState !== 'enabled' && (
              <button
                className="waiting-text-btn"
                onClick={async () => {
                  const result = await enablePushForRoom(roomId, userToken.current)
                  setPushState(result === 'enabled' ? 'enabled' : result)
                  if (result === 'enabled') track('push_enabled', { type: room.type })
                }}
              >
                <Icon name="bell" size={16} />
                {pushState === 'denied' ? 'Notifications are blocked in your browser' : 'Notify me when they join'}
              </button>
            )}
            {pushState === 'enabled' && (
              <p className="push-enabled-note"><Icon name="check" size={15} /> We’ll ping you, feel free to close this tab.</p>
            )}
            {remindSolo && !invited && (
              <p className="skip-wait-reminder">Don’t forget to send the link to your partner.</p>
            )}
            <button
              className="waiting-text-btn"
              onClick={() => {
                // First tap without ever sharing → gently remind, don't start yet.
                if (!invited && !remindSolo) { setRemindSolo(true); return }
                setPartnerJoined(true)
              }}
            >
              {remindSolo && !invited ? 'Start solo anyway' : 'Start swiping on my own'}
              <Icon name="arrowRight" size={16} />
            </button>
          </div>
        </div>
      </RoomShell>
    )
  }

  // Conversation mode
  if (room.type === 'conversations') {
    return <ConversationRoom room={room} onDone={() => navigate('/')} isSolo={isSolo} />
  }

  // Activities mode
  if (room.type === 'activities') {
    return <ActivityRoom room={room} onDone={() => navigate('/')} isSolo={isSolo} />
  }

  // Food mode
  if (room.type === 'food') {
    return <FoodRoom room={room} onDone={() => navigate('/')} isSolo={isSolo} />
  }

  // Color Duel mini-game
  if (room.type === 'colorgame') {
    return <ColorGameRoom room={room} onDone={() => navigate('/')} isSolo={isSolo} />
  }

  if (isDone || currentIndex >= movies.length) {
    // Show the ranking straight away with what we already know; RankingView
    // reconciles with the database in the background.
    const matchesToShow = isSolo ? liked : matches
    return <RankingView matches={matchesToShow} liked={liked} room={room} movies={movies} onDone={() => navigate('/')} isSolo={isSolo} />
  }

  // Movie mode — swipe UI
  const currentMovie = movies[currentIndex]

  return (
    <div className="room">
      <AppHeader className="room-app-header">
        {isSolo ? (
          liked.length > 0 && (
            <span className="room-matches">
              {liked.length} pick{liked.length !== 1 ? 's' : ''}
            </span>
          )
        ) : (
          matches.length > 0 && (
            <span className="room-matches">
              {matches.length} match{matches.length !== 1 ? 'es' : ''}
            </span>
          )
        )}
        <span className="room-progress">{currentIndex + 1} / {movies.length}</span>
      </AppHeader>

      {partnerDone && !isSolo && currentIndex >= partnerStop && (
        <div className="room-banner">
          <div className="partner-done-banner">
            <span className="partner-done-dot" aria-hidden="true" />
            Your partner finished swiping
          </div>
        </div>
      )}

      <div className="room-cards">
        <SwipeCard
          key={currentMovie.id}
          item={currentMovie}
          onSwipe={handleSwipe}
          onUndo={handleUndo}
          canUndo={canUndo}
          active
        />
      </div>

      <div className="room-footer">
        <button className="done-early-btn" onClick={() => {
          // Results open immediately; the "done" marker is written in the background.
          if (!isSolo) signalDone()
          setIsDone(true)
        }}>
          {isSolo
            ? `I'm done · ${liked.length} pick${liked.length !== 1 ? 's' : ''}`
            : `I'm done swiping${matches.length > 0 ? ` · ${matches.length} match${matches.length !== 1 ? 'es' : ''}` : ''}`}
        </button>
      </div>

      {matchItem && !isSolo && (
        <MatchModal
          item={matchItem}
          roomType={room.type}
          swipeCount={currentIndex}
          matchCount={matches.length}
          onContinue={() => setMatchItem(null)}
          onDone={() => {
            setMatchItem(null)
            signalDone()
            setIsDone(true)
          }}
        />
      )}
    </div>
  )
}
