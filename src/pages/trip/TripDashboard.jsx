import { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import TripMap from '../../components/trip/TripMap'
import { generateTrip, regenerateDay } from '../../lib/generateTrip'
import './TripDashboard.css'

/* ---- Constants ---- */
const LOADING_STEPS = [
  { icon: '📍', text: 'Locating your destination…' },
  { icon: '🗓️', text: 'Mapping your days…' },
  { icon: '✨', text: 'Curating activities to your vibe…' },
  { icon: '🎒', text: 'Building your packing list…' },
  { icon: '🎟️', text: 'Finding top experiences…' },
]

const CATEGORY_ICONS = {
  history: '🏛️', food: '🍽️', nature: '🌿', nightlife: '🍸',
  art: '🎨', beach: '🏖️', shopping: '🛍️', monuments: '🗿',
  adventure: '🧗', wellness: '🧘',
}

const TRANSPORT_LABELS = {
  car: '🚗 Car', walking: '🚶 Walking', transit: '🚌 Public Transit', mixed: '🗺️ Mixed',
}

const BUDGET_LABELS = {
  budget: '🎒 Budget', midrange: '✈️ Mid-range', luxury: '💎 Luxury',
}

const PACKING_CATEGORY_ICONS = {
  Clothing: '👕', Electronics: '🔌', Documents: '📄',
  'Health & Safety': '🩺', 'Destination-specific': '🌍',
}

/* ============================================================
   Sub-components
   ============================================================ */

function LoadingScreen({ step, destination }) {
  const current = LOADING_STEPS[Math.min(step, LOADING_STEPS.length - 1)]
  return (
    <div className="loading-screen">
      <div className="loading-blob loading-blob-1" />
      <div className="loading-blob loading-blob-2" />
      <div className="loading-card">
        <div className="loading-spinner" />
        <div className="loading-icon">{current.icon}</div>
        <h2 className="loading-title">Planning your trip</h2>
        {destination && (
          <div className="loading-dest">
            📍 {typeof destination === 'object' ? destination.displayName : destination}
          </div>
        )}
        <p className="loading-step">{current.text}</p>
        <div className="loading-dots">
          {LOADING_STEPS.map((_, i) => (
            <span
              key={i}
              className={`loading-dot ${i === Math.min(step, LOADING_STEPS.length - 1) ? 'active' : i < step ? 'done' : ''}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ErrorScreen({ error, onRetry }) {
  const navigate = useNavigate()
  return (
    <div className="error-screen">
      <div className="error-icon">⚠️</div>
      <h2>Something went wrong</h2>
      <p className="error-msg">{error}</p>
      <div className="error-actions">
        <button className="dash-btn-primary" onClick={onRetry}>Try Again</button>
        <button className="dash-btn-ghost" onClick={() => navigate('/trip/plan')}>← Edit Trip</button>
      </div>
    </div>
  )
}

function DashboardHeader({ tripData, form, onShare }) {
  const navigate = useNavigate()
  const destName = typeof form.destination === 'object'
    ? form.destination.displayName
    : form.destination

  return (
    <header className="dash-header">
      <div className="dash-header-inner">
        <button className="dash-back-btn" onClick={() => navigate('/trip')}>← Wandr</button>

        <div className="dash-header-center">
          <h1 className="dash-title">{tripData.destination}</h1>
          <p className="dash-tagline">{tripData.tagline}</p>
          <div className="dash-meta-pills">
            <span className="dash-pill">📅 {form.startDate} – {form.endDate}</span>
            <span className="dash-pill">{TRANSPORT_LABELS[form.transport] || form.transport}</span>
            <span className="dash-pill">{BUDGET_LABELS[form.budget] || form.budget}</span>
            {tripData.weatherNote && (
              <span className="dash-pill dash-pill-weather">☀️ {tripData.weatherNote}</span>
            )}
          </div>
        </div>

        <button className="dash-share-btn" onClick={onShare}>
          🔗 Share
        </button>
      </div>
    </header>
  )
}

function TabNav({ active, onChange }) {
  return (
    <nav className="dash-tabs">
      {[
        { id: 'itinerary', icon: '🗓️', label: 'Itinerary' },
        { id: 'packing', icon: '🎒', label: 'Packing List' },
        { id: 'experiences', icon: '🎟️', label: 'Experiences' },
      ].map((t) => (
        <button
          key={t.id}
          className={`dash-tab ${active === t.id ? 'dash-tab-active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          <span className="dash-tab-icon">{t.icon}</span>
          <span className="dash-tab-label">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}

/* ---- Itinerary Tab ---- */
function ItineraryTab({ tripData, form, activeDay, setActiveDay, regeneratingDay, onRegenerate }) {
  const day = tripData.days[activeDay]
  const centerCoords = typeof form.destination === 'object'
    ? { lat: form.destination.lat, lng: form.destination.lng }
    : null

  return (
    <div className="itinerary-tab">
      {/* Day selector */}
      <div className="day-selector-wrap">
        <div className="day-selector">
          {tripData.days.map((d, i) => (
            <button
              key={d.dayNumber}
              className={`day-pill ${i === activeDay ? 'day-pill-active' : ''}`}
              onClick={() => setActiveDay(i)}
            >
              <span className="day-pill-num">Day {d.dayNumber}</span>
              <span className="day-pill-theme">{d.theme}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Day content */}
      <div className="day-content">
        {/* Activities column */}
        <div className="activities-col">
          <div className="activities-header">
            <div>
              <h2 className="activities-day-title">Day {day.dayNumber} — {day.theme}</h2>
              {day.date && <p className="activities-date">{new Date(day.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>}
            </div>
            <button
              className={`regen-btn ${regeneratingDay === activeDay ? 'regen-btn-loading' : ''}`}
              onClick={() => onRegenerate(activeDay)}
              disabled={regeneratingDay !== null}
              title="Regenerate this day with different activities"
            >
              {regeneratingDay === activeDay ? (
                <><span className="regen-spinner" /> Regenerating…</>
              ) : (
                <><span className="regen-icon">↺</span> Regenerate Day</>
              )}
            </button>
          </div>

          <div className="activities-list">
            {day.activities.map((act, idx) => (
              <div
                key={`${activeDay}-${idx}`}
                className="activity-card"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <div className="activity-time-col">
                  <span className="activity-time">{act.time}</span>
                  {idx < day.activities.length - 1 && <div className="activity-line" />}
                </div>
                <div className="activity-body">
                  <div className="activity-header-row">
                    <span className="activity-cat-icon">
                      {CATEGORY_ICONS[act.category] ?? '📌'}
                    </span>
                    <h3 className="activity-name">{act.name}</h3>
                    <span className="activity-duration">{act.duration}</span>
                  </div>
                  <p className="activity-desc">{act.description}</p>
                  {act.insiderTip && (
                    <div className="activity-tip">
                      <span className="tip-label">💡 Tip</span>
                      {act.insiderTip}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Map column */}
        <div className="map-col">
          <div className="map-sticky">
            <TripMap
              activities={day.activities}
              centerCoords={centerCoords}
            />
            {tripData.currencyTip && (
              <div className="currency-tip">
                💳 {tripData.currencyTip}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---- Packing List Tab ---- */
function PackingTab({ tripData, checkedItems, setCheckedItems }) {
  const toggle = (key) =>
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }))

  const allItems = Object.values(tripData.packingList || {}).flat()
  const checkedCount = allItems.filter((_, i) => checkedItems[i]).length

  return (
    <div className="packing-tab">
      <div className="packing-header">
        <div>
          <h2 className="packing-title">Smart Packing List</h2>
          <p className="packing-sub">
            Tailored for {typeof tripData.destination === 'string' ? tripData.destination : 'your destination'}
          </p>
        </div>
        <div className="packing-progress">
          <div className="packing-prog-bar">
            <div
              className="packing-prog-fill"
              style={{ width: `${allItems.length ? (checkedCount / allItems.length) * 100 : 0}%` }}
            />
          </div>
          <span className="packing-prog-label">{checkedCount}/{allItems.length} packed</span>
        </div>
      </div>

      {tripData.weatherNote && (
        <div className="packing-weather-note">
          ☀️ {tripData.weatherNote}
        </div>
      )}

      <div className="packing-categories">
        {Object.entries(tripData.packingList || {}).map(([cat, items]) => {
          const icon = PACKING_CATEGORY_ICONS[cat] ?? '📦'
          const catKey = (i) => `${cat}-${i}`
          const catChecked = items.filter((_, i) => checkedItems[catKey(i)]).length
          return (
            <div key={cat} className="packing-cat">
              <div className="packing-cat-header">
                <span className="packing-cat-icon">{icon}</span>
                <span className="packing-cat-name">{cat}</span>
                <span className="packing-cat-count">{catChecked}/{items.length}</span>
              </div>
              <ul className="packing-items">
                {items.map((item, i) => {
                  const key = catKey(i)
                  return (
                    <li
                      key={key}
                      className={`packing-item ${checkedItems[key] ? 'packing-item-checked' : ''}`}
                      onClick={() => toggle(key)}
                    >
                      <span className="packing-checkbox">
                        {checkedItems[key] ? '✓' : ''}
                      </span>
                      <span className="packing-item-text">{item}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---- Experiences Tab ---- */
function ExperiencesTab({ tripData }) {
  return (
    <div className="exp-tab">
      <div className="exp-header">
        <h2 className="exp-title">Top Experiences</h2>
        <p className="exp-sub">Curated bookable experiences for your trip</p>
      </div>
      <div className="exp-grid">
        {(tripData.experiences || []).map((exp, i) => (
          <div key={i} className="exp-card">
            <div className="exp-card-top">
              <span className="exp-cat-badge">{exp.category}</span>
              <span className="exp-price">{exp.estimatedPrice}</span>
            </div>
            <h3 className="exp-name">{exp.name}</h3>
            <p className="exp-why">{exp.whyGoThere}</p>
            <p className="exp-desc">{exp.description}</p>
            <a
              className="exp-book-btn"
              href={`https://www.google.com/search?q=${encodeURIComponent(exp.name + ' ' + tripData.destination + ' tickets book')}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Find & Book →
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ============================================================
   Main Dashboard
   ============================================================ */

export default function TripDashboard() {
  const location = useLocation()
  const navigate = useNavigate()
  const form = location.state

  const [tripData, setTripData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('itinerary')
  const [activeDay, setActiveDay] = useState(0)
  const [regeneratingDay, setRegeneratingDay] = useState(null)
  const [checkedItems, setCheckedItems] = useState({})

  const loadTrip = useCallback(async () => {
    if (!form) { navigate('/trip'); return }
    setLoading(true)
    setError(null)
    setLoadingStep(0)
    setActiveDay(0)

    const stepTimer = setInterval(
      () => setLoadingStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)),
      1100
    )

    try {
      const data = await generateTrip(form)
      setTripData(data)
    } catch (e) {
      setError(e.message)
    } finally {
      clearInterval(stepTimer)
      setLoading(false)
    }
  }, [form, navigate])

  useEffect(() => { loadTrip() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRegenerate = async (dayIdx) => {
    setRegeneratingDay(dayIdx)
    try {
      const newDay = await regenerateDay(form, tripData.days[dayIdx].dayNumber, tripData)
      setTripData((prev) => ({
        ...prev,
        days: prev.days.map((d, i) => (i === dayIdx ? newDay : d)),
      }))
    } catch (e) {
      alert('Regeneration failed: ' + e.message)
    } finally {
      setRegeneratingDay(null)
    }
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      alert('Link copied to clipboard! (Full sharing coming soon)')
    })
  }

  if (loading) return <LoadingScreen step={loadingStep} destination={form?.destination} />
  if (error) return <ErrorScreen error={error} onRetry={loadTrip} />
  if (!tripData) return null

  return (
    <div className="dashboard">
      <DashboardHeader tripData={tripData} form={form} onShare={handleShare} />
      <TabNav active={activeTab} onChange={setActiveTab} />

      <main className="dashboard-main">
        {activeTab === 'itinerary' && (
          <ItineraryTab
            tripData={tripData}
            form={form}
            activeDay={activeDay}
            setActiveDay={setActiveDay}
            regeneratingDay={regeneratingDay}
            onRegenerate={handleRegenerate}
          />
        )}
        {activeTab === 'packing' && (
          <PackingTab
            tripData={tripData}
            checkedItems={checkedItems}
            setCheckedItems={setCheckedItems}
          />
        )}
        {activeTab === 'experiences' && (
          <ExperiencesTab tripData={tripData} />
        )}
      </main>
    </div>
  )
}
