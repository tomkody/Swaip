import { supabase } from './supabase'

// Passwordless accounts (Supabase magic links). Signing in gives the user a
// stable identity across devices — today that means saved-match history follows
// them; rooms and swiping stay anonymous exactly as before.

export function isAuthAvailable() {
  return Boolean(supabase)
}

export async function getUser() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data?.session?.user || null
}

export function onAuthChange(cb) {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session?.user || null))
  return () => data.subscription.unsubscribe()
}

// Send the magic link. Returns '' on success or an error message.
export async function signInWithEmail(email) {
  if (!supabase) return 'Accounts are not available right now.'
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  })
  return error ? (error.message || 'Could not send the link. Try again.') : ''
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}
