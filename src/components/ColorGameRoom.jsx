import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import confetti from 'canvas-confetti'
import HomeLogo from './HomeLogo'
import { getUserToken, recordSwipe, fetchRoomPicks, subscribeToRoomPicks } from '../lib/room'
import { puzzlesForRoom, hslToHex, scoreGuess, scoreVerdict, encodeGuess, decodeGuess, ROUNDS_PER_GAME } from '../lib/colorGame'
import { track } from '../lib/analytics'
import './ColorGameRoom.css'

// One-tap colour wheel: hue around the circle, saturation from centre out.
// Dragging works too (pointer capture). The chosen colour is applied LIVE onto
// the greyscale poster via mix-blend-mode, so you judge it in the image itself.
function ColorWheel({ h, s, onPick }) {
  const ref = useRef(null)
  const pick = (e) => {
    const rect = ref.current.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    const hue = Math.round((Math.atan2(x, -y) * 180 / Math.PI + 360) % 360)
    const sat = Math.round(Math.min(1, Math.sqrt(x * x + y * y) / (rect.width / 2)) * 100)
    onPick(hue, Math.max(8, sat))
  }
  // marker position for current h/s
  const rad = (h - 90) * Math.PI / 180
  const mr = (s / 100) * 50
  const mx = 50 + Math.cos(rad) * mr
  const my = 50 + Math.sin(rad) * mr
  return (
    <div
      ref={ref}
      className="cg-wheel"
      onPointerDown={(e) => { try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* capture unsupported */ } pick(e) }}
      onPointerMove={(e) => { if (e.buttons) pick(e) }}
      role="slider"
      aria-label="Colour wheel"
    >
      <span className="cg-wheel-marker" style={{ left: `${mx}%`, top: `${my}%`, background: hslToHex(h, s, 55) }} />
    </div>
  )
}

// Color Duel — each round shows a desaturated official poster; both players mix
// the colour they remember, then the original is revealed and scored by
// perceptual distance (ΔE). Duel guesses travel over the existing swipes
// channel (encoded item ids), so no extra backend is needed.
export default function ColorGameRoom({ room, onDone, isSolo = false }) {
  const userToken = useRef(getUserToken())
  const puzzles = useMemo(() => puzzlesForRoom(room.id), [room.id])

  const [round, setRound] = useState(0)
  const [finished, setFinished] = useState(false)
  const [h, setH] = useState(180)
  const [s, setS] = useState(80)
  const [l, setL] = useState(55)
  const [myGuesses, setMyGuesses] = useState({})     // round -> hex
  const [theirGuesses, setTheirGuesses] = useState({})

  const guess = hslToHex(h, s, l)
  const puzzle = puzzles[round]

  // Derived round state — no phase machine, so a partner guess arriving via
  // realtime/poll flips "waiting" → "reveal" without any effect-driven setState.
  const hasMine = myGuesses[round] != null
  const revealed = hasMine && (isSolo || theirGuesses[round] != null)
  const waiting = hasMine && !revealed

  // ── Partner guesses: realtime + polling fallback (duel only) ──────────────
  useEffect(() => {
    if (isSolo) return
    let active = true
    const absorb = (itemId) => {
      const g = decodeGuess(itemId)
      if (g) setTheirGuesses(prev => prev[g.round] ? prev : { ...prev, [g.round]: g.hex })
    }
    const check = () => fetchRoomPicks(room.id, userToken.current)
      .then(p => { if (active && p) p.partnerIds.forEach(absorb) })
      .catch(() => {})
    check()
    const unsub = subscribeToRoomPicks(room.id, userToken.current, (swipe) => absorb(swipe.item_id))
    const poll = setInterval(check, 4000)
    return () => { active = false; clearInterval(poll); unsub() }
  }, [isSolo, room.id])

  const lockIn = useCallback(async () => {
    if (myGuesses[round] != null) return
    setMyGuesses(prev => ({ ...prev, [round]: guess }))
    if (!isSolo) {
      try { await recordSwipe(room.id, userToken.current, encodeGuess(round, guess), 'right') }
      catch (err) { console.error('[ColorGame] failed to send guess:', err) }
    }
    track('colorgame_guess', { round, solo: isSolo })
  }, [round, guess, myGuesses, isSolo, room.id])

  const next = useCallback(() => {
    if (round + 1 >= puzzles.length) { setFinished(true); return }
    setRound(r => r + 1)
    setH(180); setS(80); setL(55)
  }, [round, puzzles.length])

  // Celebrate great rounds (side effect only — no state writes)
  useEffect(() => {
    if (!revealed) return
    const sc = scoreGuess(myGuesses[round], puzzles[round].hex)
    if (sc >= 85) confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 } })
  }, [revealed, round]) // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => {
    let mine = 0, theirs = 0, rounds = 0
    for (let i = 0; i < puzzles.length; i++) {
      if (myGuesses[i] == null) continue
      rounds++
      mine += scoreGuess(myGuesses[i], puzzles[i].hex)
      if (theirGuesses[i] != null) theirs += scoreGuess(theirGuesses[i], puzzles[i].hex)
    }
    return { mine, theirs, rounds }
  }, [myGuesses, theirGuesses, puzzles])

  // ── FINAL ─────────────────────────────────────────────────────────────────
  if (finished) {
    const won = totals.mine > totals.theirs
    const tie = totals.mine === totals.theirs
    return (
      <div className="cg-room">
        <div className="cg-header"><HomeLogo /><span className="cg-title">🎨 Color Duel</span><span /></div>
        <div className="cg-final">
          <div className="cg-final-emoji">{isSolo ? '🎨' : tie ? '🤝' : won ? '🏆' : '💐'}</div>
          <h2>{isSolo ? `${totals.mine} / ${puzzles.length * 100}` : tie ? "It's a tie!" : won ? 'You win!' : 'Partner wins!'}</h2>
          {!isSolo && (
            <div className="cg-final-scores">
              <div className={`cg-final-score ${won ? 'is-winner' : ''}`}><span>You</span><strong>{totals.mine}</strong></div>
              <div className={`cg-final-score ${!won && !tie ? 'is-winner' : ''}`}><span>Partner</span><strong>{totals.theirs}</strong></div>
            </div>
          )}
          <div className="cg-final-rounds">
            {puzzles.map((p, i) => (
              <div key={p.id} className="cg-final-round">
                <span className="cg-final-round-title">{p.title}</span>
                <span className="cg-swatch cg-swatch--sm" style={{ background: p.hex }} title="original" />
                {myGuesses[i] && <span className="cg-final-pts">{scoreGuess(myGuesses[i], p.hex)}</span>}
              </div>
            ))}
          </div>
          <button className="btn btn-primary cg-cta" onClick={onDone}>Back to Swaip</button>
          <p className="cg-attrib">Posters via TMDB</p>
        </div>
      </div>
    )
  }

  if (!puzzle) return null
  const myScore = revealed ? scoreGuess(myGuesses[round], puzzle.hex) : null
  const theirScore = revealed && theirGuesses[round] ? scoreGuess(theirGuesses[round], puzzle.hex) : null
  const verdict = revealed ? scoreVerdict(myScore) : null

  return (
    <div className="cg-room">
      <div className="cg-header">
        <HomeLogo />
        <span className="cg-title">🎨 Color Duel</span>
        <span className="cg-progress">{round + 1} / {puzzles.length}</span>
      </div>

      <div className="cg-body">
        <p className="cg-question">
          {revealed ? <strong>{puzzle.title}</strong> : <>What colour is <strong>{puzzle.label}</strong>?</>}
        </p>

        <div className="cg-poster-wrap">
          <img
            src={puzzle.poster}
            alt={revealed ? puzzle.title : 'Mystery poster'}
            className={`cg-poster ${revealed ? '' : 'is-gray'}`}
            draggable={false}
          />
          {/* Live colourise: your current pick painted over the greyscale poster —
              clipped by the puzzle's mask so ONLY the asked-about element (suit,
              skin, logo…) takes the colour; the rest stays greyscale. */}
          {!revealed && (
            <span
              className="cg-poster-tint"
              style={{
                background: guess,
                ...(puzzle.mask && {
                  WebkitMaskImage: `url(${puzzle.mask})`,
                  maskImage: `url(${puzzle.mask})`,
                  WebkitMaskSize: '100% 100%',
                  maskSize: '100% 100%',
                }),
              }}
              aria-hidden="true"
            />
          )}
          {!revealed && <span className="cg-poster-hint">{puzzle.media === 'series' ? '📺' : '🎬'} {puzzle.title}</span>}
        </div>

        {!hasMine && (
          <>
            <div className="cg-pick-row">
              <ColorWheel h={h} s={s} onPick={(nh, ns) => { setH(nh); setS(ns) }} />
              <div className="cg-pick-side">
                <span className="cg-pick-chip" style={{ background: guess }} />
                <input type="range" min="12" max="88" value={l} onChange={e => setL(+e.target.value)}
                  className="cg-slider cg-slider--vert" aria-label="Lightness"
                  style={{ background: `linear-gradient(to right, #000, ${hslToHex(h, s, 50)}, #fff)` }} />
              </div>
            </div>
            <button className="btn btn-primary cg-cta" onClick={lockIn}>Lock in my colour</button>
          </>
        )}

        {waiting && (
          <div className="cg-wait">
            <div className="cg-swatch-row">
              <div className="cg-swatch-col"><span className="cg-swatch" style={{ background: myGuesses[round] }} /><span>Your guess</span></div>
            </div>
            <div className="loader" style={{ margin: '14px auto' }} />
            <p className="cg-wait-text">Waiting for your partner's guess…</p>
          </div>
        )}

        {revealed && (
          <div className="cg-reveal">
            <div className="cg-swatch-row">
              <div className="cg-swatch-col">
                <span className="cg-swatch" style={{ background: myGuesses[round] }} />
                <span>You · <strong>{myScore}</strong></span>
              </div>
              <div className="cg-swatch-col cg-swatch-col--target">
                <span className="cg-swatch cg-swatch--target" style={{ background: puzzle.hex }} />
                <span>Original</span>
              </div>
              {!isSolo && theirGuesses[round] && (
                <div className="cg-swatch-col">
                  <span className="cg-swatch" style={{ background: theirGuesses[round] }} />
                  <span>Partner · <strong>{theirScore}</strong></span>
                </div>
              )}
            </div>
            <p className="cg-verdict">{verdict.emoji} {verdict.text}{!isSolo && theirScore != null && myScore !== theirScore && (
              <span className="cg-verdict-win"> — {myScore > theirScore ? 'you take the round!' : 'partner takes the round!'}</span>
            )}</p>
            <button className="btn btn-primary cg-cta" onClick={next}>
              {round + 1 >= puzzles.length ? 'See final score' : 'Next round'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
