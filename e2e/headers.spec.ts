import { expect, test, type Page } from '@playwright/test'

/**
 * The response headers the deployed site serves, checked against a browser that enforces them.
 *
 * These cannot be unit-tested in any way that matters. `tools/build-pages.test.ts` proves the
 * policy SAYS the right thing; only a real engine proves the site still works under it — and a
 * Content Security Policy that blocks the application's own bundle looks exactly like a correct
 * one until something tries to load. There is no staging environment here, so this suite is the
 * only place the question gets asked before a visitor asks it.
 *
 * The preview server reads `dist/_headers`, the same file Cloudflare reads, so what is asserted
 * here is the artefact that ships rather than a second copy of the intent.
 */

/** Anything the page refused to load or run, collected the way the browser reports it. */
function violations(page: Page): string[] {
  const found: string[] = []
  page.on('console', (message) => {
    const text = message.text()
    if (/Content Security Policy|Refused to/i.test(text)) found.push(text)
  })
  page.on('pageerror', (error) => found.push(String(error)))
  return found
}

test.describe('the security headers', () => {
  test('are served on every kind of page, not only the root', async ({ request }) => {
    // Requested rather than navigated to. `page.goto('/')` returns null in Firefox, because the
    // language picker replaces the location before the navigation settles and Playwright has no
    // response left to hand back — so the assertions would read headers off nothing.
    //
    // The 404 is in the list on purpose: it is the one document served for every address that
    // matches nothing, so it is the page most likely to be reached by someone following a hostile
    // link, and the least likely to be checked.
    for (const path of ['/', '/en/', '/sv/', '/en/malmo-1280/', '/en/atlantis-9999/']) {
      const response = await request.get(path)
      const headers = response.headers()
      expect(headers['x-content-type-options'], path).toBe('nosniff')
      expect(headers['referrer-policy'], path).toBe('no-referrer')
      expect(headers['x-frame-options'], path).toBe('DENY')
      expect(headers['cross-origin-opener-policy'], path).toBe('same-origin')
      expect(headers['permissions-policy'], path).toContain('geolocation=()')
      expect(headers['content-security-policy'], path).toContain("default-src 'none'")
    }
  })

  test('do not stop the application loading, which is the whole risk', async ({ page }) => {
    const refused = violations(page)
    await page.goto('/en/?y=2024&m=1280')
    // If script-src were wrong the bundle would not run and none of this would exist.
    await expect(page.getByRole('heading', { level: 2, name: 'Malmö' })).toBeVisible()
    await expect(page.getByRole('slider')).toHaveValue('2024')
    expect(refused).toEqual([])
  })

  test('do not stop the stylesheet or the inline style attributes', async ({ page }) => {
    await page.goto('/en/?y=2024')
    // An external stylesheet under style-src 'self': if it were blocked every box would collapse
    // to the browser default, so a real computed colour is the assertion.
    const background = await page
      .locator('body')
      .evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(background).not.toBe('rgba(0, 0, 0, 0)')
    // And the style ATTRIBUTE, which Legend sets per swatch and has no hash available to it.
    const swatch = page.locator('.legend-swatch').first()
    await expect(swatch).toBeVisible()
    expect(await swatch.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
      'rgba(0, 0, 0, 0)',
    )
  })

  test('do not stop the pantry being fetched', async ({ page }) => {
    const refused = violations(page)
    await page.goto('/en/?y=2024')
    // connect-src 'self'. Six files are fetched on load; a blocked one throws inside loadPantry
    // and the map never appears.
    await expect(page.getByRole('group', { name: /map of sweden/i })).toBeVisible()
    expect(refused).toEqual([])
  })

  test('do not stop the not-found page rendering', async ({ page }) => {
    // It is a hand-written document with an inline <style> and, by decision 0007, deliberately no
    // script. Under style-src that stylesheet is allowed and under script-src there is nothing to
    // allow — so this asserts the page a visitor actually sees, not just its status.
    const refused = violations(page)
    await page.goto('/en/atlantis-9999/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Page not found')
    expect(refused).toEqual([])
  })

  test('do not stop the root page redirecting, which is the one inline script', async ({
    browser,
  }) => {
    // The failure this guards against is specific and nasty: `script-src 'self'` blocks the
    // language picker's inline script, so the bare domain stops redirecting while every other
    // page on the site keeps working perfectly. It is allowed by a hash of the built file.
    const context = await browser.newContext({ locale: 'sv-SE' })
    const page = await context.newPage()
    const refused = violations(page)
    await page.goto('/?y=2024')
    await expect(page).toHaveURL(/\/sv\/\?y=2024/)
    expect(refused).toEqual([])
    await context.close()
  })
})
