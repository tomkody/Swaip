import { describe, it, expect } from 'vitest'
import { browserContext, canOpenInSafari, locationHelp } from '../browserContext'

const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)'
const UA = {
  safari: `${IOS} Version/18.6 Mobile/15E148 Safari/604.1`,
  messenger: `${IOS} Mobile/15E148 [FBAN/MessengerForiOS;FBAV/500.0.0.30.106;FBBV/712345678;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.6;FBSS/3;FBID/phone;FBLC/cs_CZ;FBOP/5;FBRV/0]`,
  facebook: `${IOS} Mobile/15E148 [FBAN/FBIOS;FBAV/520.0.0.38.101;FBBV/723456789;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.6;FBSS/3;FBID/phone;FBLC/cs_CZ;FBOP/5;FBRV/0]`,
  instagram: `${IOS} Mobile/15E148 Instagram 350.0.0.21.106 (iPhone15,2; iOS 18_6; cs_CZ; cs; scale=3.00; 1179x2556; 634108168)`,
  tiktok: `${IOS} Mobile/15E148 musical_ly_36.1.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/cs Region/CZ`,
  chromeIos: `${IOS} CriOS/140.0.7339.101 Mobile/15E148 Safari/604.1`,
  bareWebView: `${IOS} Mobile/15E148`,
  ipadDesktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
  messengerAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/500.0.0.20.109;]',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  androidWebView: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36',
  desktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
}
const ctx = (ua, extra = {}) => browserContext({ ua, standalone: false, maxTouchPoints: 0, ...extra })

describe('browserContext', () => {
  it('recognises Safari on iPhone', () => {
    expect(ctx(UA.safari)).toEqual({ kind: 'safari', app: 'Safari', ios: true })
  })
  it('tells Messenger from Facebook although both say FBAN', () => {
    expect(ctx(UA.messenger)).toMatchObject({ kind: 'iab', app: 'Messenger', ios: true })
    expect(ctx(UA.facebook)).toMatchObject({ kind: 'iab', app: 'Facebook', ios: true })
    expect(ctx(UA.messengerAndroid)).toMatchObject({ kind: 'iab', app: 'Messenger', ios: false })
  })
  it('recognises Instagram and TikTok', () => {
    expect(ctx(UA.instagram)).toMatchObject({ kind: 'iab', app: 'Instagram' })
    expect(ctx(UA.tiktok)).toMatchObject({ kind: 'iab', app: 'TikTok' })
  })
  it('treats other iOS browsers as apps with their own permission', () => {
    expect(ctx(UA.chromeIos)).toMatchObject({ kind: 'ios-browser', app: 'Chrome', ios: true })
  })
  it('flags an unnamed iOS web view', () => {
    expect(ctx(UA.bareWebView)).toMatchObject({ kind: 'iab', app: null, ios: true })
  })
  it('sees an iPad asking for the desktop site as iOS Safari', () => {
    expect(ctx(UA.ipadDesktop, { maxTouchPoints: 5 })).toMatchObject({ kind: 'safari', ios: true })
    expect(ctx(UA.ipadDesktop)).toMatchObject({ kind: 'desktop', ios: false })
  })
  it('treats the iPhone Home Screen app as its own case', () => {
    expect(ctx(UA.safari, { standalone: true })).toMatchObject({ kind: 'standalone', ios: true })
  })
  it('treats an installed app on Android or a desktop like its browser', () => {
    expect(ctx(UA.androidChrome, { standalone: true })).toMatchObject({ kind: 'android', ios: false })
    expect(ctx(UA.desktop, { standalone: true })).toMatchObject({ kind: 'desktop', ios: false })
  })
  it('handles Android and desktop', () => {
    expect(ctx(UA.androidChrome)).toMatchObject({ kind: 'android' })
    expect(ctx(UA.androidWebView)).toMatchObject({ kind: 'iab', app: null })
    expect(ctx(UA.desktop)).toMatchObject({ kind: 'desktop' })
  })
})

describe('canOpenInSafari', () => {
  it('only offers it where a hand-off is known to exist', () => {
    expect(canOpenInSafari(ctx(UA.messenger))).toBe(true)
    expect(canOpenInSafari(ctx(UA.instagram))).toBe(true)
    expect(canOpenInSafari(ctx(UA.tiktok))).toBe(false)
    expect(canOpenInSafari(ctx(UA.safari))).toBe(false)
    expect(canOpenInSafari(ctx(UA.messengerAndroid))).toBe(false)
  })
})

describe('locationHelp', () => {
  it('names the real setting for approximate location in Safari', () => {
    const h = locationHelp(ctx(UA.safari), 'approximate', { accuracy: '±3.2 km' })
    expect(h.text).toContain('approximate')
    expect(h.text).toContain('±3.2 km')
    expect(h.why).toContain('Safari Websites > Precise Location')
    expect(h.text).not.toMatch(/step outside|weak GPS/i)
  })
  it('blames the host app inside Messenger and offers Safari', () => {
    const h = locationHelp(ctx(UA.messenger), 'approximate', { accuracy: '±5 km' })
    expect(h.text).toContain('Messenger')
    expect(h.action).toBe('open-safari')
    expect(h.why).toContain('Location Services > Messenger')
  })
  it('does not call a dismissed prompt a block', () => {
    expect(locationHelp(ctx(UA.androidChrome), 'dismissed').text).not.toMatch(/blocked/i)
  })
  it('falls back to copying the link where Safari cannot be opened', () => {
    expect(locationHelp(ctx(UA.tiktok), 'denied').action).toBe('copy-link')
  })
  it('tells a repeat denial to reload, except inside an app where reloading cannot help', () => {
    expect(locationHelp(ctx(UA.safari), 'denied-earlier').text).toMatch(/Reload/)
    expect(locationHelp(ctx(UA.messenger), 'denied-earlier')).toMatchObject({ action: 'open-safari' })
  })
  it('never sends Android users to Safari', () => {
    for (const o of ['approximate', 'denied', 'unavailable']) {
      const h = locationHelp(ctx(UA.messengerAndroid), o, { accuracy: '±5 km' })
      expect(h.text).not.toContain('Safari')
      expect(h.action).toBe('copy-link')
    }
  })
  it('never uses an em dash', () => {
    const outcomes = ['approximate', 'rough', 'denied', 'dismissed', 'denied-earlier', 'unavailable', 'no-response', 'unsupported']
    for (const ua of Object.values(UA)) {
      for (const o of outcomes) {
        const h = locationHelp(ctx(ua), o, { accuracy: '±1 km' })
        expect(`${h.text} ${h.why || ''}`).not.toMatch(/[—–]/)
      }
    }
  })
})
