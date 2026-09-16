// Regions the nightly refresh job populates (see api/refresh-movies.js).
// Single source of truth — tmdb.js and seriesFetch.js both import this so the
// list can never drift out of sync between movies and series.
export const CATALOG_REGIONS = ['US', 'GB', 'CA', 'AU', 'IE', 'DE', 'FR', 'ES', 'IT', 'NL', 'BR', 'MX', 'IN', 'CZ', 'PL', 'SE']

// ── Which country's streaming catalog to show ────────────────────────────────
// This used to read navigator.language and take the bit after the dash. On a
// Czech phone that reports plain "cs" — no dash, no country — which fell
// through to the US catalog: 630 titles that are on German services, 354 on
// Czech ones, and a Prague user was being shown neither.
//
// The IANA time zone is the better signal: it names a city, not an offset, so
// Europe/Prague and Europe/Berlin are different answers even though both are
// UTC+1. It also follows the device rather than the language, so a Czech phone
// running in English still lands on CZ.
const ZONE_COUNTRY = {
  'Europe/Prague': 'CZ',
  'Europe/Berlin': 'DE', 'Europe/Busingen': 'DE',
  'Europe/Warsaw': 'PL',
  'Europe/Stockholm': 'SE',
  'Europe/London': 'GB',
  'Europe/Dublin': 'IE',
  'Europe/Paris': 'FR',
  'Europe/Madrid': 'ES', 'Africa/Ceuta': 'ES', 'Atlantic/Canary': 'ES',
  'Europe/Rome': 'IT',
  'Europe/Amsterdam': 'NL',
  'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN',
}

// Countries with many zones, matched as a group rather than city by city.
const ZONE_PATTERNS = [
  [/^Australia\//, 'AU'],
  [/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Whitehorse|Yellowknife|Iqaluit|Moncton|Glace_Bay|Goose_Bay|Blanc-Sablon|Atikokan|Creston|Dawson|Dawson_Creek|Fort_Nelson|Inuvik|Rankin_Inlet|Resolute|Swift_Current|Cambridge_Bay)$/, 'CA'],
  [/^America\/(Mexico_City|Cancun|Merida|Monterrey|Chihuahua|Hermosillo|Tijuana|Mazatlan|Matamoros|Ojinaga|Bahia_Banderas)$/, 'MX'],
  [/^America\/(Sao_Paulo|Bahia|Fortaleza|Recife|Belem|Manaus|Cuiaba|Campo_Grande|Porto_Velho|Boa_Vista|Rio_Branco|Eirunepe|Maceio|Araguaina|Santarem|Noronha)$/, 'BR'],
  [/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Juneau|Nome|Sitka|Yakutat|Adak|Menominee|Indiana\/.+|Kentucky\/.+|North_Dakota\/.+)$/, 'US'],
  [/^Pacific\/Honolulu$/, 'US'],
]

export function zoneToCountry(zone) {
  if (!zone) return null
  if (ZONE_COUNTRY[zone]) return ZONE_COUNTRY[zone]
  for (const [pattern, country] of ZONE_PATTERNS) if (pattern.test(zone)) return country
  return null
}

// Viewer's country (ISO-3166 alpha-2). Time zone first, then the locale — an
// explicit one like "de-AT", otherwise the language's own most likely country
// ("cs" → CZ), which is what Intl.Locale#maximize is for.
export function detectRegion() {
  try {
    const fromZone = zoneToCountry(Intl.DateTimeFormat().resolvedOptions().timeZone)
    if (fromZone) return fromZone
  } catch { /* no Intl, or a zone we don't map — fall through */ }

  const locale = (typeof navigator !== 'undefined' && navigator.language) || 'en-US'
  const explicit = locale.split('-')[1]
  if (explicit) return explicit.toUpperCase()
  try {
    return (new Intl.Locale(locale).maximize().region || 'US').toUpperCase()
  } catch {
    return 'US'
  }
}
