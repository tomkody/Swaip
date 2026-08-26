import './CategoryGrid.css'

// Multi-select grid of categories — all options visible at once, tap to pick one
// or many. Replaces the blind one-by-one category swiping.
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
            style={{ background: cat.gradient }}
            onClick={() => onToggle(cat.numId)}
            aria-pressed={isSel}
          >
            <span className="catgrid-check" aria-hidden="true">
              {isSel && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </span>
            <span className="catgrid-emoji">{cat.emoji}</span>
            <span className="catgrid-label">{cat.label}</span>
            {cat.desc && <span className="catgrid-desc">{cat.desc}</span>}
          </button>
        )
      })}
    </div>
  )
}
