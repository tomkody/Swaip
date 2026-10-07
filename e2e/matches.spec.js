import { test, expect } from '@playwright/test'

// Beyond the first card: the first match opens the dialog, later ones are a
// short burst into the counter, and a closed dialog stays closed. Real
// Supabase, like two-player.spec.js.
test.skip(!process.env.VITE_SUPABASE_URL, 'needs VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')

async function room(browser) {
  const creator = await browser.newContext()
  const partner = await browser.newContext()
  const a = await creator.newPage()
  const b = await partner.newPage()
  const logs = []
  for (const [who, p] of [['A', a], ['B', b]]) {
    p.on('pageerror', e => logs.push(`${who} pageerror: ${e.message}`))
    p.on('console', m => { if (m.type() === 'error') logs.push(`${who} console: ${m.text()}`) })
  }
  await a.goto('/create/movies')
  await a.getByRole('button', { name: 'Create Room' }).click()
  await expect(a).toHaveURL(/\/room\/[a-z0-9]{8}$/)
  const url = a.url()
  await b.goto(url)
  await b.getByRole('button', { name: /Start swiping/i }).click()
  await expect(a.getByText('Your friend joined!')).toBeVisible()
  return { a, b, creator, partner, logs, url }
}

test('first match modal, keep swiping, second match burst, results', async ({ browser }) => {
  const { a, b, creator, partner, logs } = await room(browser)
  const likeA = a.getByRole('button', { name: 'Like' })
  const likeB = b.getByRole('button', { name: 'Like' })

  // Match 1
  await likeA.click(); await likeB.click()
  await expect(a.getByText("It's a Match!")).toBeVisible()
  await expect(b.getByText("It's a Match!")).toBeVisible()
  await a.getByRole('button', { name: /Keep swiping/ }).click()
  await b.getByRole('button', { name: /Keep swiping/ }).click()
  // Closed means closed: the same match must not pop the dialog again (the
  // second liker also hears about it over realtime, a moment later).
  await a.waitForTimeout(2500)
  await expect(a.locator('.match-modal')).toHaveCount(0)
  await expect(b.locator('.match-modal')).toHaveCount(0)

  // Match 2
  await likeA.click()
  await a.waitForTimeout(800)
  await likeB.click()
  await expect(b.locator('.mb-chip')).toBeVisible()
  await expect(a.locator('.mb-chip')).toBeVisible()
  await expect(a.locator('.room-matches')).toHaveText(/2 matches/)
  await expect(b.locator('.room-matches')).toHaveText(/2 matches/)

  // Match 3 quickly, then done
  await a.waitForTimeout(2800)
  await likeA.click(); await likeB.click()
  await expect(a.locator('.room-matches')).toHaveText(/3 matches/)
  await expect(b.locator('.room-matches')).toHaveText(/3 matches/)
  await a.getByRole('button', { name: /I'm done swiping/ }).click()
  await expect(a.getByRole('heading', { name: /Pick Your Top 3/ })).toBeVisible()
  expect(logs.filter(l => l.includes('pageerror'))).toEqual([])
  await creator.close(); await partner.close()
})

test('partner swipes first, then creator: both see the moment', async ({ browser }) => {
  const { a, b, creator, partner, logs } = await room(browser)
  await b.getByRole('button', { name: 'Like' }).click()
  await b.waitForTimeout(1000)
  await a.getByRole('button', { name: 'Like' }).click()
  await expect(a.getByText("It's a Match!")).toBeVisible()
  await expect(b.getByText("It's a Match!")).toBeVisible()
  expect(logs.filter(l => l.includes('pageerror'))).toEqual([])
  await creator.close(); await partner.close()
})

// On a slow phone the second liker hears about the match twice: from their own
// swipe, then once more over realtime when the partner's like is looked up.
// Closing the dialog must not let that late echo open it again.
test('a late realtime echo of the same match does not reopen the dialog', async ({ browser }) => {
  const { a, b, creator, partner, logs } = await room(browser)
  let delayed = 0
  await b.route(/\/rest\/v1\/swipes\?.*item_id=eq\./, async route => {
    if (route.request().method() === 'GET' && delayed++ === 0) await new Promise(r => setTimeout(r, 3000))
    await route.continue()
  })
  await a.getByRole('button', { name: 'Like' }).click()   // B's realtime lookup starts now, held for 3 s
  await b.waitForTimeout(600)
  await b.getByRole('button', { name: 'Like' }).click()   // B's own swipe finds the match first
  await expect(b.getByText("It's a Match!")).toBeVisible()
  await b.getByRole('button', { name: /Keep swiping/ }).click()
  await b.waitForTimeout(3500)                             // the echo lands
  await expect(b.locator('.match-modal')).toHaveCount(0)
  await expect(b.locator('.room-matches')).toHaveText(/1 match/)
  expect(logs.filter(l => l.includes('pageerror'))).toEqual([])
  await creator.close(); await partner.close()
})
