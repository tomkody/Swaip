import { Link } from 'react-router-dom'
import './HomeLogo.css'

// The brand mark used in every in-app header: logo icon + wordmark, linking
// home. Both icon variants are in the DOM and CSS shows the one that reads on
// the current theme (the dark variant has a white cap and arrow).
export default function HomeLogo({ className = '' }) {
  return (
    <Link to="/" className={`home-logo ${className}`} aria-label="Swaip home">
      <img className="home-logo-icon home-logo-icon--light" src="/swaip-icon-transparent.png" alt="" width="28" height="28" />
      <img className="home-logo-icon home-logo-icon--dark" src="/swaip-icon-dark.png" alt="" width="28" height="28" />
      <span className="home-logo-word">Swaip</span>
    </Link>
  )
}
