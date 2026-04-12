import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Landing.css'

const STEPS = [
  { icon: '1', title: 'Pick a mode', desc: 'Movies, Series, Conversations, or Activities' },
  { icon: '2', title: 'Share the link', desc: 'Send the room link to the other person' },
  { icon: '3', title: 'Swipe or pick', desc: 'Both of you go through the options independently' },
  { icon: '4', title: 'See your matches', desc: 'Instantly find out what you both agree on' },
]

export default function Landing() {
  const navigate = useNavigate()
  const [showHow, setShowHow] = useState(false)

  return (
    <div className="landing">
      <div className="landing-bg-orb orb-1" />
      <div className="landing-bg-orb orb-2" />

      <div className="landing-content">
        <header className="landing-header">
          <div className="logo-mark">S</div>
          <h1 className="logo-text">Swaip</h1>
          <p className="tagline">Stop saying "I don't know, you pick"</p>
        </header>

        <h2 className="landing-question">What are we deciding?</h2>

        <div className="category-grid">
          <button
            className="category-card"
            onClick={() => navigate('/create/movies')}
          >
            <div className="card-glow movie-glow" />
            <span className="category-emoji">🍿</span>
            <span className="category-name">Movies</span>
            <span className="category-desc">
              Swipe through 50 top-rated films.<br />Left = nope, right = yes.
            </span>
            <span className="category-tag">Swipe</span>
          </button>

          <button
            className="category-card"
            onClick={() => navigate('/create/series')}
          >
            <div className="card-glow series-glow" />
            <span className="category-emoji">📺</span>
            <span className="category-name">TV Series</span>
            <span className="category-desc">
              Swipe through 50 top-rated shows.<br />Find your next binge together.
            </span>
            <span className="category-tag">Swipe</span>
          </button>

          <button
            className="category-card"
            onClick={() => navigate('/create/conversations')}
          >
            <div className="card-glow conv-glow" />
            <span className="category-emoji">💬</span>
            <span className="category-name">Conversations</span>
            <span className="category-desc">
              Pick topics that interest you.<br />Find what you both want to talk about.
            </span>
            <span className="category-tag">Multi-pick</span>
          </button>

          <button
            className="category-card"
            onClick={() => navigate('/create/activities')}
          >
            <div className="card-glow activity-glow" />
            <span className="category-emoji">🎯</span>
            <span className="category-name">Activities</span>
            <span className="category-desc">
              Board games, cooking, hiking...<br />Find what you both want to do.
            </span>
            <span className="category-tag">Multi-pick</span>
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
    </div>
  )
}
