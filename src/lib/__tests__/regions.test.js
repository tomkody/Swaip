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

// The client list and the refresh job's list must match: a region the job fills
// but the client doesn't know about falls back to the US catalog, silently.
describe('catalog regions', () => {
  it('matches the regions the refresh job writes rows for', async () => {
    const { CATALOG_REGIONS } = await import('../regions')
    const { EMIT_REGIONS } = await import('../../../api/_lib/catalogWrite.js')
    expect([...CATALOG_REGIONS].sort()).toEqual([...EMIT_REGIONS].sort())
  })

  it('has a time zone for every region it claims to support', async () => {
    const { CATALOG_REGIONS, zoneToCountry } = await import('../regions')
    // Every country we keep a catalog for should be reachable from some zone,
    // otherwise its users can only get there via their language.
    const zones = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : []
    if (zones.length === 0) return
    const reachable = new Set(zones.map(zoneToCountry).filter(Boolean))
    const missing = CATALOG_REGIONS.filter(r => !reachable.has(r))
    expect(missing).toEqual([])
  })
})
