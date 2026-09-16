import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials not found. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env'
  )
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// ── Anonymous session ─────────────────────────────────────────────────────────
// Row-level security needs something to hang an identity on. The anon KEY is
// shipped in the bundle and is the same for everybody, so it can't be one —
// under `using (true)` policies anyone holding it can read every room and every
// swipe in the database. An anonymous sign-in gives each browser its own JWT,
// which the policies (supabase/rls.sql) match against room membership.
//
// This is deliberately best-effort: if anonymous sign-ins are disabled in the
// project, or the network is down, we log once and carry on with the plain anon
// key. That keeps the app working while the policies are still permissive, and
// it's why the rollout order is "ship this, verify, then tighten the policies".
let sessionPromise = null
let signInWarned = false

export function ensureSession() {
  if (!supabase) return Promise.resolve(null)
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const { data } = await supabase.auth.getSession()
      if (data?.session) return data.session
      const { data: created, error } = await supabase.auth.signInAnonymously()
      if (error) {
        if (!signInWarned) {
          signInWarned = true
          console.warn('[supabase] anonymous sign-in unavailable:', error.message)
        }
        sessionPromise = null      // let a later call retry
        return null
      }
      return created?.session || null
    })()
  }
  return sessionPromise
}

// The signed-in user's id, or null while we're running without a session.
export async function getAuthUserId() {
  const session = await ensureSession()
  return session?.user?.id || null
}
