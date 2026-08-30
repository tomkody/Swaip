import { supabase } from './supabase'

// Web Push: "tell me when my partner joins / when we match" — so the creator
// can close the tab after sending the invite. Subscriptions are stored per
// (room, user) in Supabase; api/notify.js fans a push out to everyone else in
// the room. The whole feature is gated on VITE_VAPID_PUBLIC_KEY so it simply
// doesn't exist until the keys are configured.
//
// iOS note: Safari only delivers web push to apps added to the Home Screen
// (iOS 16.4+). Desktop and Android Chrome/Firefox work in the normal browser.

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

export function isPushSupported() {
  return Boolean(
    PUBLIC_KEY && supabase &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  )
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

// Ask permission, subscribe, and store the subscription for this room.
// Returns 'enabled' | 'denied' | 'error'.
export async function enablePushForRoom(roomId, userToken) {
  if (!isPushSupported()) return 'error'
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return 'denied'

    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY),
    })

    const { error } = await supabase.from('push_subscriptions').upsert(
      { room_id: roomId, user_token: userToken, subscription: sub.toJSON() },
      { onConflict: 'room_id,user_token' }
    )
    if (error) return 'error'
    return 'enabled'
  } catch (e) {
    console.error('[push] enable failed:', e)
    return 'error'
  }
}

// Fire-and-forget: ask the server to notify everyone else in the room.
export function notifyRoom(roomId, event, { from, title } = {}) {
  try {
    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, event, from, title }),
    }).catch(() => {})
  } catch { /* never block the flow on notifications */ }
}
