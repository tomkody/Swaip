import { describe, it, expect, vi, afterEach } from 'vitest'
import { photonResult, photonLabel, mapyResult, mapyLabel } from '../geocoder'

// Shapes captured from the live APIs on 2026-09-30.
const photon = (properties, coordinates = [17.254, 49.572]) => ({ properties, geometry: { coordinates } })

describe('Photon results', () => {
  it('turns a quarter into a two-line row and an area name', () => {
    const r = photonResult(photon({
      osm_type: 'R', osm_id: 1, name: 'Nové Sady', type: 'locality', district: 'Nové Sady',
      city: 'Olomouc', county: 'okres Olomouc', country: 'Česko', countrycode: 'CZ',
    }))
    expect(r).toMatchObject({ name: 'Nové Sady', detail: 'Olomouc, Česko', label: 'Nové Sady, Olomouc', countryCode: 'CZ' })
    expect(r.lat).toBeCloseTo(49.572)
    expect(r.lng).toBeCloseTo(17.254)
  })

  it('names an address without a place name by its street and number', () => {
    const r = photonResult(photon({
      type: 'house', street: 'Vinohradská', housenumber: '1409/12', district: 'Vyšehrad', city: 'Praha', countrycode: 'cz',
    }, [14.435, 50.079]))
    expect(r.name).toBe('Vinohradská 1409/12')
    expect(r.label).toBe('Vinohradská 1409/12, Praha')
    expect(r.countryCode).toBe('CZ')
  })

  it('skips features without coordinates or a name', () => {
    expect(photonResult({ properties: { name: 'x' }, geometry: {} })).toBeNull()
    expect(photonResult(photon({}))).toBeNull()
  })

  it('names a reverse hit by its area, not the pub it landed on', () => {
    expect(photonLabel({
      name: 'U Včelek', street: 'Smetanovy sady', locality: 'Olomouc-střed', district: 'Povel',
      city: 'Olomouc', countrycode: 'CZ',
    })).toEqual({ name: 'Povel, Olomouc', countryCode: 'CZ' })
  })
})

describe('Mapy.com results', () => {
  const item = {
    name: 'Nové Sady',
    label: 'Část obce',
    location: 'Olomouc, Česko',
    type: 'regional.municipality_part',
    position: { lon: 17.2548, lat: 49.5722 },
    regionalStructure: [
      { name: 'Nové Sady', type: 'regional.municipality_part' },
      { name: 'Olomouc', type: 'regional.municipality' },
      { name: 'Česko', type: 'regional.country', isoCode: 'CZ' },
    ],
  }
  it('reads coordinates, the second line and the country code', () => {
    expect(mapyResult(item)).toMatchObject({
      name: 'Nové Sady', detail: 'Olomouc, Česko', label: 'Nové Sady, Olomouc', countryCode: 'CZ',
      lat: 49.5722, lng: 17.2548,
    })
  })
  it('names a reverse hit by quarter and town', () => {
    expect(mapyLabel({ ...item, name: 'Smetanovy sady 1' })).toEqual({ name: 'Nové Sady, Olomouc', countryCode: 'CZ' })
  })
})

describe('what leaves the device', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })
  it('rounds the point to about 100 m before asking for its name', async () => {
    vi.stubEnv('VITE_MAPY_API_KEY', '')
    vi.resetModules()
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ features: [] }) }))
    vi.stubGlobal('fetch', fetch)
    const { reverse, suggest } = await import('../geocoder')
    await reverse(49.587512, 17.251549)
    await suggest('Olomouc', { near: { lat: 49.587512, lng: 17.251549 } })
    for (const [url] of fetch.mock.calls) {
      expect(url).not.toMatch(/49\.587[0-9]|17\.251[0-9]|17\.252[0-9]/)
    }
    expect(fetch.mock.calls[0][0]).toContain('lat=49.588&lon=17.252')
  })
})

describe('provider fallback', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('uses Photon without a Mapy key', async () => {
    vi.stubEnv('VITE_MAPY_API_KEY', '')
    vi.resetModules()
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ features: [] }) }))
    vi.stubGlobal('fetch', fetch)
    const { suggest } = await import('../geocoder')
    const r = await suggest('Olomouc')
    expect(r.source).toBe('photon')
    expect(fetch.mock.calls[0][0]).toMatch(/^https:\/\/photon\.komoot\.io\/api\//)
  })

  it('drops to Photon for good once Mapy refuses the key', async () => {
    vi.stubEnv('VITE_MAPY_API_KEY', ' test-key\n')
    vi.resetModules()
    const fetch = vi.fn(async url => (String(url).includes('api.mapy.com')
      ? { ok: false, status: 403, json: async () => ({}) }
      : { ok: true, json: async () => ({ features: [] }) }))
    vi.stubGlobal('fetch', fetch)
    const { suggest } = await import('../geocoder')
    expect((await suggest('Brno')).source).toBe('photon')
    expect(fetch.mock.calls[0][0]).toContain('apikey=test-key&')   // trimmed
    expect((await suggest('Ostrava')).source).toBe('photon')
    expect(fetch.mock.calls.filter(c => String(c[0]).includes('api.mapy.com'))).toHaveLength(1)
  })
})
