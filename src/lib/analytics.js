// Privacy-friendly, vendor-agnostic analytics.
//
// No-op until VITE_PLAUSIBLE_DOMAIN is set, so nothing tracks in dev or before
// you opt in. Plausible is cookieless and GDPR-friendly (no consent banner
// required). To enable: set VITE_PLAUSIBLE_DOMAIN=swaip.app in your Vercel env.
//
// Swap providers by changing only this file — the rest of the app calls
// track(event, props) and never knows the vendor.

export function initAnalytics() {
  const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN
  if (!domain || typeof document === 'undefined') return
  if (document.querySelector('script[data-swaip-analytics]')) return

  // Queue shim so track() calls before the script loads aren't lost.
  window.plausible = window.plausible || function () {
    (window.plausible.q = window.plausible.q || []).push(arguments)
  }

  const s = document.createElement('script')
  s.defer = true
  s.dataset.swaipAnalytics = 'true'
  s.setAttribute('data-domain', domain)
  s.src = 'https://plausible.io/js/script.js'
  document.head.appendChild(s)
}

// Track a funnel event. Never throws — analytics must not break the app.
export function track(event, props) {
  try {
    if (typeof window !== 'undefined' && typeof window.plausible === 'function') {
      window.plausible(event, props ? { props } : undefined)
    }
  } catch { /* swallow */ }
}
