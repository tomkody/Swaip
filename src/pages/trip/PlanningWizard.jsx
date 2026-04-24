import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PlaceAutocomplete from '../../components/trip/PlaceAutocomplete'
import './PlanningWizard.css'

const STEPS = ['Destination', 'Transport', 'Preferences', 'Budget']

const TRANSPORT_OPTIONS = [
  { id: 'car', icon: '🚗', label: 'Car', desc: 'Full flexibility, ideal for road trips & countryside' },
  { id: 'walking', icon: '🚶', label: 'Walking', desc: 'Best for compact cities, slow & immersive travel' },
  { id: 'transit', icon: '🚌', label: 'Public Transit', desc: 'Metro, bus & tram — authentic local experience' },
  { id: 'mixed', icon: '🗺️', label: 'Mixed', desc: 'Combine everything for maximum coverage' },
]

const PREFERENCES = [
  { id: 'history', icon: '🏛️', label: 'History' },
  { id: 'adventure', icon: '🧗', label: 'Adventure' },
  { id: 'beach', icon: '🏖️', label: 'Beach' },
  { id: 'sports', icon: '⚽', label: 'Sports' },
  { id: 'nightlife', icon: '🍸', label: 'Nightlife' },
  { id: 'monuments', icon: '🗿', label: 'Monuments' },
  { id: 'food', icon: '🍽️', label: 'Food & Drink' },
  { id: 'nature', icon: '🌿', label: 'Nature' },
  { id: 'shopping', icon: '🛍️', label: 'Shopping' },
  { id: 'art', icon: '🎨', label: 'Art & Culture' },
  { id: 'music', icon: '🎵', label: 'Music & Festivals' },
  { id: 'wellness', icon: '🧘', label: 'Wellness & Spa' },
]

const BUDGET_OPTIONS = [
  {
    id: 'budget',
    icon: '🎒',
    label: 'Budget Explorer',
    desc: 'Hostels, street food & free attractions',
    range: 'Under $80 / day',
    color: '#10B981',
    bg: 'rgba(16, 185, 129, 0.08)',
    border: 'rgba(16, 185, 129, 0.3)',
  },
  {
    id: 'midrange',
    icon: '✈️',
    label: 'Balanced Traveler',
    desc: 'Hotels, restaurants & popular experiences',
    range: '$80 – $200 / day',
    color: '#0EA5E9',
    bg: 'rgba(14, 165, 233, 0.08)',
    border: 'rgba(14, 165, 233, 0.3)',
  },
  {
    id: 'luxury',
    icon: '💎',
    label: 'Luxury Seeker',
    desc: 'Premium hotels, fine dining & VIP tours',
    range: '$200+ / day',
    color: '#F97316',
    bg: 'rgba(249, 115, 22, 0.08)',
    border: 'rgba(249, 115, 22, 0.3)',
  },
]

const POPULAR_DESTINATIONS = [
  { label: 'Tokyo', flag: '🇯🇵' },
  { label: 'Paris', flag: '🇫🇷' },
  { label: 'Bali', flag: '🇮🇩' },
  { label: 'Rome', flag: '🇮🇹' },
  { label: 'New York', flag: '🇺🇸' },
  { label: 'Cape Town', flag: '🇿🇦' },
]

const EMPTY_FORM = {
  destination: null, // { displayName, formattedAddress, placeId, lat, lng }
  startDate: '',
  endDate: '',
  transport: '',
  preferences: [],
  budget: '',
}

function getTripDuration(start, end) {
  if (!start || !end) return null
  const diff = new Date(end) - new Date(start)
  if (diff <= 0) return null
  const days = Math.round(diff / (1000 * 60 * 60 * 24))
  return days === 1 ? '1 day' : `${days} days`
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0]
}

export default function PlanningWizard() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [animKey, setAnimKey] = useState(0)
  const [form, setForm] = useState({ ...EMPTY_FORM })

  const duration = getTripDuration(form.startDate, form.endDate)

  const isStepValid = () => {
    if (step === 0) {
      const destOk = form.destination?.displayName?.trim().length >= 2
      return (
        destOk &&
        form.startDate &&
        form.endDate &&
        new Date(form.endDate) > new Date(form.startDate)
      )
    }
    if (step === 1) return !!form.transport
    if (step === 2) return form.preferences.length >= 1
    if (step === 3) return !!form.budget
    return false
  }

  const advance = (dir) => {
    setAnimKey((k) => k + dir * 1000 + Math.random())
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1)
    } else {
      navigate('/trip/dashboard', { state: form })
    }
  }

  const goBack = () => {
    setAnimKey((k) => k - 1000)
    setStep((s) => s - 1)
  }

  const togglePreference = (id) => {
    setForm((f) => ({
      ...f,
      preferences: f.preferences.includes(id)
        ? f.preferences.filter((p) => p !== id)
        : [...f.preferences, id],
    }))
  }

  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <div className="wizard-page">
      {/* Header */}
      <div className="wizard-header">
        <button className="wizard-back-home" onClick={() => navigate('/trip')}>
          ← Wandr
        </button>
        <div className="wizard-step-label">
          Step {step + 1} of {STEPS.length}
        </div>
      </div>

      {/* Progress bar */}
      <div className="wizard-progress-track">
        <div className="wizard-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Step bubbles */}
      <div className="wizard-steps-nav">
        {STEPS.map((s, i) => (
          <div key={s} className={`wizard-step-bubble ${i < step ? 'done' : ''} ${i === step ? 'active' : ''}`}>
            {i < step ? '✓' : i + 1}
            <span className="wizard-step-name">{s}</span>
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="wizard-card" key={animKey}>
        {step === 0 && (
          <Step1Destination
            form={form}
            setForm={setForm}
            duration={duration}
            today={getTodayStr()}
          />
        )}
        {step === 1 && <Step2Transport form={form} setForm={setForm} />}
        {step === 2 && (
          <Step3Preferences
            form={form}
            togglePreference={togglePreference}
          />
        )}
        {step === 3 && <Step4Budget form={form} setForm={setForm} />}
      </div>

      {/* Navigation */}
      <div className="wizard-nav">
        {step > 0 ? (
          <button className="wizard-btn-back" onClick={goBack}>
            ← Back
          </button>
        ) : (
          <div />
        )}
        <button
          className="wizard-btn-next"
          disabled={!isStepValid()}
          onClick={() => advance(1)}
        >
          {step === STEPS.length - 1 ? '✨ Generate My Trip' : 'Continue →'}
        </button>
      </div>
    </div>
  )
}

/* ======= Step Components ======= */

function Step1Destination({ form, setForm, duration, today }) {
  return (
    <div className="step-content">
      <div className="step-icon-hero">🌍</div>
      <h2 className="step-title">Where are you headed?</h2>
      <p className="step-subtitle">Search any city — we'll pin it on the map for you.</p>

      <div className="form-group">
        <label className="form-label">Destination</label>
        <PlaceAutocomplete
          value={form.destination}
          onChange={(place) => setForm((f) => ({ ...f, destination: place }))}
        />
      </div>

      <div className="date-row">
        <div className="form-group">
          <label className="form-label">Start date</label>
          <div className="input-wrapper">
            <span className="input-icon">📅</span>
            <input
              className="form-input"
              type="date"
              min={today}
              value={form.startDate}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  startDate: e.target.value,
                  endDate: f.endDate && f.endDate < e.target.value ? '' : f.endDate,
                }))
              }
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">End date</label>
          <div className="input-wrapper">
            <span className="input-icon">📅</span>
            <input
              className="form-input"
              type="date"
              min={form.startDate || today}
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {duration && (
        <div className="duration-badge">
          🗓️ {duration} trip
          {form.destination ? ` to ${form.destination.displayName}` : ''}
        </div>
      )}
    </div>
  )
}

function Step2Transport({ form, setForm }) {
  return (
    <div className="step-content">
      <div className="step-icon-hero">🚦</div>
      <h2 className="step-title">How will you get around?</h2>
      <p className="step-subtitle">
        Choose your main mode of transport at the destination.
      </p>

      <div className="transport-grid">
        {TRANSPORT_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            className={`transport-card ${form.transport === opt.id ? 'transport-card-active' : ''}`}
            onClick={() => setForm((f) => ({ ...f, transport: opt.id }))}
          >
            <span className="transport-icon">{opt.icon}</span>
            <span className="transport-label">{opt.label}</span>
            <span className="transport-desc">{opt.desc}</span>
            {form.transport === opt.id && <span className="transport-check">✓</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

function Step3Preferences({ form, togglePreference }) {
  return (
    <div className="step-content">
      <div className="step-icon-hero">✨</div>
      <h2 className="step-title">What's your travel vibe?</h2>
      <p className="step-subtitle">
        Pick at least one. The more you choose, the smarter your itinerary.
      </p>

      <div className="pref-grid">
        {PREFERENCES.map((p) => {
          const active = form.preferences.includes(p.id)
          return (
            <button
              key={p.id}
              className={`pref-chip ${active ? 'pref-chip-active' : ''}`}
              onClick={() => togglePreference(p.id)}
            >
              <span className="pref-icon">{p.icon}</span>
              <span className="pref-label">{p.label}</span>
              {active && <span className="pref-check">✓</span>}
            </button>
          )
        })}
      </div>

      {form.preferences.length > 0 && (
        <div className="pref-count">
          {form.preferences.length} vibe{form.preferences.length > 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  )
}

function Step4Budget({ form, setForm }) {
  return (
    <div className="step-content">
      <div className="step-icon-hero">💰</div>
      <h2 className="step-title">What's your budget style?</h2>
      <p className="step-subtitle">
        We'll tailor accommodation, dining and activities to match.
      </p>

      <div className="budget-grid">
        {BUDGET_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            className={`budget-card ${form.budget === opt.id ? 'budget-card-active' : ''}`}
            style={
              form.budget === opt.id
                ? { borderColor: opt.color, background: opt.bg }
                : {}
            }
            onClick={() => setForm((f) => ({ ...f, budget: opt.id }))}
          >
            <span className="budget-icon">{opt.icon}</span>
            <div className="budget-info">
              <span className="budget-label" style={form.budget === opt.id ? { color: opt.color } : {}}>
                {opt.label}
              </span>
              <span className="budget-desc">{opt.desc}</span>
              <span className="budget-range" style={{ color: opt.color }}>
                {opt.range}
              </span>
            </div>
            {form.budget === opt.id && (
              <span className="budget-check" style={{ color: opt.color }}>
                ✓
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
