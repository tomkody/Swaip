// Confetti and other decorative motion are skipped for people who asked the
// OS to reduce motion. CSS handles transitions; this covers the JS bursts.
export function prefersReducedMotion() {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}
