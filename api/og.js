// Per-room link previews for social crawlers.
// vercel.json rewrites /room/:id to here ONLY when the request's user-agent is a
// known social/link-preview bot — real users always fall through to the SPA, so
// this endpoint never touches the human flow. Returns a tiny HTML doc whose only
// job is to carry room-specific Open Graph / Twitter tags.

const TYPE_COPY = {
  movies:        { emoji: '🍿', title: 'Swipe with me to pick a movie', desc: 'I started a Swaip room — tap to swipe on movies with me and see what we both want to watch.' },
  series:        { emoji: '📺', title: 'Help me pick our next binge',    desc: 'I started a Swaip room — tap to swipe on TV series with me and find a show you both want.' },
  food:          { emoji: '🍽️', title: 'Let\'s decide where to eat',     desc: 'I started a Swaip room — tap to swipe on places to eat and match on where we both want to go.' },
  activities:    { emoji: '🎯', title: 'Pick something to do with me',   desc: 'I started a Swaip room — tap to swipe on things to do nearby and match on a plan.' },
  conversations: { emoji: '💬', title: 'Let\'s find something to talk about', desc: 'I started a Swaip room — tap to join and match on conversation topics.' },
}
const GENERIC = { emoji: '✨', title: 'Decide it together on Swaip', desc: 'I started a Swaip room — tap to swipe with me and instantly see what we both agree on.' }

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

async function fetchRoomType(id) {
  const base = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!base || !key || !id) return null
  try {
    const res = await fetch(`${base}/rest/v1/rooms?id=eq.${encodeURIComponent(id)}&select=type`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (!res.ok) return null
    const rows = await res.json()
    return rows?.[0]?.type || null
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  const id = (req.query?.id || '').toString().slice(0, 64)
  const type = await fetchRoomType(id)
  const copy = TYPE_COPY[type] || GENERIC
  const roomUrl = `https://swaip.app/room/${encodeURIComponent(id)}`
  const title = `${copy.emoji} ${copy.title}`
  const image = 'https://swaip.app/og-image.png'

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(title)} · Swaip</title>
<meta name="description" content="${esc(copy.desc)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Swaip" />
<meta property="og:url" content="${esc(roomUrl)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(copy.desc)}" />
<meta property="og:image" content="${image}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(copy.desc)}" />
<meta name="twitter:image" content="${image}" />
<meta http-equiv="refresh" content="0; url=${esc(roomUrl)}" />
</head>
<body>
<p>Redirecting to <a href="${esc(roomUrl)}">your Swaip room</a>…</p>
<script>location.replace(${JSON.stringify(roomUrl)})</script>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600')
  res.status(200).send(html)
}
