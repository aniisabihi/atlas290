import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * The morph, in three real engines.
 *
 * This file carries more weight than most: jsdom implements neither `getTotalLength` nor
 * `getPointAtLength`, so every component test of `MapCanvas` runs down the fallback path where
 * the views simply cut. The morph itself has no unit-test coverage at all and cannot have any.
 * If it is broken, it is broken here or nowhere.
 */

const map = (page: Page) => page.locator('svg.map')
const firstShape = (page: Page) => map(page).locator('path[role="button"]').first()

/** Watch the first shape's path data across a burst of frames. */
async function framesDuring(page: Page, action: () => Promise<void>, count = 30) {
  await page.evaluate((n) => {
    const w = window as unknown as { __frames?: string[] }
    w.__frames = []
    const svg = document.querySelector('svg.map')!
    let i = 0
    const tick = () => {
      const d = svg.querySelector('path[role="button"]')!.getAttribute('d') ?? ''
      w.__frames!.push(d)
      if (++i < n) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, count)
  await action()
  await page.waitForTimeout(1200)
  return page.evaluate(() => (window as unknown as { __frames: string[] }).__frames)
}

test.describe('the morph', () => {
  test('moves the shapes rather than replacing them', async ({ page }) => {
    await page.goto('/en/?y=2024&v=map')
    await expect(firstShape(page)).toBeVisible()

    const frames = await framesDuring(page, async () => {
      await page.getByRole('button', { name: 'Bubbles' }).click()
    })

    // The claim: the shape passes through states that are neither end. A cut would show two
    // distinct values and nothing in between.
    const distinct = new Set(frames)
    expect(distinct.size).toBeGreaterThan(5)
  })

  test('draws the real geometry at both ends, not a 32-point proxy', async ({ page }) => {
    const commandCounts = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('svg.map path[role="button"]')].map(
          (p) => (p.getAttribute('d')!.match(/[ML]/g) ?? []).length,
        ),
      )

    await page.goto('/en/?y=2024&v=map')
    await expect(firstShape(page)).toBeVisible()
    // The country's most detailed coastline is 194 points. If the ends drew the proxies, the
    // busiest shape on screen would have exactly 32 — which is the whole reason the sample
    // count can be chosen for the frame budget rather than for fidelity.
    expect(Math.max(...(await commandCounts()))).toBeGreaterThan(100)

    await page.getByRole('button', { name: 'Bubbles' }).click()
    await page.waitForTimeout(1200)
    // Every shape is now a real circle: two arcs, no polygon points at all.
    const atBubbles = await page.evaluate(() =>
      [...document.querySelectorAll('svg.map path[role="button"]')].map((p) => p.getAttribute('d')),
    )
    expect(atBubbles.every((d) => /A/.test(d!))).toBe(true)
    expect(Math.max(...(await commandCounts()))).toBe(1)
  })

  test('comes back to exactly the map it started from', async ({ page }) => {
    await page.goto('/en/?y=2024&v=map')
    const before = await firstShape(page).getAttribute('d')
    await page.getByRole('button', { name: 'Bubbles' }).click()
    await page.waitForTimeout(1200)
    await page.getByRole('button', { name: 'Map' }).click()
    await page.waitForTimeout(1200)
    expect(await firstShape(page).getAttribute('d')).toBe(before)
  })

  test('carries the same element, and the tab stop, across the journey', async ({ page }) => {
    await page.goto('/en/?y=2024&v=map&m=0180')
    const stockholm = page.getByRole('button', { name: /^Stockholm,/ })
    await stockholm.focus()
    await expect(stockholm).toBeFocused()

    // Mark the element, so "the same one" can be asserted rather than assumed. Clicking the
    // view button moves real focus onto that button, which is what a browser should do — the
    // claim here is that the shape travelled instead of being torn down and rebuilt, and that
    // the roving tab stop went with it.
    await stockholm.evaluate((el) => el.setAttribute('data-probe', 'yes'))
    await page.getByRole('button', { name: 'Bubbles' }).click()
    await page.waitForTimeout(1200)

    const after = page.getByRole('button', { name: /^Stockholm,/ })
    expect(await after.getAttribute('data-probe')).toBe('yes')
    expect(await after.getAttribute('tabindex')).toBe('0')

    // And it is reachable again with one Tab-and-focus, not lost.
    await after.focus()
    await expect(after).toBeFocused()
  })

  test('the arrow keys still work at the far end', async ({ page }) => {
    await page.goto('/en/?y=2024&v=cartogram&m=0180')
    const stockholm = page.getByRole('button', { name: /^Stockholm,/ })
    await stockholm.focus()
    await page.keyboard.press('ArrowUp')
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))
    expect(focused).not.toMatch(/^Stockholm,/)
    expect(focused).toBeTruthy()
  })
})

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('nothing moves, and both ends are still right', async ({ page }) => {
    await page.goto('/en/?y=2024&v=map')
    const atMap = await firstShape(page).getAttribute('d')

    const frames = await framesDuring(page, async () => {
      await page.getByRole('button', { name: 'Bubbles' }).click()
    })

    // Exactly two states: the map and the bubbles. No interpolation at all — not a shorter
    // morph, not a faster one. A 290-shape flight is the largest movement on this site and the
    // setting exists for the people that harms.
    const distinct = new Set(frames)
    expect(distinct.size).toBeLessThanOrEqual(2)

    const atBubbles = await firstShape(page).getAttribute('d')
    expect(atBubbles).toMatch(/A/)
    expect(atBubbles).not.toBe(atMap)
  })
})

test('both ends stay clean under axe', async ({ page }) => {
  for (const view of ['map', 'cartogram']) {
    await page.goto(`/en/?y=2024&v=${view}&m=0180`)
    await expect(firstShape(page)).toBeVisible()
    await page.waitForTimeout(1200)
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze()
    expect(results.violations, view).toEqual([])
  }
})
