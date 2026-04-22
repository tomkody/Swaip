import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import SavedMatchesDrawer from '../components/SavedMatchesDrawer'
import './Landing.css'

const STEPS = [
  { icon: '1', title: 'Pick a mode', desc: 'Movies, Series, Food, Conversations, or Activities' },
  { icon: '2', title: 'Share the link', desc: 'Send the room link to the other person' },
  { icon: '3', title: 'Swipe or pick', desc: 'Both of you go through the options independently' },
  { icon: '4', title: 'See your matches', desc: 'Instantly find out what you both agree on' },
]

function LogoMark() {
  return (
    <svg className="logo-mark" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="56" height="56" rx="14" fill="url(#swaipGrad)" />
      {/* Two swap arrows forming an S-like shape */}
      {/* Top arrow: right-pointing */}
      <path d="M18 20h14l-4-4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M28 20l4 4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Bottom arrow: left-pointing */}
      <path d="M38 36H24l4 4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M28 36l-4-4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <defs>
        <linearGradient id="swaipGrad" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#52D7B0"/>
          <stop offset="1" stopColor="#2BCF9B"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const [showHow, setShowHow] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="landing">
      <div className="landing-content">
        <header className="landing-header">
          <div className="landing-header-row">
            <div style={{ flex: 1 }} />
            <Link to="/" className="landing-logo-center" aria-label="Home">
              <LogoMark />
              <h1 className="logo-text">Swaip</h1>
            </Link>
            <div className="landing-header-actions">
              <button
                className="history-btn"
                onClick={() => setDrawerOpen(true)}
                aria-label="Saved Matches"
                title="Saved Matches"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              </button>
            </div>
          </div>
          <p className="tagline">From "I don't know" to "Let's go!"</p>
        </header>

        <h2 className="landing-question">What are we deciding?</h2>

        <div className="category-grid">
          <button className="category-card" onClick={() => navigate('/create/movies')}>
            <span className="category-emoji">🍿</span>
            <span className="category-name">Movies</span>
            <span className="category-desc">Find your perfect film. Match, grab popcorn, and hit play.</span>
            <span className="category-mode-badge">↔ Swipe</span>
          </button>

          <button className="category-card" onClick={() => navigate('/create/series')}>
            <span className="category-emoji">📺</span>
            <span className="category-name">TV Series</span>
            <span className="category-desc">Your next shared binge-watch awaits. Match on top-rated shows.</span>
            <span className="category-mode-badge">↔ Swipe</span>
          </button>

          <button className="category-card" onClick={() => navigate('/create/conversations')}>
            <span className="category-emoji">💬</span>
            <span className="category-name">Conversations</span>
            <span className="category-desc">Skip the small talk. Match on deep dives, fun debates, and fresh topics.</span>
            <span className="category-mode-badge">☑ Pick</span>
          </button>

          <button className="category-card" onClick={() => navigate('/create/activities')}>
            <span className="category-emoji">🎯</span>
            <span className="category-name">Activities</span>
            <span className="category-desc">Couch or outdoors? Discover your next shared adventure.</span>
            <span className="category-mode-badge">☑ Pick</span>
          </button>

          <button className="category-card category-card--food" onClick={() => navigate('/create/food')}>
            <span className="category-emoji">🍽️</span>
            <span className="category-name">Food & Dining</span>
            <span className="category-desc">End the "what's for dinner?" debate. Match on cuisines or local spots.</span>
            <span className="category-mode-badge">↔ Swipe</span>
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
