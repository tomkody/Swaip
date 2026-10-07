import { useCallback, useEffect, useRef, useState } from 'react'
import { saveMatch } from './savedMatches'

const PLACE_TYPES = new Set(['food', 'activities'])

// One rule for every swipe room (movies, series, food, activities): the room's
// first match opens the full MatchModal, every later one is a MatchBurst that
// takes no tap. `matchesRef` holds the room's current matches; reading a ref
// keeps `show` safe inside realtime callbacks that never re-subscribe.
export function useMatchMoments(matchesRef) {
  const [modalItem, setModalItem] = useState(null)
  const [burstItem, setBurstItem] = useState(null)
  const [bumpKey, setBumpKey] = useState(0)      // replays the counter bump once per burst
  const [announce, setAnnounce] = useState('')   // what the live region reads out
  // Each match is celebrated once. The second liker hears about it twice (own
  // swipe, then realtime), and on a slow phone the echo came after they had
  // closed the dialog, which opened it again: "Keep swiping" seemed broken.
  // Updated synchronously, so it also settles first-vs-later between two
  // matches landing in the same moment.
  const celebratedRef = useRef(new Set())

  const show = useCallback(item => {
    const celebrated = celebratedRef.current
    if (celebrated.has(item.id)) return
    const later = matchesRef.current.some(m => m.id !== item.id) || [...celebrated].some(id => id !== item.id)
    celebrated.add(item.id)
    if (later) {
      setBurstItem(item)
      setBumpKey(k => k + 1)
      setAnnounce(`It's a match: ${item.title}`)
    } else {
      setModalItem(item)
    }
  }, [matchesRef])

  // A match that was taken back (own undo or the partner's) stops celebrating.
  // The announcement goes too: left in place, a later match with the same
  // title would set identical text and the screen reader would say nothing.
  const drop = useCallback(id => {
    celebratedRef.current.delete(id)   // matched again later, it is new again
    setModalItem(cur => (cur && cur.id === id ? null : cur))
    setBurstItem(cur => (cur && cur.id === id ? null : cur))
    setAnnounce('')
  }, [])

  const closeModal = useCallback(() => setModalItem(null), [])
  const endBurst = useCallback(() => { setBurstItem(null); setAnnounce('') }, [])

  return { modalItem, burstItem, bumpKey, announce, show, drop, closeModal, endBurst }
}

// Every match lands in Saved matches however it was found: the swipe itself,
// the partner's realtime event or the background check against the database.
// It used to be written by the modal, so a match found any other way (the last
// card, a missed realtime event) never reached the history. saveMatch dedupes.
// A place's photo is a paid Google lookup each time it loads, so places are
// kept without one (the history shows their emoji); film posters are free.
export function useSaveMatches(matches, category, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const keepImage = !PLACE_TYPES.has(category)
    for (const m of matches) {
      saveMatch({ id: m.id, title: m.title, category, image: keepImage ? m.poster || null : null, year: m.year || null, rating: m.rating || null })
    }
  }, [matches, category, enabled])
}

// The database is the truth about a room's matches, with two things it can't
// know yet: a match this player made seconds ago (the read may predate the
// insert) and a like being taken back right now (its 'left' vote is still on
// its way). Without these the counter flickered, and a taken-back match could
// come back and be saved again.
//   prev       current matches        items  the deck (movies or places)
//   ids        matched ids from the database (fetchRoomMatches)
//   keyOf      item -> the id the database uses (a place's numId)
//   recent     Map item.id -> when this player's own swipe made it a match
//   takingBack Set of item.id whose like is being undone
// Returns `prev` itself when nothing changed.
export function reconcileMatches(prev, items, ids, { keyOf = m => m.id, recent = new Map(), takingBack = new Set(), now = Date.now(), graceMs = 10000 } = {}) {
  const inDb = new Set(ids.map(Number))
  const fresh = items.filter(i => {
    if (takingBack.has(i.id)) return false
    if (inDb.has(Number(keyOf(i)))) return true
    const at = recent.get(i.id)
    return at != null && now - at < graceMs
  })
  const same = fresh.length === prev.length && fresh.every(f => prev.some(p => p.id === f.id))
  return same ? prev : fresh
}
