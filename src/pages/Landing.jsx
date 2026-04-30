import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import SavedMatchesDrawer from '../components/SavedMatchesDrawer'
import HamburgerMenu from '../components/HamburgerMenu'
import './Landing.css'


const STEPS = [
  { icon: '1', title: 'Pick a mode', desc: 'Movies, Series, Food, Conversations, or Activities' },
  { icon: '2', title: 'Solo or Together', desc: 'Decide alone or share the link with someone' },
  { icon: '3', title: 'Swipe or pick', desc: 'Go through the options at your own pace' },
  { icon: '4', title: 'See your results', desc: 'Your picks, or what you both agree on' },
]

export default function Landing() {
  const navigate = useNavigate()
  const [showHow, setShowHow] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Theme state (mirrors ThemeToggle logic)
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('swaip-theme')
    if (saved) return saved === 'dark'
    return false // default: light mode
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem('swaip-theme', dark ? 'dark' : 'light')
  }, [dark])

  // Pick logo based on theme (put logo-dark.png in /public/ for dark mode)
  const logoSrc = dark ? '/logo-dark.png' : '/logo.png'

  return (
    <div className="landing">
      <div className="landing-content">
        <header className="landing-header">
          <div className="landing-header-row">
            <div style={{ flex: 1 }} />
            <Link to="/" className="landing-logo-center" aria-label="Home">
              <img
                src={logoSrc}
                alt="Swaip"
                className="logo-mark"
                onError={e => { e.currentTarget.src = '/logo.png' }}
              />
            </Link>
            <HamburgerMenu
              dark={dark}
              onToggleDark={() => setDark(d => !d)}
              onSavedMatches={() => setDrawerOpen(true)}
            />
          </div>
          <h1 className="tagline">Swipe your way to a perfect plan.</h1>
        </header>

        <h2 className="landing-question">What do you want to decide?</h2>

        <div className="category-grid">
          <button className="category-card" onClick={() => navigate('/create/movies')}>
            <span className="category-emoji">🍿</span>
            <div className="category-text">
              <span className="category-name">Movies</span>
              <span className="category-desc">Pick a film solo or find one you both love. Grab popcorn and hit play.</span>
            </div>
          </button>

          <button className="category-card" onClick={() => navigate('/create/activities')}>
            <span className="category-emoji">🎯</span>
            <div className="category-text">
              <span className="category-name">Activities</span>
              <span className="category-desc">Couch or outdoors? Find your next adventure, solo or together.</span>
            </div>
          </button>

          <button className="category-card" onClick={() => navigate('/create/series')}>
            <span className="category-emoji">📺</span>
            <div className="category-text">
              <span className="category-name">TV Series</span>
              <span className="category-desc">Your next binge-watch awaits. Pick alone or match with someone.</span>
            </div>
          </button>

          <button className="category-card" onClick={() => navigate('/create/conversations')}>
            <span className="category-emoji">💬</span>
            <div className="category-text">
              <span className="category-name">Conversations</span>
              <span className="category-desc">Skip the small talk. Explore deep dives, fun debates, and fresh topics.</span>
            </div>
          </button>

          <button className="category-card category-card--food" onClick={() => navigate('/create/food')}>
            <span className="category-emoji">🍽️</span>
            <div className="category-text">
              <span className="category-name">Food & Dining</span>
              <span className="category-desc">Pick a cuisine, then swipe through real restaurants near you.</span>
            </div>
            <svg className="category-chevron" width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 1 7 7 1 13" />
            </svg>
          </button>
        </div>

        <button className="how-toggle" onClick={() => setShowHow(!showHow)}>
          {showHow ? 'Got it' : 'How does it work?'}
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className={`how-arrow ${showHow ? 'open' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {showHow && (
          <div className="how-section">
            <div className="how-steps">
              {STEPS.map((step, i) => (
                <div key={i} className="how-step">
                  <div className="step-num">{step.icon}</div>
                  <div>
                    <div className="step-title">{step.title}</div>
                    <div className="step-desc">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="how-tip">
              <span className="tip-icon">💡</span>
              <p>Works best on your phone — share the link via text, WhatsApp, or AirDrop. No sign-up needed.</p>
            </div>
          </div>
        )}
      </div>

      <SavedMatchesDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}
