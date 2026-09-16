import { describe, it, expect, vi, afterEach } from 'vitest'
// ── Region detection ──────────────────────────────────────────────────────────
// A Czech phone reports navigator.language "cs" — no country in it — and the
// old "take the bit after the dash" rule sent those users to the US catalog.
describe('detectRegion', () => {
  const setEnv = ({ zone, language }) => {
    vi.stubGlobal('Intl', {
      ...Intl,
      DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: zone }) }),
      Locale: Intl.Locale,
    })
    vi.stubGlobal('navigator', { language })
  }
  afterEach(() => vi.unstubAllGlobals())

  it('tells Prague from Berlin, which share an offset', async () => {
    const { detectRegion } = await import('../regions')
    setEnv({ zone: 'Europe/Prague', language: 'cs' })
    expect(detectRegion()).toBe('CZ')
    setEnv({ zone: 'Europe/Berlin', language: 'de' })
    expect(detectRegion()).toBe('DE')
  })

  it('follows the device, not the language, for a Czech phone set to English', async () => {
    const { detectRegion } = await import('../regions')
    setEnv({ zone: 'Europe/Prague', language: 'en-US' })
    expect(detectRegion()).toBe('CZ')
  })

  it('falls back to the locale when the zone is one we do not map', async () => {
    const { detectRegion } = await import('../regions')
    setEnv({ zone: 'Antarctica/Troll', language: 'de-AT' })
    expect(detectRegion()).toBe('AT')
  })

  it('infers a country from a bare language when there is no usable zone', async () => {
    const { detectRegion } = await import('../regions')
    setEnv({ zone: 'Antarctica/Troll', language: 'cs' })
    expect(detectRegion()).toBe('CZ')
  })
})
