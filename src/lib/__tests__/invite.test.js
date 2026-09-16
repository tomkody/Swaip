import { describe, it, expect } from 'vitest'
import { buildInvitePayload } from '../../components/InvitePanel'

// AirDrop turned an invite into a .txt attachment because the share payload was
// text only — the link was concatenated into the message instead of being its
// own field. iOS then had nothing to recognise as a link.
describe('buildInvitePayload', () => {
  const url = 'https://swaip.app/room/282f7efe'

  it('hands the URL over as a real url, not buried in the text', () => {
    const p = buildInvitePayload('🍿 Swipe with me to pick a movie tonight', url)
    expect(p.url).toBe(url)
    expect(p.text).not.toContain(url)
  })

  it('still carries the message, so chats show it above the link', () => {
    const p = buildInvitePayload('🍽️ Let\'s decide where to eat', url)
    expect(p.text).toBe('🍽️ Let\'s decide where to eat')
  })
})
