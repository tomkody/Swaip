import { getPlatformMeta } from '../lib/platforms'
import './WhereToWatch.css'

// Shows streaming availability for a movie/series.
// - platforms: array of platform ids. An empty array renders a search fallback
//   so every title is still actionable. `null`/`undefined` renders nothing
//   (e.g. places, which aren't streamable).
// This is the display surface the future TMDB "watch providers" data plugs into.
export default function WhereToWatch({ platforms, title, className = '' }) {
  if (platforms == null) return null

  const metas = platforms.map(getPlatformMeta).filter(Boolean)

  return (
    <div className={`wtw ${className}`}>
      <span className="wtw-label">Where to watch</span>
      {metas.length > 0 ? (
        <div className="wtw-badges">
          {metas.map(p => (
            <span
              key={p.id}
              className="wtw-badge"
              style={{ color: p.color, background: p.bg, borderColor: p.border }}
            >
              {p.name}
            </span>
          ))}
        </div>
      ) : (
        <a
          className="wtw-find"
          href={`https://www.google.com/search?q=${encodeURIComponent(`where to watch ${title || ''}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
        >
          🔍 Find where to watch
        </a>
      )}
    </div>
  )
}
