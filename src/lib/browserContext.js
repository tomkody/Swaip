// Which browser the page is running in, as far as location is concerned.
//
// On iOS the answer decides whose permission applies: Safari's own setting for
// "Safari Websites", or - inside Messenger, Instagram, Facebook and friends,
// which all embed WKWebView - the HOST APP's location permission, including its
// own Precise Location switch. So the same page can get a good fix in Safari
// and a 5 km one inside Messenger, and the advice has to name the right app.
//
// App patterns follow the ones in inapp-spy (MIT, github.com/shalanah/inapp-spy).
// Never parse the iOS version out of the UA: iOS 26 freezes it.

const IN_APP = [
  // Messenger before Facebook: both carry FBAN/FBAV.
  { app: 'Messenger', re: /FBAN\/Messenger|FB_IAB\/MESSENGER|MessengerForiOS|\bOrca-Android/i },
  { app: 'Instagram', re: /\bInstagram/i },
  { app: 'Facebook', re: /\bFBAN\/|\bFBAV\/|\bFB_IAB\/|\bFBIOS\b|\bFB4A\b/i },
  { app: 'TikTok', re: /musical_ly|Bytedance|\bTikTok/i },
  { app: 'Snapchat', re: /Snapchat/i },
  { app: 'LinkedIn', re: /LinkedInApp/i },
  { app: 'Threads', re: /\bBarcelona/i },
  { app: 'Google', re: /\bGSA\//i },
  { app: 'WhatsApp', re: /\b(WAiOS|WA4A)\//i },
  { app: 'LINE', re: /\bLine\//i },
  { app: 'WeChat', re: /MicroMessenger\//i },
]

const IOS_BROWSERS = [
  { app: 'Chrome', re: /CriOS\//i },
  { app: 'Firefox', re: /FxiOS\//i },
  { app: 'Edge', re: /EdgiOS\//i },
]

function envDefaults() {
  if (typeof window === 'undefined') return { ua: '', standalone: false, maxTouchPoints: 0 }
  let standalone = false
  try {
    standalone = window.navigator.standalone === true
      || Boolean(window.matchMedia?.('(display-mode: standalone)').matches)
  } catch { /* old engines */ }
  return {
    ua: window.navigator.userAgent || '',
    standalone,
    maxTouchPoints: window.navigator.maxTouchPoints || 0,
  }
}

// → { kind: 'standalone'|'iab'|'ios-browser'|'safari'|'android'|'desktop', app, ios }
export function browserContext(env = envDefaults()) {
  const { ua = '', standalone = false, maxTouchPoints = 0 } = env
  const ios = /iPhone|iPod|iPad/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)

  // The Home Screen app on iOS runs on Safari's location permission. An
  // installed PWA on Android or a desktop behaves like its browser.
  if (standalone && ios) return { kind: 'standalone', app: null, ios }
  for (const { app, re } of IN_APP) if (re.test(ua)) return { kind: 'iab', app, ios }
  if (ios) {
    for (const { app, re } of IOS_BROWSERS) if (re.test(ua)) return { kind: 'ios-browser', app, ios }
    // An iOS web view that isn't Safari and didn't name itself.
    if (!/Safari\//.test(ua)) return { kind: 'iab', app: null, ios }
    return { kind: 'safari', app: 'Safari', ios }
  }
  if (/Android/.test(ua)) {
    if (/; wv\)/.test(ua)) return { kind: 'iab', app: null, ios }
    return { kind: 'android', app: null, ios }
  }
  return { kind: 'desktop', app: null, ios }
}

// Hand the page over to Safari from an in-app browser. Undocumented schemes
// that work today and may stop working with any app update, so the map and
// search always stay usable without it. Returns false when there's no known way.
export function canOpenInSafari(ctx) {
  return Boolean(ctx?.ios && ctx.kind === 'iab' && SAFARI_OPENERS[ctx.app])
}

// Each returns false when it can tell the hand-off didn't happen. Assigning an
// unknown scheme fails silently, so the caller also checks whether the page
// went to the background.
const SAFARI_OPENERS = {
  Messenger: url => { window.location.href = 'x-safari-' + url; return true },
  LinkedIn: url => { window.location.href = 'x-safari-' + url; return true },
  LINE: url => { window.location.href = 'x-safari-' + url; return true },
  Google: url => { window.location.href = 'x-safari-' + url; return true },
  Facebook: url => window.open('x-safari-' + url) !== null,
  Threads: url => window.open('x-safari-' + url) !== null,
  Instagram: url => { window.location.href = 'instagram://extbrowser/?url=' + encodeURIComponent(url); return true },
}

export function openInSafari(ctx, url = window.location.href) {
  const open = canOpenInSafari(ctx) ? SAFARI_OPENERS[ctx.app] : null
  if (!open) return false
  try { return open(url) !== false } catch { return false }
}

// One short sentence for what happened with "Use my location", plus an
// optional settings path (shown only on request - nobody walks five menus to
// pick a bar) and an optional action.
// outcome: 'approximate' | 'rough' | 'denied' | 'denied-earlier' | 'unavailable' | 'no-response' | 'unsupported'
export function locationHelp(ctx, outcome, { accuracy = '' } = {}) {
  const kind = ctx?.kind
  const app = ctx?.app
  const iab = kind === 'iab'
  const inApp = app || 'This app'
  const action = iab ? (canOpenInSafari(ctx) ? 'open-safari' : 'copy-link') : null
  const acc = accuracy ? ` (${accuracy})` : ''
  const browser = ctx?.ios ? 'Safari' : 'your browser'

  if (outcome === 'approximate') {
    if (iab) return {
      text: `${inApp} only shares an approximate location${acc}. Move the map to where you are, or open Swaip in ${browser}.`,
      why: ctx?.ios && app ? `Settings > Privacy & Security > Location Services > ${app} > Precise Location.` : null,
      action,
    }
    if (kind === 'safari' || kind === 'standalone') return {
      text: `Your iPhone only shares an approximate location with websites${acc}. Move the map to where you are.`,
      why: 'Settings > Privacy & Security > Location Services > Safari Websites > Precise Location.',
    }
    if (kind === 'ios-browser') return {
      text: `${app} only shares an approximate location${acc}. Move the map to where you are.`,
      why: `Settings > Privacy & Security > Location Services > ${app} > Precise Location.`,
    }
    if (kind === 'desktop') return {
      text: `Computers locate by Wi-Fi, so this can be kilometres off${acc}. Move the map to where you are.`,
    }
    return { text: `Your phone only gave an approximate location${acc}. Move the map to where you are.` }
  }

  if (outcome === 'rough') {
    return { text: `Located to ${accuracy || 'a rough area'}, so the pin may be off. Move the map to where you are.` }
  }

  if (outcome === 'denied') {
    if (iab) return {
      text: `${inApp} isn't sharing your location. Search or move the map, or open Swaip in ${browser}.`,
      why: ctx?.ios && app ? `Settings > Privacy & Security > Location Services > ${app}.` : null,
      action,
    }
    if (kind === 'safari') return {
      text: 'Location is blocked for swaip.app. Search or move the map instead.',
      why: 'To allow it: tap aA in the address bar > Website Settings > Location, then reload the page.',
    }
    if (kind === 'standalone') return {
      text: 'Location is off for Swaip. Search or move the map instead.',
      why: 'Settings > Privacy & Security > Location Services > Safari Websites.',
    }
    if (kind === 'ios-browser') return {
      text: `${app} isn't sharing your location. Search or move the map instead.`,
      why: `Settings > Privacy & Security > Location Services > ${app}.`,
    }
    return {
      text: 'Location is blocked for this site. Search or move the map instead.',
      why: "Allow location in your browser's site settings, then try again.",
    }
  }

  if (outcome === 'denied-earlier') {
    // Inside an in-app browser the block is the host app's own permission, so
    // a reload changes nothing and the way out is another browser.
    if (iab) return locationHelp(ctx, 'denied')
    return { text: 'Location was blocked on this page. Reload to try again, or search instead.' }
  }

  if (outcome === 'unsupported') {
    return { text: "This browser can't share a location. Search or move the map instead." }
  }

  // 'unavailable' | 'no-response'
  if (iab) return {
    text: `Location often fails inside ${app || 'in-app browsers'}. Search or move the map, or open Swaip in ${browser}.`,
    action,
  }
  return { text: "Couldn't get a location. Search or move the map instead." }
}
