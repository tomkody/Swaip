import { supabase } from './supabase'
import { getUser, onAuthChange } from './auth'

// Saved matches: localStorage is the instant source of truth, and every save is
// mirrored to a Supabase `saved_matches` table under a persistent DEVICE id so
// the history survives cleared tabs and (via the same id) syncs across
// sessions. The device id is deliberately separate from the per-tab swipe
// identity — sharing them would break matching (two tabs must stay two players).
// Fails open like rankings/chat did: if the table doesn't exist (PGRST205),
// remote sync silently disables and localStorage keeps working.

const KEY = 'swaip_saved_matches'
const DEVICE_KEY = 'swaip_device_id'

let remoteUnavailable = false

// When signed in, history lives under the account key instead of the device id,
// so it follows the user across devices. Call initHistorySync() once at boot;
// on sign-in this device's anonymous rows are adopted into the account
// (best-effort — a duplicate item just stays under the old key).
let historyKey = null
function currentKey() { return historyKey || getDeviceId() }

export function initHistorySync() {
  if (!supabase) return
  const apply = (user) => {
    if (!user) { historyKey = null; return }
    const userKey = `user:${user.id}`
    const device = getDeviceId()
    if (device && historyKey !== userKey && !remoteUnavailable) {
      supabase.from('saved_matches').update({ device_key: userKey })
        .eq('device_key', device).then(() => {}, () => {})
    }
    historyKey = userKey
  }
  getUser().then(apply)
  onAuthChange(apply)
}

export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

export function getSavedMatches() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

function writeLocal(matches) {
  try { localStorage.setItem(KEY, JSON.stringify(matches)) } catch { /* full/blocked */ }
}

export function saveMatch({ id, title, category, image, year, rating }) {
  const matches = getSavedMatches()
  // Avoid duplicates
  if (matches.some(m => m.id === id && m.category === category)) return
  const entry = { id, title, category, image: image || null, year: year || null, rating: rating || null, dateMatched: new Date().toISOString() }
  writeLocal([entry, ...matches])

  // Mirror to Supabase (best-effort, never blocks the UI)
  const device = currentKey()
  if (!supabase || remoteUnavailable || !device) return
  supabase.from('saved_matches').upsert(
    {
      device_key: device,
      item_id: String(id),
      category,
      title,
      image: entry.image,
      year: entry.year,
      rating: entry.rating,
      date_matched: entry.dateMatched,
    },
    { onConflict: 'device_key,category,item_id', ignoreDuplicates: true }
  ).then(({ error }) => {
    if (error?.code === 'PGRST205') remoteUnavailable = true
  })
}

export function removeMatch(id, category) {
  const matches = getSavedMatches()
  writeLocal(matches.filter(m => !(String(m.id) === String(id) && m.category === category)))

  const device = currentKey()
  if (!supabase || remoteUnavailable || !device) return
  supabase.from('saved_matches').delete()
    .eq('device_key', device).eq('category', category).eq('item_id', String(id))
    .then(({ error }) => {
      if (error?.code === 'PGRST205') remoteUnavailable = true
    })
}

// Pull this device's remote history and merge it into localStorage. Returns the
// merged list (remote-only entries appended), or the local list on any failure.
export async function syncSavedMatches() {
  const local = getSavedMatches()
  const device = currentKey()
  if (!supabase || remoteUnavailable || !device) return local
  try {
    const { data, error } = await supabase
      .from('saved_matches')
      .select('item_id, category, title, image, year, rating, date_matched')
      .eq('device_key', device)
      .order('date_matched', { ascending: false })
      .limit(500)
    if (error) {
      if (error.code === 'PGRST205') remoteUnavailable = true
      return local
    }
    const seen = new Set(local.map(m => `${m.category}:${m.id}`))
    const remoteOnly = (data || [])
      .filter(r => !seen.has(`${r.category}:${r.item_id}`))
      .map(r => ({ id: r.item_id, title: r.title, category: r.category, image: r.image, year: r.year, rating: r.rating, dateMatched: r.date_matched }))
    if (remoteOnly.length === 0) return local
    const merged = [...local, ...remoteOnly]
      .sort((a, b) => new Date(b.dateMatched) - new Date(a.dateMatched))
    writeLocal(merged)
    return merged
  } catch {
    return local
  }
}
