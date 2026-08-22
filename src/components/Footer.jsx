import { Link } from 'react-router-dom'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="site-footer">
      <nav className="site-footer-links">
        <Link to="/privacy">Privacy</Link>
        <span aria-hidden="true">·</span>
        <Link to="/terms">Terms</Link>
      </nav>
      <p className="site-footer-copy">© {new Date().getFullYear()} Swaip</p>
    </footer>
  )
}
