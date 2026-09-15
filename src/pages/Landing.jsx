import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import HamburgerMenu from '../components/HamburgerMenu'
import SavedMatchesDrawer from '../components/SavedMatchesDrawer'
import Footer from '../components/Footer'
import { track } from '../lib/analytics'
import { prefersReducedMotion } from '../lib/motion'
import './Landing.css'

// Category cards, same composition as the original homepage: the two
// catalogue-backed picks lead as coral tiles, the beta rooms follow on
// neutral cards. `tone` keys the icon tile colour.
const CATEGORIES = [
  { to: '/create/movies',        label: 'Movies',        desc: "Find a film you'll both love",        emoji: '🍿', primary: true },
  { to: '/create/series',        label: 'TV Series',     desc: 'Find your next binge-watch',          emoji: '📺', primary: true },
  { to: '/create/activities',    label: 'Activities',    desc: 'Discover fun things to do nearby',    emoji: '🎯', tone: 'activities', beta: true },
  { to: '/create/food',          label: 'Food & Drinks', desc: 'Find where to eat or grab a drink',   emoji: '🍽️', tone: 'food',       beta: true },
  { to: '/create/conversations', label: 'Conversations', desc: 'Questions that spark a real talk',    emoji: '💬', tone: 'convo',      beta: true, wide: true },
]

// Hero photograph slot. The design calls for a wide cinematic photo (home
// movie night blending into a restaurant table). Nothing with usage rights is
// in the repo yet, so this stays null and a gradient stands in. To wire the
// final asset: drop it in public/landing/ and set
//   { src: '/landing/hero.jpg', mobile: '/landing/hero-mobile.jpg' }
const HERO_IMAGE = null

// Hero demo: a three-card stack that plays itself on load — a film, a
// series and a place, each swiped right with its own stamp — so the principle
// is visible in a few seconds without a big interactive card. Posters come
// from the bundled catalog; the two place photos are local files.
const DEMO = [
  { title: 'Forrest Gump',        meta: 'Film · Drama · 1994',          stamp: 'Want to watch',       poster: 'https://m.media-amazon.com/images/M/MV5BNDYwNzVjMTItZmU5YS00YjQ5LTljYjgtMjY2NDVmYWMyNWFmXkEyXkFqcGc@._V1_QL75_UX500' },
  { title: 'Breaking Bad',        meta: 'Series · Drama · 2008',        stamp: 'Want to watch',       poster: 'https://m.media-amazon.com/images/M/MV5BMzU5ZGYzNmQtMTdhYy00OGRiLTg0NmQtYjVjNzliZTg1ZGE4XkEyXkFqcGc@._V1_QL75_UX500.jpg' },
  // One pass so the demo shows both directions: Dexter goes left with the
  // red NOPE-style stamp the app uses.
  { title: 'Dexter',              meta: 'Series · Crime · 2006',        stamp: "Don't want to watch", no: true, poster: 'https://m.media-amazon.com/images/M/MV5BNTE5ZGI2N2UtYmFiMi00ZGIxLWI1ZTMtYWJkZDYxNDZiOTQwXkEyXkFqcGc@._V1_QL75_UX500.jpg' },
  // Local photo slots — drop the files at these paths in public/landing/.
  // Until a file exists the card shows a tinted tile with the emoji.
  { title: 'Restaurant U Prince', meta: 'Place · Restaurant · Prague', stamp: 'Want to visit',       poster: '/landing/u-prince.jpg',      emoji: '🍽️', focus: '50% 55%' },
  { title: 'Prague Castle',       meta: 'Place · Landmark · Prague',   stamp: 'Want to visit',       poster: '/landing/prague-castle.jpg', emoji: '🏰', focus: '35% 35%' },
]

// Timeline per card (ms): card settles → stamp pops → card flies off → next.
// After the last card an "It's a match" pill shows and the deck refills. On
// phones (stacked layout) it plays DEMO_PLAYS time(s), then the block collapses
// and unmounts so it doesn't linger under the CTA. On wide screens it sits
// beside the copy and simply loops.
const DEMO_T = { stamp: 1100, out: 1000, next: 480, done: 1800, refill: 700, hide: 650 }
const DEMO_PLAYS = 1

// Demo poster; if the image can't load (e.g. the local slot is still empty)
// the card shows a tinted tile with the item's emoji instead of a broken image.
function DemoPoster({ item, eager }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <div className="lp-card-noimg" aria-hidden="true">{item.emoji || '🎬'}</div>
  return (
    <img
      src={item.poster} alt="" width="200" height="300"
      loading={eager ? 'eager' : 'lazy'} decoding="async"
      style={item.focus ? { objectPosition: item.focus } : undefined}
      onError={() => setFailed(true)}
    />
  )
}

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

  // ── Hero demo (self-playing, decorative) ────────────────────────────────
  // stage: 'in' → 'stamp' → 'out' per card; 'done' after the last card;
  // 'refill' brings the stack back for another play; 'hide' collapses the
  // block; 'removed' takes it out of the DOM.
  const [demoActive, setDemoActive] = useState(0)
  const [demoStage, setDemoStage] = useState('in')
  const [demoPlays, setDemoPlays] = useState(1)
  const [demoLoop] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(min-width: 1024px)').matches)
  const [demoStatic] = useState(() => prefersReducedMotion())   // static stack, stamp visible, nothing moves
  useEffect(() => {
    if (demoStatic) return
    if (demoStage === 'removed') return
    const wait = { in: DEMO_T.stamp, stamp: DEMO_T.out, out: DEMO_T.next, done: DEMO_T.done, refill: DEMO_T.refill, hide: DEMO_T.hide }[demoStage]
    const t = setTimeout(() => {
      if (demoStage === 'in') setDemoStage('stamp')
      else if (demoStage === 'stamp') setDemoStage('out')
      else if (demoStage === 'out') {
        if (demoActive + 1 < DEMO.length) { setDemoActive(a => a + 1); setDemoStage('in') }
        else setDemoStage('done')
      }
      else if (demoStage === 'done') {
        if (demoLoop || demoPlays < DEMO_PLAYS) { setDemoPlays(n => n + 1); setDemoActive(0); setDemoStage('refill') }
        else setDemoStage('hide')
      }
      else if (demoStage === 'refill') setDemoStage('in')
      else setDemoStage('removed')
    }, wait)
    return () => clearTimeout(t)
  }, [demoActive, demoStage, demoPlays, demoLoop, demoStatic])

  const demoPressed = demoStage === 'stamp' || demoStage === 'out'

  const cta = where => track('landing_cta', { where })

  return (
    <div className={`lp ${dark ? '' : 'lp--light'}`}>
      <header className="lp-header">
        <div className="lp-container lp-header-inner">
          <Link to="/" className="lp-brand" aria-label="Swaip — home">
            <img src={dark ? '/swaip-icon-dark.png' : '/swaip-icon-transparent.png'} alt="" width="34" height="34" />
            <span>Swaip</span>
          </Link>
          <nav className="lp-nav" aria-label="Primary">
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
        <section className={`lp-hero ${demoStage === 'removed' ? 'lp-hero--no-demo' : ''}`} aria-labelledby="lp-hero-title">
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
            <div className="lp-hero-copy">
            <p className="lp-eyebrow">Good plans. Better company.</p>
            <h1 id="lp-hero-title" className="lp-h1">Make tonight <br />a shared <em>yes.</em></h1>
            <p className="lp-sub">A film worth watching. A table worth sharing. Find something you both want to do.</p>
            <div className="lp-hero-cta">
              <a className="lp-btn lp-btn--lg" href="#explore" onClick={() => cta('hero')}>Find our plan <Arrow /></a>
              <p className="lp-fineprint">No sign-up. Send a link. Start swiping.</p>
            </div>
            </div>

            {demoStage !== 'removed' && (
            <div className={`lp-demo-wrap ${demoStage === 'hide' ? 'is-hidden' : ''}`}>
            <div className={`lp-demo ${demoStage === 'done' || demoStage === 'hide' ? 'is-done' : ''} ${demoStage === 'refill' ? 'is-refill' : ''}`} aria-hidden="true">
              <div className="lp-stack">
                {DEMO.map((d, i) => {
                  const rel = i - demoActive
                  const settled = demoStage === 'done' || demoStage === 'hide' || demoStage === 'refill'
                  const gone = settled || rel < 0
                  const top = rel === 0 && !settled
                  const cls = [
                    'lp-card',
                    gone ? 'is-gone' : '',
                    top ? 'is-top' : '',
                    top && (demoStage === 'stamp' || demoStage === 'out' || demoStatic) ? 'is-stamped' : '',
                    top && demoStage === 'out' ? (d.no ? 'is-out-left' : 'is-out') : '',
                    d.no ? 'lp-card--no' : '',
                    rel > 0 ? `is-behind-${Math.min(rel, 2)}` : '',
                  ].join(' ')
                  return (
                    <div key={d.title} className={cls}>
                      <div className="lp-card-poster">
                        <DemoPoster item={d} eager={i === 0} />
                        <div className="lp-card-caption">
                          <p className="lp-card-title">{d.title}</p>
                          <p className="lp-card-meta">{d.meta}</p>
                        </div>
                        <span className={`lp-card-stamp ${d.no ? 'lp-card-stamp--no' : ''}`}>
                          <span className="lp-card-stamp-heart">{d.no ? '❌' : '❤️'}</span> {d.stamp}
                        </span>
                      </div>
                    </div>
                  )
                })}
                <div className="lp-match-pill">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                  It’s a match
                </div>
              </div>
              <div className="lp-card-actions">
                <span className={`lp-card-btn lp-card-btn--no ${demoPressed && DEMO[demoActive]?.no ? 'is-pressed' : ''}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </span>
                <span className={`lp-card-btn lp-card-btn--yes ${demoPressed && !DEMO[demoActive]?.no ? 'is-pressed' : ''}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                </span>
              </div>
            </div>
            </div>
            )}
            <p className="lp-visually-hidden">Swipe right on a film, a series or a place you want. When your partner swipes right too, it’s a match.</p>
          </div>
        </section>

        {/* ── Categories ───────────────────────────────────────────────── */}
        <section id="explore" className="lp-explore" aria-labelledby="lp-explore-title">
          <div className="lp-container">
            <p className="lp-eyebrow">Start here</p>
            <h2 id="lp-explore-title" className="lp-h2 lp-h2--sm">What are we deciding?</h2>
            <p className="lp-section-sub">Pick a category to open a room. You’ll set the details on the next screen.</p>
            <nav className="lp-catgrid" aria-label="Categories">
              {CATEGORIES.map(c => (
                <Link
                  key={c.to}
                  to={c.to}
                  className={`lp-catcard ${c.primary ? 'lp-catcard--primary' : ''} ${c.wide ? 'lp-catcard--wide' : ''}`}
                  onClick={() => cta(`category:${c.label}`)}
                >
                  {c.beta && <span className="lp-catcard-beta">Beta</span>}
                  <span className={`lp-catcard-emoji ${c.tone ? `lp-catcard-emoji--${c.tone}` : ''}`} aria-hidden="true">{c.emoji}</span>
                  <span className="lp-catcard-text">
                    <span className="lp-catcard-name">{c.label}</span>
                    <span className="lp-catcard-desc">{c.desc}</span>
                  </span>
                </Link>
              ))}
            </nav>
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
                Preview of the room setup: choose Together or Solo, then pick platforms and genres.
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
            </div>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────────── */}
        <section className="lp-final" aria-labelledby="lp-final-title">
          <div className="lp-container">
            <h2 id="lp-final-title" className="lp-h2">“I don’t mind, you pick.”<br />Never again.</h2>
            <p className="lp-final-sub">Forty minutes of scrolling, or forty seconds of swiping. Your call.</p>
            <a className="lp-btn lp-btn--lg" href="#explore" onClick={() => cta('final')}>Start swiping <Arrow /></a>
          </div>
        </section>
      </main>

      <div className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-brand">
            <img src={dark ? '/swaip-icon-dark.png' : '/swaip-icon-transparent.png'} alt="" width="26" height="26" />
            <span>Swaip</span>
          </div>
          <Footer />
        </div>
      </div>

      <SavedMatchesDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}
