import { supabase } from './supabase'
import { v4 as uuidv4 } from 'uuid'

export function getUserToken() {
  let token = sessionStorage.getItem('swaip_user_token')
  if (!token) {
    token = uuidv4()
    sessionStorage.setItem('swaip_user_token', token)
  }
  return token
}

// Create a movie room
export async function createMovieRoom() {
  const roomId = uuidv4().slice(0, 8)

  if (!supabase) {
    const room = {
      id: roomId,
      type: 'movies',
      created_at: new Date().toISOString(),
      status: 'waiting',
    }
    localStorage.setItem(`swaip_room_${roomId}`, JSON.stringify(room))
    return room
  }

  const { data, error } = await supabase
    .from('rooms')
    .insert({ id: roomId, type: 'movies', status: 'waiting' })
    .select()
    .single()

  if (error) throw error
  return data
}

// Create a conversation room (topicIds is an array of topic IDs)
export async function createConversationRoom(topicIds, topicNames) {
  const roomId = uuidv4().slice(0, 8)
  const topicIdJson = JSON.stringify(topicIds)

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
export async function createSeriesRoom() {
  const roomId = uuidv4().slice(0, 8)

  if (!supabase) {
    const room = {
      id: roomId,
      type: 'series',
      created_at: new Date().toISOString(),
      status: 'waiting',
    }
    localStorage.setItem(`swaip_room_${roomId}`, JSON.stringify(room))
    return room
  }

  const { data, error } = await supabase
    .from('rooms')
    .insert({ id: roomId, type: 'series', status: 'waiting' })
    .select()
    .single()

  if (error) throw error
  return data
}

// Create an activity room
export async function createActivityRoom() {
  const roomId = uuidv4().slice(0, 8)

  if (!supabase) {
    const room = {
      id: roomId,
      type: 'activities',
      created_at: new Date().toISOString(),
      status: 'waiting',
    }
    localStorage.setItem(`swaip_room_${roomId}`, JSON.stringify(room))
    return room
  }

  const { data, error } = await supabase
    .from('rooms')
    .insert({ id: roomId, type: 'activities', status: 'waiting' })
    .select()
    .single()

  if (error) throw error
  return data
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
    .single()

  if (error) return null
  return data
}

// Record a swipe (movies only)
export async function recordSwipe(roomId, userToken, itemId, direction) {
  if (!supabase) {
    const key = `swaip_swipes_${roomId}`
    const swipes = JSON.parse(localStorage.getItem(key) || '[]')
    swipes.push({ room_id: roomId, user_token: userToken, item_id: itemId, direction })
    localStorage.setItem(key, JSON.stringify(swipes))
    return checkLocalMatch(roomId, itemId, userToken, direction)
  }

  const { error } = await supabase
    .from('swipes')
    .insert({ room_id: roomId, user_token: userToken, item_id: itemId, direction })

  if (error) throw error

  if (direction === 'right') {
    const { data: matchSwipes } = await supabase
      .from('swipes')
      .select()
      .eq('room_id', roomId)
      .eq('item_id', itemId)
      .eq('direction', 'right')
      .neq('user_token', userToken)

    return matchSwipes && matchSwipes.length > 0
  }

  return false
}

function checkLocalMatch(roomId, itemId, userToken, direction) {
  if (direction !== 'right') return false
  const key = `swaip_swipes_${roomId}`
  const swipes = JSON.parse(localStorage.getItem(key) || '[]')
  return swipes.some(
    (s) => s.item_id === itemId && s.direction === 'right' && s.user_token !== userToken
  )
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
export function subscribeToSwipes(roomId, userToken, onMatch) {
  if (!supabase) return () => {}

  const channel = supabase
    .channel(`room-${roomId}`)
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
          const { data } = await supabase
            .from('swipes')
            .select()
            .eq('room_id', roomId)
            .eq('item_id', swipe.item_id)
            .eq('direction', 'right')
            .eq('user_token', userToken)

          if (data && data.length > 0) {
            onMatch(swipe.item_id)
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
    .channel(`conv-${roomId}`)
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

// Subscribe to room presence
export function subscribeToRoom(roomId, onJoin) {
  if (!supabase) return () => {}

  const channel = supabase
    .channel(`presence-${roomId}`)
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
