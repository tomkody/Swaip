import { Link } from 'react-router-dom'
import './Legal.css'

export default function Terms() {
  return (
    <div className="legal-page">
      <Link to="/" className="legal-back">← Back to Swaip</Link>
      <h1>Terms of Use</h1>
      <p className="legal-updated">Last updated: 23 August 2026</p>

      <p>
        By using Swaip you agree to these terms. Swaip is a free tool that helps people decide
        together what to watch, eat, or do.
      </p>

      <h2>Using Swaip</h2>
      <p>
        Swaip is free and requires no account. You may use it for personal, non-commercial
        purposes. Please don't misuse it — no attempting to disrupt or overload the service,
        reverse-engineer it, scrape it, or use it for anything unlawful.
      </p>

      <h2>Content and third-party data</h2>
      <p>
        Film and TV details come from The Movie Database (TMDB), and place information comes from
        Google Maps / Places. Swaip is not endorsed by or affiliated with these providers, and we
        don't control or guarantee the accuracy of their data. Streaming availability and "where
        to watch" links are provided for convenience and may change.
      </p>

      <h2>No warranty</h2>
      <p>
        Swaip is provided "as is", without warranties of any kind. We don't guarantee it will be
        available, error-free, or that recommendations will suit your taste.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, Swaip and its creators are not liable for any
        indirect or consequential damages arising from your use of the service.
      </p>

      <h2>Changes</h2>
      <p>We may update these terms; continued use after changes means you accept them.</p>

      <h2>Contact</h2>
      <p>Questions? Email <a href="mailto:hello@swaip.app">hello@swaip.app</a>.</p>

      <p className="legal-note">
        These terms are provided as a general template and are not legal advice. Please have them
        reviewed before relying on them.
      </p>
    </div>
  )
}
