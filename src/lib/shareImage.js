import { getPlatformMeta } from './platforms'

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
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

function drawLogo(ctx, W, H) {
  const logoY = H - 200
  const lS = 88
  const lX = W / 2 - lS / 2
  const r = 22
  drawRoundedRect(ctx, lX, logoY, lS, lS, r)
  const logoGrad = ctx.createLinearGradient(lX, logoY, lX + lS, logoY + lS)
  logoGrad.addColorStop(0, '#F74F5E')
  logoGrad.addColorStop(1, '#F5B83A')
  ctx.fillStyle = logoGrad
  ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `800 50px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText('S', W / 2, logoY + 62)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = `500 36px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
  ctx.fillText('swaip.app', W / 2, logoY + lS + 52)
}

// ── Single-match share (food / single movie) ──────────────────────
async function generateSingleMatchImage({ title, posterUrl, emoji, swipeCount, platforms, rating, year, compat }) {
  const W = 1080, H = 1920
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#0D0B1A')
  bg.addColorStop(1, '#1E1535')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Orb
  const orb = ctx.createRadialGradient(W * 0.8, H * 0.1, 0, W * 0.8, H * 0.1, 500)
  orb.addColorStop(0, 'rgba(247,79,94,0.25)')
  orb.addColorStop(1, 'rgba(247,79,94,0)')
  ctx.fillStyle = orb
  ctx.fillRect(0, 0, W, H)

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
  const sub = swipeCount != null
    ? `It took us ${swipeCount} swipe${swipeCount !== 1 ? 's' : ''}, but we finally agreed on`
    : `We both agreed on`
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

  // Compatibility pill — just below the divider
  if (compat != null) {
    const tier = compat >= 90 ? '💞' : compat >= 75 ? '🔥' : compat >= 55 ? '✨' : compat >= 40 ? '🧲' : '😅'
    const pillText = `${tier} ${compat}% compatible`
    ctx.font = `700 40px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
    const pw = ctx.measureText(pillText).width + 56
    const ph = 68, pillY = cursorY + 88, px = W / 2 - pw / 2
    const pg = ctx.createLinearGradient(px, pillY, px + pw, pillY)
    pg.addColorStop(0, 'rgba(247,79,94,0.28)')
    pg.addColorStop(1, 'rgba(247,120,74,0.28)')
    ctx.fillStyle = pg
    drawRoundedRect(ctx, px, pillY, pw, ph, ph / 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(247,120,74,0.55)'
    ctx.lineWidth = 2
    drawRoundedRect(ctx, px, pillY, pw, ph, ph / 2)
    ctx.stroke()
    ctx.fillStyle = '#FFFFFF'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(pillText, W / 2, pillY + ph / 2 + 2)
    ctx.textBaseline = 'alphabetic'
  }

  drawLogo(ctx, W, H)
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
async function generateMatchesImage({ items, typeLabel, compat, recommendation }) {
  const W = 1080, H = 1920
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')

  // Background — deep warm-tinted plum
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#141019')
  bg.addColorStop(1, '#241528')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Warm orb top-right
  const orb = ctx.createRadialGradient(W * 0.9, H * 0.02, 0, W * 0.9, H * 0.02, 720)
  orb.addColorStop(0, 'rgba(247,120,74,0.28)')
  orb.addColorStop(1, 'rgba(247,120,74,0)')
  ctx.fillStyle = orb
  ctx.fillRect(0, 0, W, H)

  // Cool orb bottom-left
  const orb2 = ctx.createRadialGradient(W * 0.12, H * 0.82, 0, W * 0.12, H * 0.82, 620)
  orb2.addColorStop(0, 'rgba(120,92,231,0.20)')
  orb2.addColorStop(1, 'rgba(120,92,231,0)')
  ctx.fillStyle = orb2
  ctx.fillRect(0, 0, W, H)

  // Header
  const headerY = 150
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = `600 40px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText('We both want to watch', W / 2, headerY)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = `900 88px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
  ctx.fillText(`${items.length} ${typeLabel || 'matches'}`, W / 2, headerY + 104)

  let dividerY = headerY + 150

  // Compatibility pill — the shareable headline number
  if (compat != null) {
    const tier = compat >= 90 ? '💞' : compat >= 75 ? '🔥' : compat >= 55 ? '✨' : compat >= 40 ? '🧲' : '😅'
    const pillText = `${tier} ${compat}% compatible`
    ctx.font = `700 40px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
    const pw = ctx.measureText(pillText).width + 56
    const ph = 68, pillY = headerY + 150, px = W / 2 - pw / 2
    const pg = ctx.createLinearGradient(px, pillY, px + pw, pillY)
    pg.addColorStop(0, 'rgba(247,79,94,0.28)')
    pg.addColorStop(1, 'rgba(247,120,74,0.28)')
    ctx.fillStyle = pg
    drawRoundedRect(ctx, px, pillY, pw, ph, ph / 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(247,120,74,0.55)'
    ctx.lineWidth = 2
    drawRoundedRect(ctx, px, pillY, pw, ph, ph / 2)
    ctx.stroke()
    ctx.fillStyle = '#FFFFFF'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(pillText, W / 2, pillY + ph / 2 + 2)
    ctx.textBaseline = 'alphabetic'
    dividerY = pillY + ph + 40
  }

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

  drawLogo(ctx, W, H)
  return canvas
}

// ── Public API ────────────────────────────────────────────────────
export async function generateShareImage({ title, posterUrl, emoji, swipeCount, items, mode, typeLabel, platforms, rating, year, compat, recommendation }) {
  if (mode === 'matches' && items && items.length > 1) {
    return generateMatchesImage({ items, typeLabel, compat, recommendation })
  }
  // Single match — pull details from items[0] when the caller passed a list.
  const single = items && items.length === 1 ? items[0] : {}
  return generateSingleMatchImage({
    title, posterUrl, emoji, swipeCount,
    platforms: platforms ?? single.platforms,
    rating: rating ?? single.rating,
    year: year ?? single.year,
    compat,
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
