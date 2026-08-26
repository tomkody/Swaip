// Privacy-friendly analytics via Vercel Web Analytics (free, cookieless).
//
// Nothing to configure in env: just enable "Web Analytics" in the Vercel
// project dashboard. It only collects on the deployed site — in dev this is a
// no-op. The rest of the app calls track(event, props) and never knows the
// vendor, so swapping providers means editing only this file.

import { inject, track as vercelTrack } from '@vercel/analytics'

export function initAnalytics() {
  if (!import.meta.env.PROD) return // no analytics in dev
  try {
    inject()
  } catch { /* never let analytics break boot */ }
}

// Track a funnel event. Never throws — analytics must not break the app.
// Vercel event properties must be flat string/number/boolean values.
export function track(event, props) {
  try {
    vercelTrack(event, props || undefined)
  } catch { /* swallow */ }
}
