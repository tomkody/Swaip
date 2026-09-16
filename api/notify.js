// Fans a Web Push notification out to everyone subscribed in a room, except
// the sender. Called fire-and-forget from the client when a partner joins or a
// match lands. The client is untrusted: it only names the room, the event and
// the item; the server checks the event actually happened (room went active /
// enough players liked the item) and writes the copy itself. Requires
// VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY and the push_subscriptions table
// (supabase/push_subscriptions.sql); without them it responds 503 and the
// client feature stays hidden anyway.

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const COPY = {
  joined: { title: '🎉 They joined!', body: 'Your partner just joined your Swaip room - start swiping!' },
  match:  { title: "💘 It's a match!", body: 'You both liked the same thing - open Swaip to see it.' },
}
const CATALOG_TABLE = { movies: 'movie_catalog', series: 'series_catalog' }

const sleep = ms => new Promise(r => setTimeout(r, ms))

// One notification per room+event+item per minute. The client fires these
// itself, so nothing stopped it (or anyone replaying the call) from having us
// push the same thing over and over. In-memory: it resets when the instance
// recycles and doesn't see other instances, so it dampens a burst rather than
// guaranteeing exactly-once.
const RECENT_TTL_MS = 60_000
const recent = new Map()
function notifiedRecently(signature) {
  const at = recent.get(signature)
  return at != null && Date.now() - at < RECENT_TTL_MS
}
// Only a notification we actually sent counts. Marking on arrival instead would
// let a stream of rejected requests suppress the genuine one behind them.
function markNotified(signature) {
  const now = Date.now()
  recent.set(signature, now)
  if (recent.size > 2000) {
    for (const [k, t] of recent) if (now - t > RECENT_TTL_MS) recent.delete(k)
  }
}

function playerCount(room) {
  try { return Number(JSON.parse(room.topic_id || '')?.playerCount) || 2 } catch { return 2 }
}

// 'joined' is legit once the room is active. The client flips the status and
// pings us in the same tick, so give that write a moment to land.
async function verifyJoined(supabase, room, id) {
  if (room.status === 'active') return true
  await sleep(700)
  const { data } = await supabase.from('rooms').select('status').eq('id', id)
  return data?.[0]?.status === 'active'
}

// 'match' is legit when enough distinct players liked the item and the sender
// is one of them. The title comes from our catalog, never from the request.
async function verifyMatch(supabase, room, id, itemId, from) {
  const item = Number(itemId)
  if (!Number.isFinite(item)) return { ok: false }
  // Swipes are append-only, so a like that was taken back is still a 'right'
  // row. Filtering on direction counted those and could fire "It's a match!"
  // for a pair that no longer exists — read every vote and keep the latest one
  // per player, exactly like the client does.
  const { data: votes } = await supabase
    .from('swipes').select('user_token, direction, created_at')
    .eq('room_id', id).eq('item_id', item)
  const latest = new Map()
  for (const v of votes || []) {
    const prev = latest.get(v.user_token)
    if (!prev || String(v.created_at || '') >= String(prev.created_at || '')) latest.set(v.user_token, v)
  }
  const likers = new Set([...latest.values()].filter(v => v.direction === 'right').map(v => v.user_token))
  if (likers.size < playerCount(room) || (from && !likers.has(from))) return { ok: false }
  const table = CATALOG_TABLE[room.type]
  if (!table) return { ok: true, title: null }
  const { data: rows } = await supabase.from(table).select('title').eq('tmdb_id', item).limit(1)
  return { ok: true, title: rows?.[0]?.title || null }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!pub || !priv || !url || !key) return res.status(503).json({ error: 'push not configured' })

  const { roomId, event, from, itemId } = req.body || {}
  const id = (roomId || '').toString().slice(0, 64)
  if (!id || !COPY[event]) return res.status(400).json({ error: 'roomId and a known event are required' })

  const signature = `${id}:${event}:${itemId ?? ''}`
  if (notifiedRecently(signature)) return res.status(200).json({ ok: true, sent: 0, skipped: 'duplicate' })

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  const { data: rooms, error: roomErr } = await supabase
    .from('rooms').select('id, type, status, topic_id').eq('id', id)
  if (roomErr) return res.status(500).json({ error: roomErr.message })
  const room = rooms?.[0]
  // Unknown room and unverified event both get 403: no enumeration hints.
  if (!room) return res.status(403).json({ error: 'not allowed' })

  let title = null
  if (event === 'joined') {
    if (!(await verifyJoined(supabase, room, id))) return res.status(403).json({ error: 'not allowed' })
  } else {
    const verified = await verifyMatch(supabase, room, id, itemId, from)
    if (!verified.ok) return res.status(403).json({ error: 'not allowed' })
    title = verified.title
  }

  const { data: subs, error } = await supabase
    .from('push_subscriptions').select('user_token, subscription').eq('room_id', id)
  if (error) return res.status(500).json({ error: error.message })

  markNotified(signature)
  webpush.setVapidDetails('mailto:hello@swaip.app', pub, priv)
  const copy = COPY[event]
  const payload = JSON.stringify({
    title: copy.title,
    body: title ? `${title} - ${copy.body}` : copy.body,
    url: `/room/${id}`,
    tag: `swaip-${id}-${event}`,   // the OS collapses repeats of the same event
  })

  let sent = 0
  await Promise.all((subs || [])
    .filter(s => s.user_token !== from)          // don't notify the person who acted
    .map(async (s) => {
      try {
        await webpush.sendNotification(s.subscription, payload)
        sent++
      } catch (e) {
        // 404/410 = subscription expired or revoked — clean it up
        if (e.statusCode === 404 || e.statusCode === 410) {
          await supabase.from('push_subscriptions').delete()
            .eq('room_id', id).eq('user_token', s.user_token)
        }
      }
    }))

  return res.status(200).json({ ok: true, sent })
}
