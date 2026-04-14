function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
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
async function generateSingleMatchImage({ title, posterUrl, emoji, swipeCount }) {
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
  wrapText(ctx, title, W / 2, textY + subH + 40, W * 0.85, 106)

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(W * 0.25, textY + subH + 170)
  ctx.lineTo(W * 0.75, textY + subH + 170)
  ctx.stroke()

  drawLogo(ctx, W, H)
  return canvas
}

// ── Multi-match share (movie/series results) ──────────────────────
async function generateMatchesImage({ items, typeLabel }) {
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

  // Orb top-right
  const orb = ctx.createRadialGradient(W * 0.85, H * 0.05, 0, W * 0.85, H * 0.05, 600)
  orb.addColorStop(0, 'rgba(247,79,94,0.22)')
  orb.addColorStop(1, 'rgba(247,79,94,0)')
  ctx.fillStyle = orb
  ctx.fillRect(0, 0, W, H)

  // Second orb bottom-left
  const orb2 = ctx.createRadialGradient(W * 0.15, H * 0.75, 0, W * 0.15, H * 0.75, 500)
  orb2.addColorStop(0, 'rgba(108,92,231,0.18)')
  orb2.addColorStop(1, 'rgba(108,92,231,0)')
  ctx.fillStyle = orb2
  ctx.fillRect(0, 0, W, H)

  // Header text
  const headerY = 140
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = `500 42px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText('We both want to watch', W / 2, headerY)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = `900 76px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
  ctx.fillText(`${items.length} ${typeLabel || 'matches'}`, W / 2, headerY + 96)

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(W * 0.1, headerY + 130)
  ctx.lineTo(W * 0.9, headerY + 130)
  ctx.stroke()

  // Movie cards — up to 5
  const displayItems = items.slice(0, 5)
  const cardStartY = headerY + 160
  const cardH = 160
  const cardGap = 20
  const cardPad = 60
  const posterW = 88
  const posterH = 124

  for (let i = 0; i < displayItems.length; i++) {
    const item = displayItems[i]
    const cy = cardStartY + i * (cardH + cardGap)

    // Card background
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    drawRoundedRect(ctx, cardPad, cy, W - cardPad * 2, cardH, 20)
    ctx.fill()

    // Poster
    const px = cardPad + 24
    const py = cy + (cardH - posterH) / 2
    if (item.poster) {
      try {
        const img = await loadImage(item.poster)
        ctx.save()
        drawRoundedRect(ctx, px, py, posterW, posterH, 10)
        ctx.clip()
        ctx.drawImage(img, px, py, posterW, posterH)
        ctx.restore()
      } catch { /* skip */ }
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      drawRoundedRect(ctx, px, py, posterW, posterH, 10)
      ctx.fill()
    }

    // Title
    const tx = px + posterW + 28
    const maxTW = W - cardPad * 2 - posterW - 80
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `700 44px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
    ctx.textAlign = 'left'

    // Clamp title to one line
    let titleText = item.title || ''
    while (ctx.measureText(titleText).width > maxTW && titleText.length > 3) {
      titleText = titleText.slice(0, -1)
    }
    if (titleText !== item.title) titleText = titleText.trimEnd() + '…'
    ctx.fillText(titleText, tx, cy + cardH / 2 - 12)

    // Year + rating
    const meta = [item.year, item.rating ? `⭐ ${item.rating}` : null].filter(Boolean).join('  ·  ')
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.font = `400 34px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
    ctx.fillText(meta, tx, cy + cardH / 2 + 46)
  }

  // If more than 5
  if (items.length > 5) {
    const moreY = cardStartY + 5 * (cardH + cardGap) + 30
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.font = `500 36px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(`+${items.length - 5} more`, W / 2, moreY)
  }

  drawLogo(ctx, W, H)
  return canvas
}

// ── Public API ────────────────────────────────────────────────────
export async function generateShareImage({ title, posterUrl, emoji, swipeCount, items, mode, typeLabel }) {
  if (mode === 'matches' && items && items.length > 1) {
    return generateMatchesImage({ items, typeLabel })
  }
  return generateSingleMatchImage({ title, posterUrl, emoji, swipeCount })
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
