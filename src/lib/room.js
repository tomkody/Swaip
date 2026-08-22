import { supabase } from './supabase'
import { v4 as uuidv4 } from 'uuid'
import { detectRegion } from './tmdb'

// Sentinel item ids used to signal "I'm done" rather than a real pick.
// (activities categories, food cuisines, movie/series decks)
export const DONE_ITEM_ID = 9999999
const DONE_SENTINELS = new Set([1999, 2999, DONE_ITEM_ID])

// Supabase reuses a channel by name, and callbacks can't be added after
// subscribe() — so two components subscribing to the same room would throw.
// Every subscription gets its own channel name.
let channelSeq = 0
const uniqueChannel = (prefix, roomId) => `${prefix}-${roomId}-${++channelSeq}`

export function isRoomSolo(room) {
  if (!room?.topic_id) return false
  try {
    const parsed = JSON.parse(room.topic_id)
    return parsed?.solo === true
  } catch { return false }
}

// Read playerCount stored in topic_id JSON (defaults to 2)
export function getRoomPlayerCount(room) {
  if (!room?.topic_id) return 2
  try {
    const parsed = JSON.parse(room.topic_id)
    return parsed?.playerCount || 2
  } catch { return 2 }
}

// Count how many distinct users have any swipe in this room
export async function getParticipantCount(roomId) {
  if (!supabase) {
    const key = `swaip_swipes_${roomId}`
    const swipes = JSON.parse(localStorage.getItem(key) || '[]')
    return new Set(swipes.map(s => s.user_token)).size
  }
  const { data, error } = await supabase
    .from('swipes').select('user_token').eq('room_id', roomId)
  if (error || !data) return 0
  return new Set(data.map(s => s.user_token)).size
}

// Return vote counts per item: { [itemId]: numberOfUsersWhoLikedIt }
export async function fetchVoteCounts(roomId) {
  if (!supabase) {
    const key = `swaip_swipes_${roomId}`
    const swipes = JSON.parse(localStorage.getItem(key) || '[]')
    const byItem = {}
    for (const s of swipes) {
      if (s.direction !== 'right') continue
      const id = Number(s.item_id)
      if (!byItem[id]) byItem[id] = new Set()
      byItem[id].add(s.user_token)
    }
    return Object.fromEntries(Object.entries(byItem).map(([id, set]) => [id, set.size]))
  }
  const { data, error } = await supabase
    .from('swipes').select('user_token, item_id')
    .eq('room_id', roomId).eq('direction', 'right')
  if (error || !data) return {}
  const byItem = {}
  for (const s of data) {
    const id = Number(s.item_id)
    if (!byItem[id]) byItem[id] = new Set()
    byItem[id].add(s.user_token)
  }
  return Object.fromEntries(Object.entries(byItem).map(([id, set]) => [id, set.size]))
}

export function getUserToken() {
  let token = sessionStorage.getItem('swaip_user_token')
  if (!token) {
    token = uuidv4()
    sessionStorage.setItem('swaip_user_token', token)
  }
  return token
}

// Create a movie room
export async function createMovieRoom(platforms = [], genres = [], { solo = false } = {}) {
  const roomId = uuidv4().slice(0, 8)
  // Pin the creator's region so every partner swipes the SAME deck.
  const filters = JSON.stringify({ platforms, genres, region: detectRegion(), ...(solo && { solo: true }) })

  if (!supabase) {
    const room = { id: roomId, type: 'movies', platforms: filters, created_at: new Date().toISOString(), status: 'waiting' }
    localStorage.setItem(`swaip_room_${roomId}`, JSON.stringify(room))
    return room
  }

  const { data, error } = await supabase
    .from('rooms')
    .insert({ id: roomId, type: 'movies', topic_id: filters, status: 'waiting' })
    .select().single()

  if (error) throw error
  return { ...data, platforms: filters }
}

// Create a conversation room (topicIds is an array of topic IDs)
export async function createConversationRoom(topicIds, topicNames, { solo = false } = {}) {
  const roomId = uuidv4().slice(0, 8)
  const topicIdJson = solo
    ? JSON.stringify({ topicIds, solo: true })
    : JSON.stringify(topicIds)

  if (!supabase) {
    const room = {
      id: roomId,
      type: 'conversations',
      topic_id: topicIdJson,
      topic_name: topicNames,
      created_at: new Date().toISOString(),
      status: 'waiting',
    }
    localStorage.setItem(`swaip_room_${roomId}`, JSON.stringify(room))
    return room
  }

  const { data, error } = await supabase
    .from('rooms')
    .insert({
      id: roomId,
      type: 'conversations',
      topic_id: topicIdJson,
      topic_name: topicNames,
      status: 'waiting',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Create a TV series room
export async function createSeriesRoom(platforms = [], genres = [], { solo = false } = {}) {
  const roomId = uuidv4().slice(0, 8)
  // Pin the creator's region so every partner swipes the SAME deck.
  const filters = JSON.stringify({ platforms, genres, region: detectRegion(), ...(solo && { solo: true }) })

  if (!supabase) {
    const room = { id: roomId, type: 'series', platforms: filters, created_at: new Date().toISOString(), status: 'waiting' }
    localStorage.setItem(`swaip_room_${roomId}`, JSON.stringify(room))
    return room
  }

  const { data, error } = await supabase
    .from('rooms')
    .insert({ id: roomId, type: 'series', topic_id: filters, status: 'waiting' })
    .select().single()

  if (error) throw error
  return { ...data, platforms: filters }
}

// Check for any mutual right-swipe among a given list of numeric item IDs
export async function checkMutualSwipesByIds(roomId, userToken, itemIds, playerCount = 2) {
  if (!itemIds || itemIds.length === 0) return null

  if (!supabase) {
    const key = `swaip_swipes_${roomId}`
    const swipes = JSON.parse(localStorage.getItem(key) || '[]')
    const idSet = new Set(itemIds.map(Number))
    const rightSwipes = swipes.filter(s => s.direction === 'right' && idSet.has(Number(s.item_id)))
    const byItem = {}
    for (const s of rightSwipes) {
      const id = Number(s.item_id)
      if (!byItem[id]) byItem[id] = new Set()
      byItem[id].add(s.user_token)
    }
    for (const [itemId, tokens] of Object.entries(byItem)) {
      if (tokens.size >= playerCount) return Number(itemId)
    }
    return null
  }

  const { data, error } = await supabase
    .from('swipes')
    .select('user_token, item_id')
    .eq('room_id', roomId)
    .eq('direction', 'right')
    .in('item_id', itemIds)
  if (error || !data) return null
  const byItem = {}
  for (const s of data) {
    if (!byItem[s.item_id]) byItem[s.item_id] = new Set()
    byItem[s.item_id].add(s.user_token)
  }
  for (const [itemId, tokens] of Object.entries(byItem)) {
    if (tokens.size >= playerCount) return Number(itemId)
  }
  return null
}

// Create a food room
export async function createFoodRoom({ lat, lng, locationName, radius, countryCode, solo = false, playerCount = 2 } = {}) {
  const roomId = uuidv4().slice(0, 8)
  const pc = solo ? 1 : Math.max(2, Math.min(6, playerCount))
  const locationData = (lat != null && lng != null)
    ? JSON.stringify({ lat, lng, locationName: locationName || '', radius: radius || 5000, countryCode: countryCode || null, ...(solo && { solo: true }), ...(pc > 2 && { playerCount: pc }) })
    : (solo || pc > 2 ? JSON.stringify({ ...(solo && { solo: true }), ...(pc > 2 && { playerCount: pc }) }) : null)
  if (!supabase) {
    const room = { id: roomId, type: 'food', topic_id: locationData, created_at: new Date().toISOString(), status: 'waiting' }
    localStorage.setItem(`swaip_room_${roomId}`, JSON.stringify(room))
    return room
  }
  const { data, error } = await supabase
    .from('rooms')
    .insert({ id: roomId, type: 'food', topic_id: locationData, status: 'waiting' })
    .select().single()
  if (error) throw error
  return data
}

// Create an activity room
export async function createActivityRoom({ lat, lng, locationName, radius, solo = false, playerCount = 2 } = {}) {
  const roomId = uuidv4().slice(0, 8)
  const pc = solo ? 1 : Math.max(2, Math.min(6, playerCount))

  const locationData = (lat != null && lng != null)
    ? JSON.stringify({ lat, lng, locationName: locationName || '', radius: radius || 5000, ...(solo && { solo: true }), ...(pc > 2 && { playerCount: pc }) })
    : (solo || pc > 2 ? JSON.stringify({ ...(solo && { solo: true }), ...(pc > 2 && { playerCount: pc }) }) : null)

  if (!supabase) {
    const room = {
      id: roomId,
      type: 'activities',
      topic_id: locationData,
      phase: 'categories',
      created_at: new Date().toISOString(),
      status: 'waiting',
    }
    localStorage.setItem(`swaip_room_${roomId}`, JSON.stringify(room))
    return room
  }

  const { data, error } = await supabase
    .from('rooms')
    .insert({ id: roomId, type: 'activities', topic_id: locationData, status: 'waiting' })
    .select()
    .single()

  if (error) throw error
  return data
}

// Update activity room phase (categories → places).
// Packs phase data into topic_id so no custom DB columns are required.
// locationData should be the parsed location object { lat, lng, locationName, radius }
// already stored in topic_id — we preserve it alongside the new phase fields.
export async function updateActivityRoomPhase(roomId, { phase, matched_category, matched_categories, places, locationData }) {
  // Merge phase info into the existing topic_id JSON using _ prefixed keys
  const combined = {
    ...(locationData || {}),
    _phase: phase,
    _matched_category: matched_category || (matched_categories?.[0]) || null, // backward compat
    _matched_categories: matched_categories || (matched_category ? [matched_category] : []),
    _places: places || [],
  }
  const update = { topic_id: JSON.stringify(combined) }

  if (!supabase) {
    const key = `swaip_room_${roomId}`
    const room = JSON.parse(localStorage.getItem(key) || '{}')
    Object.assign(room, update)
    localStorage.setItem(key, JSON.stringify(room))
    return
  }

  const { error } = await supabase.from('rooms').update(update).eq('id', roomId)
  if (error) throw error
}

// Subscribe to room data changes (for activity phase transitions)
export function subscribeToRoomChanges(roomId, onUpdate) {
  if (!supabase) return () => {}

  const channel = supabase
    .channel(uniqueChannel('room-data', roomId))
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
      (payload) => onUpdate(payload.new)
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}

// Fetch actual mutual matches from DB (authoritative source)
// playerCount = how many players must all agree for a match
export async function fetchRoomMatches(roomId, userToken, playerCount = 2) {
  if (!supabase) return null // demo mode: caller uses in-memory matches

  const { data, error } = await supabase
    .from('swipes')
    .select('user_token, item_id')
    .eq('room_id', roomId)
    .eq('direction', 'right')

  if (error || !data) return []

  // Count distinct users who liked each item, and track this user's own likes.
  const likersByItem = {}
  const myLikes = new Set()
  for (const row of data) {
    const id = Number(row.item_id)
    if (DONE_SENTINELS.has(id)) continue   // "I'm done" marker, not a pick
    if (!likersByItem[id]) likersByItem[id] = new Set()
    likersByItem[id].add(row.user_token)
    if (row.user_token === userToken) myLikes.add(id)
  }

  // A match = an item THIS user liked that at least playerCount distinct users liked.
  // Keyed off playerCount (not "every participant") so results agree with the
  // real-time match check in recordSwipe / subscribeToSwipes even when more
  // people are in the room than the configured player count.
  return [...myLikes].filter(id => likersByItem[id].size >= playerCount)
}

// Mark room as active (joiner has started)
export async function markRoomActive(roomId) {
  if (!supabase) {
    const key = `swaip_room_${roomId}`
    const room = JSON.parse(localStorage.getItem(key) || '{}')
    room.status = 'active'
    localStorage.setItem(key, JSON.stringify(room))
    return
  }
  await supabase.from('rooms').update({ status: 'active' }).eq('id', roomId)
}

// Subscribe to room becoming active (creator waits for joiner)
export function subscribeToRoomActive(roomId, onActive) {
  if (!supabase) return () => {}

  const channel = supabase
    .channel(uniqueChannel('room-active', roomId))
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
      (payload) => {
        if (payload.new.status === 'active') onActive()
      }
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}

export async function getRoom(roomId) {
  if (!supabase) {
    const room = localStorage.getItem(`swaip_room_${roomId}`)
    return room ? JSON.parse(room) : null
  }

  const { data, error } = await supabase
    .from('rooms')
    .select()
    .eq('id', roomId)
    .maybeSingle()

  if (error) return null
  return data
}

// Record a swipe — returns true when playerCount distinct users all liked this item
export async function recordSwipe(roomId, userToken, itemId, direction, playerCount = 2) {
  if (!supabase) {
    const key = `swaip_swipes_${roomId}`
    const swipes = JSON.parse(localStorage.getItem(key) || '[]')
    swipes.push({ room_id: roomId, user_token: userToken, item_id: itemId, direction })
    localStorage.setItem(key, JSON.stringify(swipes))
    return checkLocalMatch(roomId, itemId, userToken, direction, playerCount)
  }

  const { error } = await supabase
    .from('swipes')
    .insert({ room_id: roomId, user_token: userToken, item_id: itemId, direction })

  if (error) throw error

  if (direction === 'right') {
    const { data: matchSwipes } = await supabase
      .from('swipes')
      .select('user_token')
      .eq('room_id', roomId)
      .eq('item_id', itemId)
      .eq('direction', 'right')

    const uniqueTokens = new Set(matchSwipes?.map(s => s.user_token) || [])
    return uniqueTokens.size >= playerCount
  }

  return false
}

function checkLocalMatch(roomId, itemId, userToken, direction, playerCount = 2) {
  if (direction !== 'right') return false
  const key = `swaip_swipes_${roomId}`
  const swipes = JSON.parse(localStorage.getItem(key) || '[]')
  const tokens = new Set(
    swipes.filter(s => s.item_id === itemId && s.direction === 'right').map(s => s.user_token)
  )
  return tokens.size >= playerCount
}

// Submit conversation selections (conversations only)
export async function submitConversationSelections(roomId, userToken, subtopicIds) {
  if (!supabase) {
    const key = `swaip_conv_${roomId}`
    const existing = JSON.parse(localStorage.getItem(key) || '{}')
    existing[userToken] = subtopicIds
    localStorage.setItem(key, JSON.stringify(existing))
    return
  }

  const rows = subtopicIds.map((id) => ({
    room_id: roomId,
    user_token: userToken,
    subtopic_id: id,
  }))

  const { error } = await supabase.from('conversation_selections').insert(rows)
  if (error) throw error
}

// Get conversation matches
export async function getConversationMatches(roomId, userToken) {
  if (!supabase) {
    const key = `swaip_conv_${roomId}`
    const selections = JSON.parse(localStorage.getItem(key) || '{}')
    const users = Object.keys(selections)
    if (users.length < 2) return { matches: [], partnerSubmitted: false }

    const myPicks = new Set(selections[userToken] || [])
    const otherUser = users.find((u) => u !== userToken)
    const theirPicks = selections[otherUser] || []
    const matches = theirPicks.filter((id) => myPicks.has(id))
    return { matches, partnerSubmitted: true }
  }

  // Get all selections for this room
  const { data, error } = await supabase
    .from('conversation_selections')
    .select()
    .eq('room_id', roomId)

  if (error) throw error

  const byUser = {}
  for (const row of data) {
    if (!byUser[row.user_token]) byUser[row.user_token] = []
    byUser[row.user_token].push(row.subtopic_id)
  }

  const users = Object.keys(byUser)
  if (users.length < 2) return { matches: [], partnerSubmitted: false }

  const myPicks = new Set(byUser[userToken] || [])
  const otherUser = users.find((u) => u !== userToken)
  const theirPicks = byUser[otherUser] || []
  const matches = theirPicks.filter((id) => myPicks.has(id))
  return { matches, partnerSubmitted: true }
}

// Subscribe to swipes (movies)
export function subscribeToSwipes(roomId, userToken, onMatch, playerCount = 2) {
  if (!supabase) return () => {}

  const channel = supabase
    .channel(uniqueChannel('room', roomId))
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'swipes',
        filter: `room_id=eq.${roomId}`,
      },
      async (payload) => {
        const swipe = payload.new
        if (swipe.user_token !== userToken && swipe.direction === 'right') {
          // Fire match when all playerCount distinct users have liked this item
          const { data } = await supabase
            .from('swipes')
            .select('user_token')
            .eq('room_id', roomId)
            .eq('item_id', swipe.item_id)
            .eq('direction', 'right')

          const uniqueTokens = new Set(data?.map(s => s.user_token) || [])
          // Only notify THIS user when they are actually part of the match.
          // Without the has(userToken) check, a match between other people in
          // the room would wrongly pop "It's a Match!" for someone who never
          // liked the item.
          if (uniqueTokens.size >= playerCount && uniqueTokens.has(userToken)) {
            onMatch(Number(swipe.item_id))
          }
        }
      }
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}

// Subscribe to conversation selections (conversations)
export function subscribeToConversationSelections(roomId, userToken, onPartnerSubmitted) {
  if (!supabase) return () => {}

  const channel = supabase
    .channel(uniqueChannel('conv', roomId))
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'conversation_selections',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        if (payload.new.user_token !== userToken) {
          onPartnerSubmitted()
        }
      }
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}

// True once we learn the rankings table isn't available in this database, so
// callers can stop polling instead of repeating 404s every 15s.
export let rankingsUnavailable = false

// Submit top-3 rankings
export async function submitRankings(roomId, userToken, itemIds) {
  if (!supabase) {
    const key = `swaip_rankings_${roomId}`
    const existing = JSON.parse(localStorage.getItem(key) || '{}')
    existing[userToken] = itemIds
    localStorage.setItem(key, JSON.stringify(existing))
    return
  }
  // Delete old rankings for this user first, then insert new ones
  if (rankingsUnavailable) return
  await supabase.from('rankings').delete().eq('room_id', roomId).eq('user_token', userToken)
  if (itemIds.length === 0) return
  const rows = itemIds.map((id, i) => ({ room_id: roomId, user_token: userToken, item_id: id, rank: i + 1 }))
  const { error } = await supabase.from('rankings').insert(rows)
  if (error) {
    if (error.code === 'PGRST205') { rankingsUnavailable = true; return }
    throw error
  }
}

// Get rankings for this room
export async function getRankings(roomId, userToken) {
  if (!supabase) {
    const key = `swaip_rankings_${roomId}`
    const data = JSON.parse(localStorage.getItem(key) || '{}')
    const myRanking = data[userToken] || null
    const otherUser = Object.keys(data).find(u => u !== userToken)
    const partnerRanking = otherUser ? data[otherUser] : null
    return { myRanking, partnerRanking, partnerSubmitted: !!partnerRanking }
  }
  if (rankingsUnavailable) return { myRanking: null, partnerRanking: null, partnerSubmitted: false, unavailable: true }
  const { data, error } = await supabase.from('rankings').select().eq('room_id', roomId).order('rank')
  if (error) {
    // PGRST205 = table missing from the schema cache
    if (error.code === 'PGRST205') rankingsUnavailable = true
    return { myRanking: null, partnerRanking: null, partnerSubmitted: false, unavailable: rankingsUnavailable }
  }
  const byUser = {}
  for (const row of data) {
    if (!byUser[row.user_token]) byUser[row.user_token] = []
    byUser[row.user_token].push(row.item_id)
  }
  const myRanking = byUser[userToken] || null
  const otherUser = Object.keys(byUser).find(u => u !== userToken)
  const partnerRanking = otherUser ? byUser[otherUser] : null
  return { myRanking, partnerRanking, partnerSubmitted: !!partnerRanking }
}

// Subscribe to partner submitting rankings
export function subscribeToRankings(roomId, userToken, onPartnerSubmitted) {
  if (!supabase) return () => {}
  const channel = supabase
    .channel(uniqueChannel('rankings', roomId))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rankings', filter: `room_id=eq.${roomId}` },
      (payload) => { if (payload.new.user_token !== userToken && payload.new.rank === 1) onPartnerSubmitted() }
    )
    .subscribe()
  return () => supabase.removeChannel(channel)
}

// Subscribe to room presence
export function subscribeToRoom(roomId, onJoin) {
  if (!supabase) return () => {}

  const channel = supabase
    .channel(uniqueChannel('presence', roomId))
    .on('presence', { event: 'join' }, () => {
      onJoin()
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ user: getUserToken() })
      }
    })

  return () => supabase.removeChannel(channel)
}

// ── Partner picks ─────────────────────────────────────────────────────────────
// Everything the results screen needs to compare choices, in one round-trip:
//   myIds      — items THIS user liked
//   partnerIds — items at least one OTHER user liked
//   mutualIds  — liked by this user AND at least one other
//   countsById — distinct likers per item (for "3/4 picked this")
//   participants — distinct users who have swiped at all
// Ignores the done-sentinel rows so they never show up as picks.
export async function fetchRoomPicks(roomId, userToken) {
  let rows = []
  if (!supabase) {
    rows = JSON.parse(localStorage.getItem(`swaip_swipes_${roomId}`) || '[]')
      .filter(s => s.direction === 'right')
  } else {
    const { data, error } = await supabase
      .from('swipes')
      .select('user_token, item_id')
      .eq('room_id', roomId)
      .eq('direction', 'right')
    if (error || !data) return null
    rows = data
  }

  const countsById = {}
  const likersByItem = {}
  const myLikes = new Set()
  const otherLikes = new Set()
  const participants = new Set()
  const doneUsers = new Set()

  for (const r of rows) {
    const id = Number(r.item_id)
    if (DONE_SENTINELS.has(id)) { participants.add(r.user_token); doneUsers.add(r.user_token); continue }
    participants.add(r.user_token)
    if (!likersByItem[id]) likersByItem[id] = new Set()
    likersByItem[id].add(r.user_token)
    if (r.user_token === userToken) myLikes.add(id)
    else otherLikes.add(id)
  }
  for (const [id, set] of Object.entries(likersByItem)) countsById[id] = set.size

  return {
    participants: participants.size,
    // how many OTHER players have signalled they finished swiping
    othersDone: [...doneUsers].filter(t => t !== userToken).length,
    iAmDone: doneUsers.has(userToken),
    myIds: [...myLikes],
    partnerIds: [...otherLikes],
    mutualIds: [...myLikes].filter(id => otherLikes.has(id)),
    countsById,
  }
}

// Subscribe to EVERY swipe by anyone else in the room (not just matches), so the
// results screen can live-update what the partner has picked.
export function subscribeToRoomPicks(roomId, userToken, onPartnerSwipe) {
  if (!supabase) return () => {}
  const channel = supabase
    .channel(uniqueChannel('picks', roomId))
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'swipes', filter: `room_id=eq.${roomId}` },
      (payload) => {
        if (payload.new.user_token !== userToken) onPartnerSwipe(payload.new)
      }
    )
    .subscribe()
  return () => supabase.removeChannel(channel)
}
