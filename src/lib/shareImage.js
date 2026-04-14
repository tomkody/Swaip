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

export async function generateShareImage({ title, posterUrl, emoji, swipeCount }) {
  const W = 1080, H = 1920
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#0D0B1A')
  bg.addColorStop(1, '#1E1535')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Decorative orb
  const orb = ctx.createRadialGradient(W * 0.8, H * 0.1, 0, W * 0.8, H * 0.1, 500)
  orb.addColorStop(0, 'rgba(247,79,94,0.25)')
  orb.addColorStop(1, 'rgba(247,79,94,0)')
  ctx.fillStyle = orb
  ctx.fillRect(0, 0, W, H)

  // Poster or emoji
  let posterBottom = H * 0.52
  if (posterUrl) {
    try {
      const img = await loadImage(posterUrl)
      const imgAspect = img.width / img.height
      const drawW = W
      const drawH = drawW / imgAspect
      const clampH = Math.min(drawH, H * 0.62)
      ctx.drawImage(img, 0, 0, W, clampH)
      posterBottom = clampH

      // fade overlay at bottom of poster
      const fade = ctx.createLinearGradient(0, clampH * 0.45, 0, clampH + 60)
      fade.addColorStop(0, 'rgba(13,11,26,0)')
      fade.addColorStop(1, 'rgba(13,11,26,1)')
      ctx.fillStyle = fade
      ctx.fillRect(0, 0, W, clampH + 60)
    } catch { /* no poster */ }
  } else if (emoji) {
    // Large emoji centered in the top half
    ctx.font = '320px serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(emoji, W / 2, H * 0.28)
    ctx.textBaseline = 'alphabetic'
    posterBottom = H * 0.52
  }

  const textStartY = posterBottom + 60

  // Swipe text
  ctx.fillStyle = 'rgba(255,255,255,0.65)'
  ctx.font = `500 46px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
  ctx.textAlign = 'center'
  const swipeText = `It took us ${swipeCount} swipe${swipeCount !== 1 ? 's' : ''}, but we finally agreed on`
  const swipeLinesH = wrapText(ctx, swipeText, W / 2, textStartY, W * 0.8, 62)

  // Title
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `800 82px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
  const titleY = textStartY + swipeLinesH + 30
  wrapText(ctx, title, W / 2, titleY, W * 0.85, 100)

  // Divider
  const divY = titleY + 120
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(W * 0.25, divY)
  ctx.lineTo(W * 0.75, divY)
  ctx.stroke()

  // Logo S box
  const logoY = H * 0.87
  const lS = 88
  const lX = W / 2 - lS / 2
  const r = 22
  ctx.beginPath()
  ctx.moveTo(lX + r, logoY)
  ctx.lineTo(lX + lS - r, logoY)
  ctx.quadraticCurveTo(lX + lS, logoY, lX + lS, logoY + r)
  ctx.lineTo(lX + lS, logoY + lS - r)
  ctx.quadraticCurveTo(lX + lS, logoY + lS, lX + lS - r, logoY + lS)
  ctx.lineTo(lX + r, logoY + lS)
  ctx.quadraticCurveTo(lX, logoY + lS, lX, logoY + lS - r)
  ctx.lineTo(lX, logoY + r)
  ctx.quadraticCurveTo(lX, logoY, lX + r, logoY)
  ctx.closePath()
  const logoGrad = ctx.createLinearGradient(lX, logoY, lX + lS, logoY + lS)
  logoGrad.addColorStop(0, '#F74F5E')
  logoGrad.addColorStop(1, '#F5B83A')
  ctx.fillStyle = logoGrad
  ctx.fill()

  ctx.fillStyle = '#FFFFFF'
  ctx.font = `800 50px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText('S', W / 2, logoY + 62)

  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.font = `500 38px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`
  ctx.fillText('swaip.app', W / 2, logoY + lS + 56)

  return canvas
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
