import { Link } from 'react-router-dom'
import './Legal.css'

export default function Privacy() {
  return (
    <div className="legal-page">
      <Link to="/" className="legal-back">← Back to Swaip</Link>
      <h1>Privacy Policy</h1>
      <p className="legal-updated">Last updated: 23 August 2026</p>

      <p>
        Swaip helps you and a partner or friends decide what to watch, eat, or do by swiping
        together. We built it to collect as little about you as possible. This policy explains
        what we handle and why.
      </p>

      <h2>No account needed</h2>
      <p>
        Swaip has no sign-up, login, email, or password. We never ask for your name or contact
        details. To keep your picks separate from your partner's within a room, your device is
        given a random anonymous ID stored locally in your browser. It isn't tied to your
        identity and you can clear it any time by clearing your browser storage.
      </p>

      <h2>What we process</h2>
      <ul>
        <li><strong>Room activity</strong> — the room code, the options you swipe left/right on, and your ranked top picks. This is what lets two devices match.</li>
        <li><strong>Approximate location</strong> — only for Food and Activities, and only if you grant your browser's location permission. It's used to find places near you and is not stored as a profile.</li>
        <li><strong>Usage analytics</strong> — anonymous, aggregated events (e.g. a room was created, results were shared) via a cookieless analytics provider. No cross-site tracking and no advertising profiles.</li>
        <li><strong>Error diagnostics</strong> — if something crashes, we may collect technical error details to fix bugs. These contain no personal information.</li>
      </ul>

      <h2>How we use it</h2>
      <p>
        Solely to run the app — form matches between devices in a room, show places near you,
        keep the service working, and understand which features are used so we can improve them.
        We do not sell your data or use it for advertising.
      </p>

      <h2>Service providers</h2>
      <p>We rely on a few processors that handle data on our behalf:</p>
      <ul>
        <li><strong>Supabase</strong> — stores room and swipe data.</li>
        <li><strong>Vercel</strong> — hosts the app and serves requests.</li>
        <li><strong>The Movie Database (TMDB)</strong> — provides film and TV information.</li>
        <li><strong>Google Maps / Places</strong> — provides nearby places for Food and Activities.</li>
        <li><strong>Plausible</strong> — cookieless, privacy-friendly analytics (when enabled).</li>
        <li><strong>Sentry</strong> — error diagnostics (when enabled).</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        Swaip does not use advertising or tracking cookies. We use your browser's local storage
        for essential things like your anonymous device ID and your theme preference.
      </p>

      <h2>Data retention</h2>
      <p>
        Room and swipe data is kept only as long as needed to run the service and is periodically
        cleared. Because rooms are anonymous, the data can't be linked back to you personally.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live (e.g. the EU/UK under GDPR, or California under CCPA), you may
        have rights to access or delete data relating to you. Since Swaip stores no identifying
        information, we usually can't link room data to a specific person — but if you have a
        question, contact us and we'll help where we can.
      </p>

      <h2>Children</h2>
      <p>Swaip is not directed at children under 13, and we do not knowingly collect their data.</p>

      <h2>Changes</h2>
      <p>We may update this policy; we'll revise the date above when we do.</p>

      <h2>Contact</h2>
      <p>Questions? Email <a href="mailto:hello@swaip.app">hello@swaip.app</a>.</p>

      <p className="legal-note">
        This policy is provided as a general template and is not legal advice. Please have it
        reviewed against your specific setup and applicable laws before relying on it.
      </p>
    </div>
  )
}
