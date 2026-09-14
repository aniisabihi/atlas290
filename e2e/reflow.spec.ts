import { expect, test } from '@playwright/test'

/**
 * WCAG 2.2 SC 1.4.10, Reflow: content must be usable at 320 CSS pixels wide without scrolling in
 * two directions. 320 px is the viewport a 1280 px page reaches at 400% zoom, which is why that
 * number and not a phone's.
 */
const STATES = [
  ['the map', '/en/?y=2024&v=map'],
  ['the cartogram', '/en/?y=2024&v=cartogram'],
  ['the table', '/en/?y=2024&t=1'],
  ['a profile and a comparison', '/en/?y=2024&m=0180&c=1280'],
] as const

for (const [name, url] of STATES) {
  test(`no sideways scrolling at 320 px: ${name}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await page.goto(url)
    await page.locator('svg.map, svg.cartogram, table.data-table').first().waitFor()

    const overflow = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      // Which elements stick out, so a failure names the culprit — but ignoring anything inside
      // a container that scrolls on purpose. A wide table inside its own scrolling box is
      // explicitly allowed by 1.4.10; a wide table pushing the page sideways is not.
      culprits: [...document.querySelectorAll('*')]
        .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
        .filter((el) => {
          for (let node = el.parentElement; node; node = node.parentElement) {
            const overflowX = getComputedStyle(node).overflowX
            if (overflowX === 'auto' || overflowX === 'scroll') return false
          }
          return true
        })
        .slice(0, 5)
        .map((el) => `${el.tagName.toLowerCase()}.${el.className || '(no class)'}`),
    }))

    expect(overflow.culprits).toEqual([])
    expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewport)
  })
}

test('the text survives being doubled', async ({ page }) => {
  /**
   * WCAG 2.2 SC 1.4.4, Resize Text: text has to scale to 200% without losing content or function.
   * That is a separate criterion from Reflow above, and a separate emulation — a 320 px viewport
   * already *is* 1280 px at 400% zoom, so scaling the font on top of it would be testing 1600%
   * and failing the site for something no standard asks of it. This doubles the root font at a
   * normal width instead, which is what 1.4.4 actually describes.
   */
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/en/?y=2024&m=0180&v=map')
  await page.locator('svg.map').waitFor()
  await page.addStyleTag({ content: 'html { font-size: 32px !important; }' })

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow, 'the page scrolls sideways with doubled text').toBeLessThanOrEqual(1)

  // And the controls are still there to be used, not merely present.
  await expect(page.getByRole('slider')).toBeVisible()
  await expect(page.getByRole('combobox', { name: /search/i })).toBeVisible()
})
