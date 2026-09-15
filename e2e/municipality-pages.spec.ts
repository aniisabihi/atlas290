import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * The pre-rendered pages, against the real built site.
 *
 * `tools/build-pages.test.ts` checks the generator's output as a string. This checks that the
 * 580 files actually reached `dist/`, that a crawler reading one without running any JavaScript
 * sees the right municipality, and that the application then boots into the same state. Those
 * are three different failures and only the last one is visible by looking at the page.
 */

test.describe('a municipality page', () => {
  test('says which municipality it is before any script runs', async ({ page }) => {
    // JavaScript off: this is what a crawler and a chat client's unfurler get.
    await page.context().addInitScript(() => {})
    const response = await page.goto('/en/malmo-1280/')
    expect(response?.status()).toBe(200)

    const head = await page.evaluate(() => document.head.innerHTML)
    expect(head).toContain("Malmö · Sweden's municipalities in data")
    expect(head).toContain('Malmö in ten measures')
    expect(head).toContain('/share/1280.png')
    expect(head).toContain('summary_large_image')
    expect(head).toContain('rel="canonical"')
  })

  test('boots the application with that municipality selected', async ({ page }) => {
    await page.goto('/en/malmo-1280/')
    await expect(page.getByRole('heading', { level: 2, name: 'Malmö' })).toBeVisible()
    await expect(page).toHaveTitle(/^Malmö · Population/)
  })

  test('serves its preview card', async ({ page }) => {
    const response = await page.request.get('/share/1280.png')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('image/png')
    expect((await response.body()).length).toBeGreaterThan(5000)
  })

  test('keeps Håbo and Habo apart', async ({ page }) => {
    // The pair that forced the code into every path. å → a makes them the same word, and
    // without the code one of them would silently serve the other's page.
    await page.goto('/sv/habo-0305/')
    await expect(page.getByRole('heading', { level: 2, name: 'Håbo' })).toBeVisible()
    await page.goto('/sv/habo-0643/')
    await expect(page.getByRole('heading', { level: 2, name: 'Habo' })).toBeVisible()
  })

  test('the Swedish page speaks Swedish from the first byte', async ({ page }) => {
    await page.goto('/sv/malmo-1280/')
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('sv')
    const head = await page.evaluate(() => document.head.innerHTML)
    expect(head).toContain('i tio mått från SCB')
    expect(head).toContain('sv_SE')
  })

  test('carries the municipality across a language switch', async ({ page }) => {
    await page.goto('/en/malmo-1280/')
    await page.getByRole('link', { name: /Svenska/ }).click()
    await expect(page).toHaveURL(/\/sv\/malmo-1280\//)
    await expect(page.getByRole('heading', { level: 2, name: 'Malmö' })).toBeVisible()
  })
})

test.describe('the old links still work', () => {
  test('a ?m= link lands in exactly the same place', async ({ page }) => {
    // The promise DESIGN made by calling the URL grammar final. These exist in the world
    // already and cannot be allowed to break.
    await page.goto('/en/?i=mean-age&y=2010&m=1280')
    await expect(page.getByRole('heading', { level: 2, name: 'Malmö' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Measure' })).toHaveValue('mean-age')
    await expect(page.getByRole('slider')).toHaveValue('2010')
  })

  test('a fact link still resolves', async ({ page }) => {
    await page.goto('/en/?y=2024')
    const strip = page.getByRole('region', { name: /things you did not think to ask/i })
    await expect(strip.getByRole('link')).toHaveCount(5)
    await strip.getByRole('link').first().click()
    await expect(page.locator('#view')).toBeVisible()
  })
})

test.describe('the rest of the path space', () => {
  test('an unknown municipality is a 404, not the front page', async ({ page }) => {
    const response = await page.goto('/en/atlantis-9999/')
    expect(response?.status()).toBe(404)
  })

  test('the language entry pages are untouched', async ({ page }) => {
    await page.goto('/en/')
    await expect(page).toHaveTitle(/^Population \d{4}/)
    const head = await page.evaluate(() => document.head.innerHTML)
    expect(head).toContain('hreflang="x-default"')
  })
})

test('a municipality page is clean under axe', async ({ page }) => {
  await page.goto('/en/malmo-1280/')
  await expect(page.getByRole('heading', { level: 2, name: 'Malmö' })).toBeVisible()
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze()
  expect(results.violations).toEqual([])
})
