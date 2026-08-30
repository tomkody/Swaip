// Fans a Web Push notification out to everyone subscribed in a room, except
// the sender. Called fire-and-forget from the client when a partner joins or a
// match lands. Requires VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY and the
// push_subscriptions table (supabase/push_subscriptions.sql); without them it
// responds 503 and the client feature stays hidden anyway.

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const COPY = {
  joined: { title: '🎉 They joined!', body: 'Your partner just joined your Swaip room — start swiping!' },
  match:  { title: "💘 It's a match!", body: 'You both liked the same thing — open Swaip to see it.' },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!pub || !priv || !url || !key) return res.status(503).json({ error: 'push not configured' })

  const { roomId, event, from, title } = req.body || {}
  const id = (roomId || '').toString().slice(0, 64)
  if (!id || !COPY[event]) return res.status(400).json({ error: 'roomId and a known event are required' })

  webpush.setVapidDetails('mailto:hello@swaip.app', pub, priv)
  const supabase = createClient(url, key, { auth: { persistSession: false } })

  const { data: subs, error } = await supabase
    .from('push_subscriptions').select('user_token, subscription').eq('room_id', id)
  if (error) return res.status(500).json({ error: error.message })

  const copy = COPY[event]
  const payload = JSON.stringify({
    title: copy.title,
    body: title ? `${title} — ${copy.body}` : copy.body,
    url: `/room/${id}`,
    tag: `swaip-${id}-${event}`,
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
