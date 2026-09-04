import { test, expect } from '@playwright/test'

// The whole product is "two people swipe the same deck and match". This runs
// that path for real — two browser contexts (two sessionStorage identities)
// on one movie room.
test.skip(!process.env.VITE_SUPABASE_URL, 'needs VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')

async function createMovieRoom(page) {
  await page.goto('/create/movies')
  await page.getByRole('button', { name: 'Create Room' }).click()
  await expect(page).toHaveURL(/\/room\/[a-z0-9]{8}$/)
  return page.url()
}

test('two players match on the first card', async ({ browser }) => {
  const creator = await browser.newContext()
  const partner = await browser.newContext()
  const a = await creator.newPage()
  const b = await partner.newPage()

  const url = await createMovieRoom(a)
  await expect(a.getByText('Waiting for your partner')).toBeVisible()

  await b.goto(url)
  await b.getByRole('button', { name: /Start Swiping/ }).click()

  // Creator sees the join, then both land on the same first card.
  await expect(a.getByText('Your friend joined!')).toBeVisible()
  const likeA = a.getByRole('button', { name: 'Like' })
  const likeB = b.getByRole('button', { name: 'Like' })
  await expect(likeA).toBeVisible()
  await expect(likeB).toBeVisible()
  const titleA = await a.locator('.card-title').first().textContent()
  const titleB = await b.locator('.card-title').first().textContent()
  expect(titleA).toBe(titleB)

  await likeA.click()
  await likeB.click()
  // Whoever swiped second gets it via recordSwipe, the other via realtime.
  await expect(a.getByText("It's a Match!")).toBeVisible()
  await expect(b.getByText("It's a Match!")).toBeVisible()

  await creator.close()
  await partner.close()
})
