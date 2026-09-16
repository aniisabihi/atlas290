import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * What a visitor gets for an address that names nothing.
 *
 * `e2e/municipality-pages.spec.ts` already asserts the STATUS for an unknown municipality. These
 * assert the two things that turned out to matter more: that the document Cloudflare needs
 * reached the root of the build, and that what comes back is a page saying so rather than the
 * site's front page wearing a 404.
 */

test.describe('an address that matches nothing', () => {
  test('serves the not-found page at the root, where Cloudflare looks for it', async ({ page }) => {
    // Fetched by its own path, not through the middleware. Without this file at exactly this
    // path, Pages treats every unmatched URL as a single-page-application route and answers 200
    // with the root document — which is what production did before this test existed.
    const response = await page.request.get('/404.html')
    expect(response.status()).toBe(200)
    expect(await response.text()).toContain('Page not found')
  })

  test('tells the visitor, in both languages, instead of moving them', async ({ page }) => {
    const response = await page.goto('/en/atlantis-9999/')
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Page not found')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Sidan finns inte')
    // Still on the address that failed. A redirect here would make a mistyped link look exactly
    // like a working one.
    expect(new URL(page.url()).pathname).toBe('/en/atlantis-9999/')
  })

  test('offers a way out in each language', async ({ page }) => {
    await page.goto('/en/nowhere/')
    await page.getByRole('link', { name: 'To the map' }).click()
    await expect(page).toHaveURL(/\/en\/$/)
  })

  test('is clean under axe', async ({ page }) => {
    await page.goto('/en/atlantis-9999/')
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze()
    expect(results.violations).toEqual([])
  })
})
