import './CategoryGrid.css'

// Multi-select grid of categories — all options visible at once, tap to pick one
// or many. Clean neutral cards with a small colour-accented icon per category
// (matches the homepage), so a long list doesn't turn into a wall of colour.
// categories: [{ numId, label, emoji, desc, gradient }]
// selected: Set of numIds · onToggle(numId)
export default function CategoryGrid({ categories, selected, onToggle }) {
  return (
    <div className="catgrid">
      {categories.map(cat => {
        const isSel = selected.has(cat.numId)
        return (
          <button
            key={cat.id ?? cat.numId}
            type="button"
            className={`catgrid-tile ${isSel ? 'is-selected' : ''}`}
            onClick={() => onToggle(cat.numId)}
            aria-pressed={isSel}
          >
            <span className="catgrid-emoji" style={{ background: cat.gradient }}>{cat.emoji}</span>
            <span className="catgrid-text">
              <span className="catgrid-label">{cat.label}</span>
              {cat.desc && <span className="catgrid-desc">{cat.desc}</span>}
            </span>
            <span className={`catgrid-check ${isSel ? 'is-checked' : ''}`} aria-hidden="true">
              {isSel && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
