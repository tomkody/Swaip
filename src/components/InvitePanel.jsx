import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { track } from '../lib/analytics'
import Icon from './Icon'
import { buildInvitePayload, INVITE_MESSAGES } from '../lib/invite'
import './InvitePanel.css'


export default function InvitePanel({ roomId, type = 'movies', onInteract }) {
  const url = `${window.location.origin}/room/${roomId}`
  const message = INVITE_MESSAGES[type] || 'Swipe with me on Swaip'
  const [qr, setQr] = useState(null)
  const [showQr, setShowQr] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!showQr || qr) return
    QRCode.toDataURL(url, { width: 360, margin: 1, color: { dark: '#1E222B', light: '#FFFFFF' } })
      .then(setQr).catch(() => {})
  }, [showQr, qr, url])

  function handleShare() {
    track('invite_shared', { type })
    onInteract?.()
    if (navigator.share) {
      navigator.share(buildInvitePayload(message, url)).catch(() => {})
    } else {
      handleCopy()
    }
  }

  function handleCopy() {
    track('invite_copied', { type })
    onInteract?.()
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <div className="invite">
      <button className="btn btn-primary invite-primary" onClick={handleShare}>
        <Icon name="share" size={17} strokeWidth={2.4} />
        Send invite
      </button>

      <div className="invite-row">
        <button className="invite-secondary" onClick={handleCopy}>
          <Icon name={copied ? 'check' : 'link'} size={16} />
          {copied ? 'Link copied' : 'Copy link'}
        </button>
        <button
          className="invite-secondary"
          onClick={() => { setShowQr(v => !v); onInteract?.() }}
          aria-expanded={showQr}
        >
          <Icon name="qr" size={16} />
          {showQr ? 'Hide QR' : 'QR code'}
        </button>
      </div>

      {showQr && qr && (
        <div className="invite-qr">
          <img src={qr} alt="Scan to join this room" />
        </div>
      )}
    </div>
  )
}
