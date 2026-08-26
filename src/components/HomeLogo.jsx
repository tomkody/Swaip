import { Link } from 'react-router-dom'
import './HomeLogo.css'

// Small clickable "Swaip" wordmark that returns to the home page. Used in the
// in-room screens (swipe / results) so there's always a way back out.
export default function HomeLogo({ className = '' }) {
  return (
    <Link to="/" className={`home-logo ${className}`} aria-label="Back to home">
      Swaip
    </Link>
  )
}
