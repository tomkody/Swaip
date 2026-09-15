import { useNavigate } from 'react-router-dom'
import HomeLogo from './HomeLogo'
import ThemeToggle from './ThemeToggle'
import Icon from './Icon'
import './AppHeader.css'

// Shared top bar for every in-app screen: optional back button, the brand
// mark (links home), an optional slot for screen status (progress, match
// count) and the theme toggle. Replaces the floating back button and the
// fixed theme toggle that used to sit on top of cards and slots.
export default function AppHeader({ onBack, backLabel = 'Back', children, className = '' }) {
  const navigate = useNavigate()
  const back = onBack === true ? () => navigate(-1) : onBack
  return (
    <header className={`app-header ${className}`}>
      <div className="app-header-left">
        {back && (
          <button type="button" className="app-header-back" onClick={back} aria-label={backLabel}>
            <Icon name="arrowLeft" size={20} />
          </button>
        )}
        <HomeLogo />
      </div>
      <div className="app-header-right">
        {children}
        <ThemeToggle />
      </div>
    </header>
  )
}
