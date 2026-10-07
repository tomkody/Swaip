// Warm what the room page needs while people are still choosing options on a
// create page, so "Create Room" lands on a page that is already downloaded.
// Vite resolves this to the same chunk App.jsx lazy-loads, so nothing is
// fetched twice.
let roomPage = null
export function prefetchRoomPage() {
  if (!roomPage) roomPage = import('../pages/Room').catch(() => { roomPage = null })
  return roomPage
}
