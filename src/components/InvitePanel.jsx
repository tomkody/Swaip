import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import './InvitePanel.css'

// Per-type invite copy — the message that lands in the partner's DM/text.
const INVITE_MESSAGES = {
  movies:        '🍿 Swipe with me to pick a movie tonight',
  series:        '📺 Help me pick our next binge-watch',
  food:          '🍽️ Let\'s decide where to eat',
  activities:    '🎯 Pick something to do with me',
  conversations: '💬 Let\'s find something good to talk about',
}

export default function InvitePanel({ roomId, type = 'movies' }) {
  const url = `${window.location.origin}/room/${roomId}`
  const message = INVITE_MESSAGES[type] || 'Swipe with me on Swaip'
  const [qr, setQr] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    QRCode.toDataURL(url, { width: 360, margin: 1, color: { dark: '#1E222B', light: '#FFFFFF' } })
      .then(d => { if (alive) setQr(d) })
      .catch(() => {})
    return () => { alive = false }
  }, [url])

  function handleShare() {
    if (navigator.share) {
      navigator.share({ title: 'Swaip', text: `${message} →`, url }).catch(() => {})
    } else {
      handleCopy()
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <div className="invite">
      <p className="invite-msg">{message}</p>

      {qr && (
        <div className="invite-qr">
          <img src={qr} alt="Scan to join this room" />
          <span>Scan if you're together</span>
        </div>
      )}

      <div className="invite-actions">
        <button className="btn btn-primary invite-share" onClick={handleShare}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          Send invite
        </button>
        <button className="btn btn-secondary invite-copy" onClick={handleCopy}>
          {copied ? '✓ Copied' : 'Copy link'}
        </button>
      </div>
    </div>
  )
}
