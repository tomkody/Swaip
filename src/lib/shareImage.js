import { getPlatformMeta } from './platforms'

function imgFromUrl(url, crossOrigin) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (crossOrigin) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

// Load a poster for the canvas. iOS Safari won't reliably give a canvas a
// CORS-clean <img> (crossOrigin loads get served the page's already-cached,
// non-CORS copy → the canvas taints and export fails). Fetching the bytes and
// loading them from a same-origin blob URL sidesteps that entirely; fall back
// to a direct crossOrigin load if fetch is blocked.
async function loadImage(src) {
  try {
    const res = await fetch(src, { mode: 'cors', cache: 'reload' })
    if (res.ok) {
      const url = URL.createObjectURL(await res.blob())
      try { return await imgFromUrl(url, false) }
      finally { URL.revokeObjectURL(url) }
    }
  } catch { /* fall through */ }
  return imgFromUrl(src, true)
}

// #RGB / #RRGGBB → rgba() string
function withAlpha(hex, a) {
  const h = (hex || '#ffffff').replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const n = parseInt(full, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ')
  let line = ''
  const lines = []
  for (const word of words) {
    const test = line ? line + ' ' + word : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  const totalH = lines.length * lineHeight
  let curY = y - (totalH - lineHeight) / 2
  for (const l of lines) {
    ctx.fillText(l, x, curY)
    curY += lineHeight
  }
  return lines.length * lineHeight
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// Cached Swaip icon (transparent-bg PNG) for the watermark
let _iconPromise = null
function loadIcon() {
  if (!_iconPromise) _iconPromise = loadImage('/swaip-icon-transparent.png').catch(() => null)
  return _iconPromise
}

// The share cards were built before the sunset palette and still used a plum
// background with a violet orb — nothing the app itself looks like. One helper
// now paints all three: the app's dark ground with coral and amber glows.
const SHARE_BG_TOP = '#10121C'
const SHARE_BG_BOTTOM = '#1A1520'
function drawShareBackground(ctx, W, H) {
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, SHARE_BG_TOP)
  bg.addColorStop(1, SHARE_BG_BOTTOM)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  const coral = ctx.createRadialGradient(W * 0.88, H * 0.04, 0, W * 0.88, H * 0.04, 720)
  coral.addColorStop(0, 'rgba(255,94,98,0.30)')
  coral.addColorStop(1, 'rgba(255,94,98,0)')
  ctx.fillStyle = coral
  ctx.fillRect(0, 0, W, H)

  const amber = ctx.createRadialGradient(W * 0.12, H * 0.84, 0, W * 0.12, H * 0.84, 660)
  amber.addColorStop(0, 'rgba(255,179,71,0.22)')
  amber.addColorStop(1, 'rgba(255,179,71,0)')
  ctx.fillStyle = amber
  ctx.fillRect(0, 0, W, H)
}

async function drawLogo(ctx, W, H) {
  const logoY = H - 200
  const lS = 88
  const lX = W / 2 - lS / 2
  const r = 22

  // White rounded tile so the dark half of the icon stays visible on the
  // dark share background — mirrors the real Swaip app icon.
  drawRoundedRect(ctx, lX, logoY, lS, lS, r)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()

  const icon = await loadIcon()
  if (icon) {
    const pad = 12
    ctx.drawImage(icon, lX + pad, logoY + pad, lS - pad * 2, lS - pad * 2)
  }

  // "swaip.app" alone told nobody what to do with it. The card is shared to
  // get the other person to play, so say that.
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.font = `700 40px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText('Swipe together at swaip.app', W / 2, logoY + lS + 56)
}

// ── Single-match share (food / single movie) ──────────────────────
async function generateSingleMatchImage({ title, posterUrl, emoji, swipeCount, platforms, rating, year, solo = false }) {
  const W = 1080, H = 1920
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')

  drawShareBackground(ctx, W, H)

  let posterBottom = H * 0.52

  if (posterUrl) {
    try {
      const img = await loadImage(posterUrl)
      const imgAspect = img.width / img.height
      const clampH = Math.min(W / imgAspect, H * 0.62)
      ctx.drawImage(img, 0, 0, W, clampH)
      posterBottom = clampH
      const fade = ctx.createLinearGradient(0, clampH * 0.45, 0, clampH + 60)
      fade.addColorStop(0, 'rgba(13,11,26,0)')
      fade.addColorStop(1, 'rgba(13,11,26,1)')
      ctx.fillStyle = fade
      ctx.fillRect(0, 0, W, clampH + 60)
    } catch { /* skip */ }
  } else if (emoji) {
    ctx.font = '320px serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(emoji, W / 2, H * 0.28)
    ctx.textBaseline = 'alphabetic'
  }

  const textY = posterBottom + 70
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = `500 46px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
  ctx.textAlign = 'center'
  const sub = solo
    ? (swipeCount != null
        ? `Out of ${swipeCount} swipe${swipeCount !== 1 ? 's' : ''}, I picked`
        : `I want to watch`)
    : (swipeCount != null
        ? `It took us ${swipeCount} swipe${swipeCount !== 1 ? 's' : ''}, but we finally agreed on`
        : `We both agreed on`)
  const subH = wrapText(ctx, sub, W / 2, textY, W * 0.8, 62)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = `800 88px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
  const titleY = textY + subH + 40
  const titleH = wrapText(ctx, title, W / 2, titleY, W * 0.85, 106)
  let cursorY = titleY + titleH / 2 + 44

  // Year · rating
  const meta = [year, rating ? `★ ${rating}` : null].filter(Boolean).join('   ·   ')
  if (meta) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = `400 40px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(meta, W / 2, cursorY)
    cursorY += 40
  }

  // Platform chips (centered)
  const metas = (platforms || []).map(getPlatformMeta).filter(Boolean)
  if (metas.length > 0) {
    drawPlatformChips(ctx, platforms, 0, cursorY + 14, W, W / 2)
    cursorY += 74
  }

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(W * 0.3, cursorY + 44)
  ctx.lineTo(W * 0.7, cursorY + 44)
  ctx.stroke()

  await drawLogo(ctx, W, H)
  return canvas
}

// Draw a row of platform brand chips. Left-aligned from x, or centered on
// centerAt when provided.
function drawPlatformChips(ctx, platforms, x, y, maxWidth, centerAt = null) {
  const metas = (platforms || []).map(getPlatformMeta).filter(Boolean).slice(0, 3)
  if (metas.length === 0) return
  const chipH = 46, padX = 18, gap = 12
  ctx.font = `600 28px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  let cx = x
  if (centerAt != null) {
    let total = 0
    metas.forEach((m, i) => { total += ctx.measureText(m.name).width + padX * 2 + (i > 0 ? gap : 0) })
    cx = centerAt - total / 2
  }
  for (const m of metas) {
    const chipW = ctx.measureText(m.name).width + padX * 2
    if (centerAt == null && cx + chipW > x + maxWidth) break
    ctx.fillStyle = withAlpha(m.color, 0.18)
    drawRoundedRect(ctx, cx, y, chipW, chipH, chipH / 2)
    ctx.fill()
    ctx.fillStyle = m.color === '#ffffff' ? 'rgba(255,255,255,0.92)' : m.color
    ctx.fillText(m.name, cx + padX, y + chipH / 2 + 1)
    cx += chipW + gap
  }
  ctx.textBaseline = 'alphabetic'
}

// ── Multi-match share (movie/series results) ──────────────────────
async function generateMatchesImage({ items, typeLabel, recommendation, solo = false }) {
  const W = 1080, H = 1920
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')

  drawShareBackground(ctx, W, H)

  // Header
  const headerY = 150
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = `600 40px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(solo ? 'I want to watch' : 'We both want to watch', W / 2, headerY)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = `900 88px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
  ctx.fillText(`${items.length} ${typeLabel || 'matches'}`, W / 2, headerY + 104)

  const dividerY = headerY + 150

  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(W * 0.12, dividerY)
  ctx.lineTo(W * 0.88, dividerY)
  ctx.stroke()

  // "Play this" recommendation caption
  let contentTop = dividerY + 50
  if (recommendation) {
    ctx.fillStyle = 'rgba(247,120,74,0.95)'
    ctx.font = `700 36px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
    ctx.textAlign = 'center'
    let rec = `▶ Tonight: ${recommendation}`
    while (ctx.measureText(rec).width > W * 0.82 && rec.length > 12) rec = rec.slice(0, -1)
    if (!rec.endsWith(recommendation) && !rec.endsWith('…')) rec = rec.trimEnd() + '…'
    ctx.fillText(rec, W / 2, contentTop + 12)
    contentTop += 62
  }

  // Cards — up to 4, poster + title + meta + platform chips
  const displayItems = items.slice(0, 4)
  const cardPad = 56
  const cardW = W - cardPad * 2
  const cardH = 216
  const cardGap = 24
  const cardStartY = contentTop
  const posterW = 120, posterH = 172
  const emojiMap = { series: '📺', activities: '🎯', food: '🍽️' }
  const fallbackEmoji = emojiMap[typeLabel] || '🎬'

  for (let i = 0; i < displayItems.length; i++) {
    const item = displayItems[i]
    const cy = cardStartY + i * (cardH + cardGap)

    // Card
    ctx.fillStyle = 'rgba(255,255,255,0.055)'
    drawRoundedRect(ctx, cardPad, cy, cardW, cardH, 26)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1.5
    drawRoundedRect(ctx, cardPad, cy, cardW, cardH, 26)
    ctx.stroke()

    // Poster (with fallback tile)
    const px = cardPad + 22
    const py = cy + (cardH - posterH) / 2
    let posterOk = false
    if (item.poster) {
      try {
        const img = await loadImage(item.poster)
        ctx.save()
        drawRoundedRect(ctx, px, py, posterW, posterH, 12)
        ctx.clip()
        const ar = img.width / img.height, tar = posterW / posterH
        let sw = img.width, sh = img.height, sx = 0, sy = 0
        if (ar > tar) { sw = img.height * tar; sx = (img.width - sw) / 2 }
        else { sh = img.width / tar; sy = (img.height - sh) / 2 }
        ctx.drawImage(img, sx, sy, sw, sh, px, py, posterW, posterH)
        ctx.restore()
        posterOk = true
      } catch { /* fall through to placeholder */ }
    }
    if (!posterOk) {
      const pg = ctx.createLinearGradient(px, py, px + posterW, py + posterH)
      pg.addColorStop(0, 'rgba(247,120,74,0.35)')
      pg.addColorStop(1, 'rgba(120,92,231,0.35)')
      ctx.fillStyle = pg
      drawRoundedRect(ctx, px, py, posterW, posterH, 12)
      ctx.fill()
      ctx.font = '64px serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(fallbackEmoji, px + posterW / 2, py + posterH / 2)
      ctx.textBaseline = 'alphabetic'
    }

    // Text column
    const tx = px + posterW + 32
    const maxTW = cardPad + cardW - tx - 28

    // Title (clamped to one line)
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `700 46px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
    ctx.textAlign = 'left'
    let titleText = item.title || ''
    if (ctx.measureText(titleText).width > maxTW) {
      while (ctx.measureText(titleText + '…').width > maxTW && titleText.length > 3) titleText = titleText.slice(0, -1)
      titleText = titleText.trimEnd() + '…'
    }
    ctx.fillText(titleText, tx, cy + 66)

    // Year · rating
    const meta = [item.year, item.rating ? `★ ${item.rating}` : null].filter(Boolean).join('   ·   ')
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = `400 34px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
    ctx.fillText(meta, tx, cy + 116)

    // Platform chips
    drawPlatformChips(ctx, item.platforms, tx, cy + 138, maxTW)
  }

  if (items.length > 4) {
    const moreY = cardStartY + 4 * (cardH + cardGap) + 24
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = `600 36px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(`+ ${items.length - 4} more`, W / 2, moreY)
  }

  await drawLogo(ctx, W, H)
  return canvas
}

// ── Conversation share (matched topics + a sample deep-talk question) ──
// items: [{ emoji, name, question }]
async function generateConversationImage({ items, solo = false }) {
  const W = 1080, H = 1920
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')

  drawShareBackground(ctx, W, H)

  // Header
  const headerY = 150
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = `600 40px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(solo ? 'I want to talk about' : 'We both want to talk about', W / 2, headerY)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `900 88px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
  ctx.fillText(`${items.length} topic${items.length !== 1 ? 's' : ''}`, W / 2, headerY + 104)

  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(W * 0.12, headerY + 150); ctx.lineTo(W * 0.88, headerY + 150); ctx.stroke()

  // Cards — up to 4 topics, each with a sample question
  const shown = items.slice(0, 4)
  const cardPad = 56
  const cardW = W - cardPad * 2
  const cardGap = 26
  let cy = headerY + 210
  ctx.textAlign = 'left'
  for (const it of shown) {
    // Measure question height first (so the card fits)
    ctx.font = `400 38px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
    const qLines = []
    { // wrap into up to 3 lines
      const words = (it.question || '').split(' ')
      let line = ''
      for (const w of words) {
        const test = line ? line + ' ' + w : w
        if (ctx.measureText(test).width > cardW - 56 && line) { qLines.push(line); line = w }
        else line = test
      }
      if (line) qLines.push(line)
    }
    const qShown = qLines.slice(0, 3)
    if (qLines.length > 3) qShown[2] = qShown[2].replace(/\s+\S*$/, '') + '…'
    const cardH = 96 + qShown.length * 48

    ctx.fillStyle = 'rgba(255,255,255,0.055)'
    drawRoundedRect(ctx, cardPad, cy, cardW, cardH, 26); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1.5
    drawRoundedRect(ctx, cardPad, cy, cardW, cardH, 26); ctx.stroke()

    // Emoji + topic name
    ctx.textAlign = 'left'
    ctx.font = `44px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", serif`
    ctx.fillText(it.emoji || '💬', cardPad + 28, cy + 62)
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `700 44px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
    ctx.fillText(it.name || '', cardPad + 92, cy + 60)

    // Question lines
    ctx.fillStyle = 'rgba(255,255,255,0.62)'
    ctx.font = `400 38px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
    let qy = cy + 118
    for (const l of qShown) { ctx.fillText(l, cardPad + 28, qy); qy += 48 }

    cy += cardH + cardGap
  }

  if (items.length > 4) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = `600 36px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(`+ ${items.length - 4} more`, W / 2, cy + 24)
  }

  await drawLogo(ctx, W, H)
  return canvas
}

// ── Public API ────────────────────────────────────────────────────
export async function generateShareImage({ title, posterUrl, emoji, swipeCount, items, mode, typeLabel, platforms, rating, year, recommendation, solo = false }) {
  if (mode === 'conversation' && items) {
    return generateConversationImage({ items, solo })
  }
  if (mode === 'matches' && items && items.length > 1) {
    return generateMatchesImage({ items, typeLabel, recommendation, solo })
  }
  // Single match — pull details from items[0] when the caller passed a list.
  const single = items && items.length === 1 ? items[0] : {}
  return generateSingleMatchImage({
    title, posterUrl, emoji, swipeCount, solo,
    platforms: platforms ?? single.platforms,
    rating: rating ?? single.rating,
    year: year ?? single.year,
  })
}

export function downloadCanvas(canvas, filename = 'swaip-match.png') {
  canvas.toBlob(blob => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}
