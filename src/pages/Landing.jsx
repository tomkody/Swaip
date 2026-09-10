import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import HamburgerMenu from '../components/HamburgerMenu'
import SavedMatchesDrawer from '../components/SavedMatchesDrawer'
import Footer from '../components/Footer'
import { track } from '../lib/analytics'
import './Landing.css'

const CATEGORIES = [
  { to: '/create/movies',        label: 'Movies' },
  { to: '/create/series',        label: 'Series' },
  { to: '/create/food',          label: 'Food & drinks' },
  { to: '/create/activities',    label: 'Activities' },
  { to: '/create/conversations', label: 'Conversations' },
]

const STEPS = [
  { title: 'Pick your mood',     desc: 'Movies, a series, dinner, something to do — choose what tonight is about.' },
  { title: 'Invite your person', desc: 'Send one link. No sign-up on either side; you each swipe on your own phone.' },
  { title: 'Swipe into a plan',  desc: 'When you both swipe right on the same thing, it’s a match. That’s the plan.' },
]

// Hero photograph slot. The design calls for a wide cinematic photo (home
// movie night blending into a restaurant table). Nothing with usage rights is
// in the repo yet, so this stays null and a gradient stands in. To wire the
// final asset: drop it in public/landing/ and set
//   { src: '/landing/hero.jpg', mobile: '/landing/hero-mobile.jpg' }
const HERO_IMAGE = null

// Demo deck for the hero card: three titles from the bundled catalog (same
// posters the app itself shows). Purely local state — nothing is written.
const DEMO = [
  { title: 'The Grand Budapest Hotel', meta: 'Comedy · Adventure · 2014', poster: 'https://m.media-amazon.com/images/M/MV5BMzM5NjUxOTEyMl5BMl5BanBnXkFtZTgwNjEyMDM0MDE@._V1_QL75_UX500' },
  { title: 'Amélie',                   meta: 'Comedy · Romance · 2001',   poster: 'https://m.media-amazon.com/images/M/MV5BOTNmYzY0MWQtZGZmNy00Y2Y4LWFmMDQtMTZjYTdiYzEwZGQ2XkEyXkFqcGc@._V1_QL75_UX500' },
  { title: 'Ratatouille',              meta: 'Animation · Comedy · 2007', poster: 'https://m.media-amazon.com/images/M/MV5BMTMzODU0NTkxMF5BMl5BanBnXkFtZTcwMjQ4MzMzMw@@._V1_QL75_UX500' },
]

function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export default function Landing() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Theme: honour a saved choice; first-time visitors get the dark landing.
  // Only persist when the user actually toggles, so we never overwrite a
  // choice they haven't made.
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('swaip-theme')
    return saved ? saved === 'dark' : true
  })
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [dark])
  const toggleDark = () => {
    const next = !dark
    localStorage.setItem('swaip-theme', next ? 'dark' : 'light')
    setDark(next)
  }

  // ── Hero demo card (local only) ──────────────────────────────────────────
  const [demoIdx, setDemoIdx] = useState(0)
  const [demoOut, setDemoOut] = useState(null)     // 'left' | 'right' while the card flies off
  const [demoStatus, setDemoStatus] = useState('')
  const demoTimer = useRef(null)
  useEffect(() => () => clearTimeout(demoTimer.current), [])

  function demoSwipe(dir) {
    if (demoOut) return
    const item = DEMO[demoIdx]
    setDemoStatus(dir === 'right'
      ? `You liked ${item.title}. In a real room, it’s a match once your partner likes it too.`
      : `You passed on ${item.title}.`)
    track('landing_demo_swipe', { dir })
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) { setDemoIdx(i => (i + 1) % DEMO.length); return }
    setDemoOut(dir)
    demoTimer.current = setTimeout(() => {
      setDemoOut(null)
      setDemoIdx(i => (i + 1) % DEMO.length)
    }, 260)
  }

  const cta = where => track('landing_cta', { where })
  const demo = DEMO[demoIdx]

  return (
    <div className={`lp ${dark ? '' : 'lp--light'}`}>
      <header className="lp-header">
        <div className="lp-container lp-header-inner">
          <Link to="/" className="lp-brand" aria-label="Swaip — home">
            <img src="/swaip-icon-transparent.png" alt="" width="34" height="34" />
            <span>Swaip</span>
          </Link>
          <nav className="lp-nav" aria-label="Primary">
            <a className="lp-nav-link" href="#how">How it works</a>
            <a className="lp-nav-link" href="#explore">Explore</a>
          </nav>
          <div className="lp-header-actions">
            <a className="lp-btn lp-btn--sm" href="#explore" onClick={() => cta('header')}>Start a room</a>
            <HamburgerMenu dark={dark} onToggleDark={toggleDark} onSavedMatches={() => setDrawerOpen(true)} />
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="lp-hero" aria-labelledby="lp-hero-title">
          <div className="lp-hero-media" aria-hidden="true">
            <div className="lp-hero-fallback" />
            {HERO_IMAGE && (
              <picture>
                {HERO_IMAGE.mobile && <source media="(max-width: 640px)" srcSet={HERO_IMAGE.mobile} />}
                <img className="lp-hero-photo" src={HERO_IMAGE.src} alt="" fetchPriority="high" />
              </picture>
            )}
            <div className="lp-hero-shade" />
          </div>

          <div className="lp-container lp-hero-inner">
            <p className="lp-eyebrow">Good plans. Better company.</p>
            <h1 id="lp-hero-title" className="lp-h1">Make tonight<br />a shared <em>yes.</em></h1>
            <p className="lp-sub">A film worth watching. A table worth sharing. Find something you both want to do.</p>
            <div className="lp-hero-cta">
              <a className="lp-btn lp-btn--lg" href="#explore" onClick={() => cta('hero')}>Find our plan <Arrow /></a>
              <p className="lp-fineprint">No sign-up. Send a link. Start swiping.</p>
            </div>

            <div className="lp-demo">
              <div className={`lp-card ${demoOut ? `is-out-${demoOut}` : ''}`}>
                <div className="lp-card-poster">
                  <img key={demo.poster} src={demo.poster} alt={`${demo.title} poster`} width="300" height="450" loading="eager" decoding="async" />
                  <div className="lp-card-caption">
                    <p className="lp-card-title">{demo.title}</p>
                    <p className="lp-card-meta">{demo.meta}</p>
                  </div>
                </div>
              </div>
              <div className="lp-card-actions">
                <button type="button" className="lp-card-btn lp-card-btn--no" onClick={() => demoSwipe('left')} aria-label={`Pass on ${demo.title}`}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
                <button type="button" className="lp-card-btn lp-card-btn--yes" onClick={() => demoSwipe('right')} aria-label={`Like ${demo.title}`}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                </button>
              </div>
              <p className="lp-demo-note">Interactive preview · demo titles only, nothing is saved</p>
              <p className="lp-demo-status" aria-live="polite">{demoStatus}</p>
            </div>
          </div>
        </section>

        {/* ── Categories ───────────────────────────────────────────────── */}
        <section id="explore" className="lp-explore" aria-labelledby="lp-explore-title">
          <div className="lp-container">
            <p className="lp-eyebrow">Start here</p>
            <h2 id="lp-explore-title" className="lp-h2 lp-h2--sm">What are we deciding?</h2>
            <p className="lp-section-sub">Pick a category to open a room. You’ll set the details on the next screen.</p>
            <nav className="lp-cats" aria-label="Categories">
              {CATEGORIES.map(c => (
                <Link key={c.to} to={c.to} className="lp-cat" onClick={() => cta(`category:${c.label}`)}>
                  {c.label}
                </Link>
              ))}
            </nav>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────── */}
        <section id="how" className="lp-how" aria-labelledby="lp-how-title">
          <div className="lp-container">
            <h2 id="lp-how-title" className="lp-h2">From ‘I don’t know’ to ‘let’s go’.</h2>
            <ol className="lp-steps">
              {STEPS.map((s, i) => (
                <li key={s.title} className="lp-step">
                  <span className="lp-step-num" aria-hidden="true">0{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Product explanation ──────────────────────────────────────── */}
        <section className="lp-explain" aria-labelledby="lp-explain-title">
          <div className="lp-container lp-explain-grid">
            <div className="lp-explain-copy">
              <h2 id="lp-explain-title" className="lp-h2 lp-h2--left">A little less back-and-forth.</h2>
              <p className="lp-explain-lead">Your picks. Your shared possibilities.</p>
              <p className="lp-explain-body">
                Set the room up once — together or solo, the platforms you actually have, the genres you’re in the mood for. Then send the link and swipe apart. Swaip only shows you what you both said yes to.
              </p>
              <p className="lp-visually-hidden">
                Preview of the room setup: choose Together or Solo, pick platforms and genres, then share your link.
              </p>
              <Link to="/create/movies" className="lp-btn lp-btn--lg" onClick={() => cta('explain')}>Create your room <Arrow /></Link>
            </div>

            <div className="lp-panel" aria-hidden="true">
              <p className="lp-panel-label">Preview · room setup</p>
              <div className="lp-modes">
                <div className="lp-mode is-on">
                  <span className="lp-mode-icon">👥</span>
                  <span><strong>Pick together</strong><span>Share a link and match on what you both want</span></span>
                </div>
                <div className="lp-mode">
                  <span className="lp-mode-icon">👤</span>
                  <span><strong>Pick solo</strong><span>Just you — swipe at your own pace</span></span>
                </div>
              </div>
              <div className="lp-filters">
                <span className="lp-filter">🍿 Comedy <Chevron /></span>
                <span className="lp-filter">🎬 Adventure <Chevron /></span>
                <span className="lp-filter">📺 Netflix <Chevron /></span>
              </div>
              <p className="lp-panel-label lp-panel-label--mt">Then · your invite</p>
              <div className="lp-invite">
                <span className="lp-invite-url">swaip.app/room/<span className="lp-invite-id">your-room</span></span>
                <span className="lp-invite-tag">Link ready once you create a room</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────────── */}
        <section className="lp-final" aria-labelledby="lp-final-title">
          <div className="lp-container">
            <h2 id="lp-final-title" className="lp-h2">Good company. Great choice.</h2>
            <a className="lp-btn lp-btn--lg" href="#explore" onClick={() => cta('final')}>Start swiping <Arrow /></a>
          </div>
        </section>
      </main>

      <div className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-brand">
            <img src="/swaip-icon-transparent.png" alt="" width="26" height="26" />
            <span>Swaip</span>
          </div>
          <Footer />
        </div>
      </div>

      <SavedMatchesDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}
