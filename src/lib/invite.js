// What gets handed to the OS share sheet.
//
// `url` has to be its own field, not folded into `text`. A share with text only
// is just a string as far as iOS is concerned, so AirDrop writes it to a .txt
// file and hands the recipient a document instead of a tappable link. With a
// real `url`, AirDrop sends a link, and iMessage and WhatsApp still show the
// message above it.
export function buildInvitePayload(message, url) {
  return { title: 'Swaip', text: message, url }
}

// Per-type invite copy — the message that lands in the partner's DM/text.
export const INVITE_MESSAGES = {
  movies:        '🍿 Swipe with me to pick a movie tonight',
  series:        '📺 Help me pick our next binge-watch',
  food:          '🍽️ Let\'s decide where to eat',
  activities:    '🎯 Pick something to do with me',
  conversations: '💬 Let\'s find something good to talk about',
}
