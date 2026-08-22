// Error monitoring (Sentry), gated behind VITE_SENTRY_DSN.
//
// No-op until the DSN is set. Sentry is loaded via dynamic import, so when it's
// disabled the SDK isn't in the initial bundle at all — it only downloads once
// a DSN is configured. To enable: set VITE_SENTRY_DSN in your Vercel env.

export async function initMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return
  try {
    const Sentry = await import('@sentry/react')
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      // Keep it light: sample a fraction of traces, no session replay by default.
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
    })
  } catch (err) {
    console.warn('Monitoring init failed:', err)
  }
}
