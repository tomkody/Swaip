import { supabase } from './supabase'

// Per-room chat that opens on the results screen once people have matched.
// Same public-anon read/write model as swipes (the room id is the capability),
// and the same graceful-degradation trick as rankings: if the `messages` table
// isn't in the database yet, we flip a flag and the UI hides itself instead of
// spamming 404s. Create the table with the SQL in the app README / setup notes.

let channelSeq = 0
const uniqueChannel = (roomId) => `chat-${roomId}-${++channelSeq}`

// Flipped true the first time we learn the messages table doesn't exist, so the
// chat UI can quietly disable itself.
export let messagesUnavailable = false

const NAME_KEY = 'swaip_name'
const MAX_NAME = 24
const MAX_BODY = 500

export function getSavedName() {
  try { return localStorage.getItem(NAME_KEY) || '' } catch { return '' }
}
export function saveName(name) {
  try { localStorage.setItem(NAME_KEY, (name || '').slice(0, MAX_NAME)) } catch { /* ignore */ }
}

export async function fetchMessages(roomId) {
  if (!supabase || messagesUnavailable) return []
  const { data, error } = await supabase
    .from('messages')
    .select('id, user_token, name, body, created_at')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) {
    if (error.code === 'PGRST205') messagesUnavailable = true   // table missing
    return []
  }
  return data || []
}

export async function sendMessage(roomId, userToken, name, body) {
  if (!supabase || messagesUnavailable) return null
  const clean = (body || '').trim().slice(0, MAX_BODY)
  if (!clean) return null
  const row = {
    room_id: roomId,
    user_token: userToken,
    name: (name || 'Guest').trim().slice(0, MAX_NAME) || 'Guest',
    body: clean,
  }
  const { data, error } = await supabase
    .from('messages').insert(row)
    .select('id, user_token, name, body, created_at').single()
  if (error) {
    if (error.code === 'PGRST205') messagesUnavailable = true
    throw error
  }
  return data
}

export function subscribeToMessages(roomId, onMessage) {
  if (!supabase || messagesUnavailable) return () => {}
  const channel = supabase
    .channel(uniqueChannel(roomId))
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
      (payload) => onMessage(payload.new)
    )
    .subscribe()
  return () => supabase.removeChannel(channel)
}
