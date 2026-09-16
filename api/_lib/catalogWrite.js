// Shared write path for the two catalog refresh endpoints.
//
// Movies and series used to be built and written by one function. Between them
// they ran past Vercel's 60s budget, and because the series write came second
// it was the one that got cut off — the series catalog had not been refreshed
// for 16 days when that was noticed (2026-09-16). They are now separate
// endpoints with separate budgets, sharing this module.

// A run that comes back much smaller than what's already stored is a TMDB
// outage (5xx, rate limit, partial failure — detail fetches fail soft to null),
// not a catalog that genuinely shrank. Nightly churn is a few percent; anything
// past this is treated as incomplete: upsert what we got, never prune.
const MIN_COMPLETE_RATIO = 0.7

// Both refresh functions get 60s. TMDB detail calls stop being made this long
// after the start, which leaves the rest for the write (~31 chunks of ~650 KB
// for movies across 58 regions) - a run that overstays is killed mid-write.
export const DETAILS_DEADLINE_MS = 40_000

// `allowPrune: false` keeps every existing row whatever the counts say - the
// refresh endpoints pass it when the build ran out of time and skipped titles.
export async function writeCatalog(supabase, table, rows, regions, runStamp, { allowPrune = true } = {}) {
  // Rows with no platform in their region are never read (loadStreamable drops
  // them) and the builders no longer emit them. Clear out the ones already
  // stored, before counting — otherwise `before` would keep counting rows this
  // run can't produce and every future run would look "incomplete".
  await supabase.from(table).delete().in('region', regions).eq('platforms', '{}')

  // Count, don't read: a plain select is capped at 1000 rows by the API, which
  // made `before` ≤ 1000 on a ~6,000-row table and let a badly partial run
  // count as complete and prune every other row.
  const { count, error: countErr } = await supabase
    .from(table).select('tmdb_id', { count: 'exact', head: true }).in('region', regions)
  if (countErr) throw countErr
  const before = count ?? 0
  const complete = allowPrune && rows.length >= Math.max(1, Math.floor(before * MIN_COMPLETE_RATIO))

  const stamped = rows.map(r => ({ ...r, updated_at: runStamp }))
  const CHUNK = 1000
  // `popularity` was added later (supabase/catalog_popularity.sql). If the column
  // isn't there yet, drop it and retry rather than failing the whole refresh.
  let dropPopularity = false
  const strip = rows => rows.map(({ popularity, ...r }) => r)   // eslint-disable-line no-unused-vars
  const upsertChunk = async start => {
    let chunk = stamped.slice(start, start + CHUNK)
    if (dropPopularity) chunk = strip(chunk)
    let { error } = await supabase.from(table).upsert(chunk, { onConflict: 'tmdb_id,region' })
    if (error && /popularity/i.test(error.message || '')) {
      dropPopularity = true
      ;({ error } = await supabase.from(table).upsert(strip(chunk), { onConflict: 'tmdb_id,region' }))
    }
    if (error) throw error
  }
  // 58 regions put the movie table past 20 chunks, one after another, in a
  // function that has 60s for everything. The first chunk goes alone so a
  // missing popularity column is found once; the rest go four at a time.
  const starts = Array.from({ length: Math.ceil(stamped.length / CHUNK) }, (_, i) => i * CHUNK)
  if (starts.length) await upsertChunk(starts[0])
  for (let i = 1; i < starts.length; i += 4) {
    await Promise.all(starts.slice(i, i + 4).map(upsertChunk))
  }
  if (!complete) return { table, before, written: rows.length, pruned: false }
  const { error: pruneErr } = await supabase
    .from(table).delete().in('region', regions).lt('updated_at', runStamp)
  if (pruneErr) throw pruneErr
  return { table, before, written: rows.length, pruned: true }
}

// Delete decision-room data older than RETENTION_DAYS. Rooms are ephemeral
// (one sitting), so old rows are pure dead weight. Runs inside its own
// try/catch at the call site so it can never break a catalog refresh.
export async function cleanupOldData(supabase) {
  const days = Number(process.env.RETENTION_DAYS) || 30
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const counts = {}
  // Children before parents (rooms). A missing table is skipped, not fatal.
  for (const table of ['swipes', 'rankings', 'conversation_selections', 'push_subscriptions', 'room_members', 'rooms']) {
    try {
      const { count, error } = await supabase
        .from(table).delete({ count: 'exact' }).lt('created_at', cutoff)
      if (error) { counts[table] = `err:${error.code || error.message}`; continue }
      counts[table] = count ?? 0
    } catch (e) {
      counts[table] = `err:${String(e?.message || e)}`
    }
  }
  return { cutoff, days, deleted: counts }
}

// Which regions get rows, and which get their own provider discovery.
//
// Emitting a row for another country is nearly free: each title's TMDB detail
// call already returns every country's providers, so a wider list costs no
// extra API calls. Discovery is the expensive half — it runs per region per
// platform — so it stays on the core markets.
export const EMIT_REGIONS = (process.env.REGIONS || [
  'US','GB','CA','AU','IE','DE','FR','ES','IT','NL','BR','MX','IN','CZ','PL','SE',
  'AT','CH','BE','PT','DK','NO','FI','SK','HU','RO','GR','TR','BG','HR','SI','LT','LV','EE','UA','RS',
  'JP','KR','SG','HK','TW','TH','PH','MY','ID','NZ','IL','AE','SA','ZA','EG',
  'AR','CL','CO','PE','UY','CR','PA',
].join(',')).split(',').map(r => r.trim()).filter(Boolean)

export const DISCOVERY_REGIONS = (process.env.PROVIDER_REGIONS ||
  'US,GB,CA,AU,IE,DE,FR,ES,IT,NL,BR,MX,IN,CZ,PL,SE'
).split(',').map(r => r.trim()).filter(Boolean)
