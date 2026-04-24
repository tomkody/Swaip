import { useNavigate } from 'react-router-dom'
import './TripHome.css'

const FEATURES = [
  {
    icon: '🗓️',
    title: 'Smart Itinerary',
    desc: "Day-by-day plans built around your transport, vibe, and budget. Regenerate any day you don't love.",
  },
  {
    icon: '🎒',
    title: 'Smart Packing List',
    desc: "Context-aware checklists. Heading to Lapland? We'll remind you about hand warmers.",
  },
  {
    icon: '👫',
    title: 'Plan Together',
    desc: 'Share a live edit link with your travel buddies and collaborate on the itinerary in real-time.',
  },
]

const SAMPLE_DAYS = [
  { day: 'Day 1', icon: '🏛️', activity: 'Sagrada Família + Gothic Quarter' },
  { day: 'Day 2', icon: '🌅', activity: 'Barceloneta Beach & El Born' },
  { day: 'Day 3', icon: '🎨', activity: 'Picasso Museum & Park Güell' },
]

export default function TripHome() {
  const navigate = useNavigate()

  return (
    <div className="trip-home">
      {/* Nav */}
      <nav className="trip-nav">
        <div className="trip-logo">
          <span className="trip-logo-icon">✈️</span>
          <span className="trip-logo-text">Wandr</span>
        </div>
        <button className="trip-nav-cta" onClick={() => navigate('/trip/plan')}>
          Plan a Trip
        </button>
      </nav>

      {/* Hero */}
      <section className="trip-hero">
        <div className="trip-hero-bg">
          <div className="hero-blob hero-blob-1" />
          <div className="hero-blob hero-blob-2" />
          <div className="hero-blob hero-blob-3" />
        </div>

        <div className="trip-hero-content">
          <div className="trip-hero-badge">
            <span className="badge-dot" />
            AI-Powered Travel Planning
          </div>
          <h1 className="trip-hero-title">
            Your Next Adventure,
            <br />
            <span className="trip-hero-title-accent">Planned in Minutes</span>
          </h1>
          <p className="trip-hero-sub">
            Tell us where you're headed and we'll craft a personalized day-by-day itinerary,
            smart packing list, and curated local experiences — tailored exactly to your vibe.
          </p>
          <div className="trip-hero-actions">
            <button className="trip-cta-btn" onClick={() => navigate('/trip/plan')}>
              Start Planning Free
              <span className="cta-arrow">→</span>
            </button>
            <div className="trip-hero-social-proof">
              <div className="avatars">
                {['🧑', '👩', '🧔', '👩‍🦱'].map((a, i) => (
                  <span key={i} className="avatar-item">{a}</span>
                ))}
              </div>
              <span>Join 12,000+ happy travelers</span>
            </div>
          </div>
        </div>

        <div className="trip-hero-visual">
          <div className="trip-mockup-card">
            <div className="mockup-header">
              <div className="mockup-pin">📍</div>
              <div>
                <div className="mockup-city">Barcelona, Spain</div>
                <div className="mockup-meta">7 days · Mid-range · Mixed transport</div>
              </div>
              <div className="mockup-badge-green">AI Generated</div>
            </div>
            <div className="mockup-days">
              {SAMPLE_DAYS.map((d) => (
                <div key={d.day} className="mockup-day-row">
                  <span className="mockup-day-label">{d.day}</span>
                  <span className="mockup-day-icon">{d.icon}</span>
                  <span className="mockup-day-activity">{d.activity}</span>
                  <button className="mockup-regen-btn">↺</button>
                </div>
              ))}
            </div>
            <div className="mockup-footer">
              <span>🎒 Packing list ready</span>
              <span>🗺️ Map view</span>
              <span>🎟️ Book experiences</span>
            </div>
          </div>
          <div className="mockup-float-tag mockup-float-1">🌡️ 26°C expected</div>
          <div className="mockup-float-tag mockup-float-2">🏨 3 hotels matched</div>
        </div>
      </section>

      {/* Features */}
      <section className="trip-features">
        <div className="trip-features-label">Why Wandr?</div>
        <h2 className="trip-features-title">Everything you need, nothing you don't</h2>
        <div className="trip-features-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA strip */}
      <section className="trip-cta-strip">
        <h2>Ready to explore?</h2>
        <p>Your perfect trip is one click away.</p>
        <button className="trip-cta-btn trip-cta-btn-white" onClick={() => navigate('/trip/plan')}>
          Build My Itinerary
          <span className="cta-arrow">→</span>
        </button>
      </section>

      <footer className="trip-footer">
        <span>© 2026 Wandr — Part of Swaip</span>
      </footer>
    </div>
  )
}
