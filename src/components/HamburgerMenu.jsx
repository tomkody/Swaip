import { useState, useEffect, useRef } from 'react'
import { isAuthAvailable, getUser, onAuthChange, signInWithEmail, signOut } from '../lib/auth'
import { track } from '../lib/analytics'
import './HamburgerMenu.css'

// Passwordless account section: enter an email, get a magic link. Signing in
// makes saved-match history follow the user across devices; everything else
// stays anonymous.
//
// Paused for now: Supabase's built-in mailer (no custom SMTP configured yet)
// has a very low project-wide send-rate limit, so a second real user signing
// in within the same hour would just see "email rate limit exceeded". Flip
// this back to true once a custom SMTP provider (e.g. Resend) is wired up in
// Supabase → Project Settings → Authentication → SMTP Settings.
const SIGNIN_ENABLED = false

function AccountSection() {
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')   // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let active = true
    getUser().then(u => { if (active) setUser(u) })
    const unsub = onAuthChange(u => setUser(u))
    return () => { active = false; unsub() }
  }, [])

  if (!SIGNIN_ENABLED) return null
  if (!isAuthAvailable()) return null

  if (user) {
    return (
      <>
        <div className="hm-account">
          <span className="hm-icon">👤</span>
          <span className="hm-account-email">{user.email}</span>
        </div>
        <button className="hm-item" onClick={() => { signOut(); track('signed_out') }}>
          <span className="hm-icon">🚪</span>
          Sign out
        </button>
      </>
    )
  }

  if (status === 'sent') {
    return <p className="hm-note">✉️ Check your inbox — we sent you a sign-in link.</p>
  }

  return (
    <form
      className="hm-signin"
      onSubmit={async (e) => {
        e.preventDefault()
        const addr = email.trim()
        if (!addr || status === 'sending') return
        setStatus('sending')
        const err = await signInWithEmail(addr)
        if (err) { setErrorMsg(err); setStatus('error') }
        else { setStatus('sent'); track('signin_link_sent') }
      }}
    >
      <p className="hm-signin-label">Sign in to keep your history on every device</p>
      <div className="hm-signin-row">
        <input
          className="hm-signin-input"
          type="email"
          placeholder="you@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          aria-label="Email for sign-in link"
        />
        <button className="hm-signin-btn" type="submit" disabled={!email.trim() || status === 'sending'}>
          {status === 'sending' ? '…' : 'Send link'}
        </button>
      </div>
      {status === 'error' && <p className="hm-signin-error">{errorMsg}</p>}
    </form>
  )
}

export default function HamburgerMenu({ onSavedMatches, dark, onToggleDark }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open])

  return (
    <div className="hamburger-wrap" ref={menuRef}>
      <button
        className={`hamburger-btn ${open ? 'is-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="Menu"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="3" y1="7" x2="21" y2="7"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="17" x2="21" y2="17"/>
          </svg>
        )}
      </button>

      {open && (
        <div className="hm-panel">
          {/* Theme toggle */}
          <button className="hm-item" onClick={onToggleDark}>
            <span className="hm-icon">{dark ? '☀️' : '🌙'}</span>
            {dark ? 'Light mode' : 'Dark mode'}
          </button>

          {/* Saved matches */}
          <button className="hm-item" onClick={() => { setOpen(false); onSavedMatches(); }}>
            <span className="hm-icon">🔖</span>
            Saved Matches
          </button>

          <div className="hm-divider" />

          {/* Account */}
          <AccountSection />

          <div className="hm-divider" />

          {/* Contact */}
          <a className="hm-item" href="mailto:swaiptheapp@gmail.com">
            <span className="hm-icon">✉️</span>
            swaiptheapp@gmail.com
          </a>

          {/* Instagram */}
          <a
            className="hm-item"
            href="https://instagram.com/swaiptheapp"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
            </svg>
            Follow us on Instagram
          </a>
        </div>
      )}
    </div>
  )
}
