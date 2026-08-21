import './ModeToggle.css'

// Pick between playing with a friend (Together) or alone (Solo).
// Shared by all the create-room screens.
export default function ModeToggle({ solo, onChange }) {
  return (
    <div className="mode-cards" role="radiogroup" aria-label="Play mode">
      <button
        type="button"
        role="radio"
        aria-checked={!solo}
        className={`mode-card ${!solo ? 'selected' : ''}`}
        onClick={() => onChange(false)}
      >
        <span className="mode-card-check" aria-hidden="true">✓</span>
        <span className="mode-card-icon">👥</span>
        <span className="mode-card-title">Together</span>
        <span className="mode-card-desc">Share a link and match on what you both want</span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={solo}
        className={`mode-card ${solo ? 'selected' : ''}`}
        onClick={() => onChange(true)}
      >
        <span className="mode-card-check" aria-hidden="true">✓</span>
        <span className="mode-card-icon">👤</span>
        <span className="mode-card-title">Solo</span>
        <span className="mode-card-desc">Just you — swipe at your own pace</span>
      </button>
    </div>
  )
}
