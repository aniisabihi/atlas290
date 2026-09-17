import { expect, test } from '@playwright/test'

/**
 * The five things Plan 11 changed, in a real browser.
 *
 * Every one of them is a question jsdom cannot answer, because every one of them is about
 * geometry: where the profile lands relative to the fold, how tall a view is, whether a box sits
 * over the shape it names. The unit tests hold the markup and the wiring; these hold the layout.
 */

const DESKTOP = { width: 1440, height: 900 }

/** Kiruna: the largest shape on the map, and nothing is drawn on top of it. */
const KIRUNA = 'svg.map path[data-code="2584"]'

test.describe('the place beside the map', () => {
  test('a selected municipality is brought into view, before the facts', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/en/?y=2024&v=map')
    await page.locator('svg.map').waitFor()

    await page.locator('svg.map path[data-code="1280"]').click()

    const heading = page.getByRole('heading', { level: 2, name: 'Malmö' })
    await expect(heading).toBeVisible()
    // In the viewport, not merely in the document: the defect was a profile that rendered below
    // five facts, so clicking a municipality changed nothing a visitor could see.
    await expect(heading).toBeInViewport()

    // Still before the facts. That ordering is the whole of the defect; the width is not.
    const profile = (await page.locator('.layout .profile').boundingBox())!
    const facts = (await page.locator('.facts').boundingBox())!
    expect(profile.y).toBeLessThan(facts.y)
  })

  /*
   * Two grid items given the same area are drawn on top of each other, and the first version of
   * the full-width row did exactly that: the comparison was painted straight through the profile
   * it is supposed to follow. Nothing in the suite noticed, because every assertion was about
   * where a box starts and none about where the one above it ends.
   */
  test('the comparison follows the profile rather than being drawn over it', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/en/?y=2024&m=1280&c=0180&v=map')
    await page.locator('svg.map').waitFor()

    const profile = (await page.locator('.layout .profile').boundingBox())!
    const compare = (await page.locator('.layout .compare').boundingBox())!
    expect(compare.y).toBeGreaterThanOrEqual(profile.y + profile.height - 1)

    const facts = (await page.locator('.facts').boundingBox())!
    expect(facts.y).toBeGreaterThanOrEqual(compare.y + compare.height - 1)
  })

  test('the profile takes the width of both columns, under the map', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/en/?y=2024&m=1280&v=map')
    await page.locator('svg.map').waitFor()

    const profile = (await page.locator('.layout .profile').boundingBox())!
    const layout = (await page.locator('.layout').boundingBox())!
    const plate = (await page.locator('.map-frame').boundingBox())!

    // The page, not half of it: a measure row is a name, a figure and a trend, and at column
    // width the name and the figure were fighting for the same line.
    expect(Math.abs(profile.width - layout.width)).toBeLessThan(2)
    expect(profile.x).toBeLessThan(plate.x)
    // Under the map, which is where it used to be and where it is again.
    expect(profile.y).toBeGreaterThan(plate.y + plate.height - 2)
  })
})

test.describe('the table as a view', () => {
  test('takes the map’s box instead of the whole page', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/en/?y=2024&v=map')
    await page.locator('svg.map').waitFor()
    // The map itself, not its plate: `--stage` is the height of the picture, and the plate adds
    // its own padding and a caption around it.
    const map = await page.locator('svg.map').boundingBox()

    await page.goto('/en/?y=2024&t=1')
    await page.getByRole('table').waitFor()
    const box = await page.locator('.view-column .table-scroll').boundingBox()

    // One `--stage`, read by both views.
    expect(Math.abs(box!.height - map!.height)).toBeLessThan(2)

    const doc = await page.evaluate(() => document.documentElement.scrollHeight)
    // 290 rows laid out in the page made this thirteen thousand pixels. The facts strip below
    // the views is the rest of it, so the bar is generous and still nowhere near the old number.
    expect(doc).toBeLessThan(DESKTOP.height * 2)
  })

  test('scrolls inside itself, with every municipality still in the document', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/en/?y=2024&t=1')
    await page.getByRole('table').waitFor()

    await expect(page.locator('.data-table tbody tr')).toHaveCount(290)

    const scroll = page.locator('.view-column .table-scroll')
    const inner = await scroll.evaluate((el) => el.scrollHeight)
    expect(inner).toBeGreaterThan((await scroll.boundingBox())!.height)

    // The sort controls live in the header, so the header has to stay at the top of the box.
    // It does move once — up, by the height of the caption it starts below, which is what
    // sticking to `top: 0` means. What matters is where it lands and that it stays there.
    const sort = page.getByRole('button', { name: /^Municipality/ })
    const boxTop = (await scroll.boundingBox())!.y
    await scroll.evaluate((el) => el.scrollBy(0, 2000))
    const pinned = (await sort.boundingBox())!.y
    expect(pinned).toBeGreaterThanOrEqual(boxTop - 1)
    expect(pinned).toBeLessThan(boxTop + 60)
    await expect(sort).toBeInViewport()

    await scroll.evaluate((el) => el.scrollBy(0, 6000))
    expect(Math.abs((await sort.boundingBox())!.y - pinned)).toBeLessThan(2)
  })

  test('is a named region a keyboard can reach and scroll', async ({ page }) => {
    await page.goto('/en/?y=2024&t=1')
    await page.getByRole('table').waitFor()
    await expect(page.getByRole('region', { name: 'Population, 2024' })).toBeVisible()
  })
})

test.describe('pointing at a shape', () => {
  test('says the name and the reading the shape already carries', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/en/?y=2024&v=map')
    await page.locator('svg.map').waitFor()

    await expect(page.getByTestId('map-tooltip')).toHaveCount(0)

    const shape = page.locator(KIRUNA)
    await shape.hover({ force: true })
    const tooltip = page.getByTestId('map-tooltip')
    await expect(tooltip).toBeVisible()

    // The tooltip is the label, drawn. If they ever disagree, one of them is a wrong figure.
    const label = (await shape.getAttribute('aria-label'))!
    for (const part of label.split(', ')) {
      await expect(tooltip).toContainText(part)
    }
    await expect(tooltip).toContainText(/\d+ of 290/)
  })

  test('is not in the accessibility tree, because the shape already says it', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/en/?y=2024&v=map')
    await page.locator('svg.map').waitFor()
    await page.locator(KIRUNA).hover({ force: true })
    await expect(page.getByTestId('map-tooltip')).toHaveAttribute('aria-hidden', 'true')
  })

  test('follows the keyboard, and lets go when the view changes', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/en/?y=2024&v=map')
    await page.locator('svg.map').waitFor()

    await page.locator(KIRUNA).focus()
    await expect(page.getByTestId('map-tooltip')).toContainText('Kiruna')

    // The morph moves every shape, so a reading anchored to where one used to be is not true.
    await page.getByRole('button', { name: 'Bubbles' }).click()
    await expect(page.getByTestId('map-tooltip')).toHaveCount(0)
  })

  /*
   * These two watch for the box APPEARING rather than looking for it afterwards.
   *
   * Both defects are flashes: the tooltip comes back mid-morph and then goes when the pointer
   * settles, and a tap shows it for the moment between focusing the shape and the profile taking
   * focus away. A check after the fact finds nothing either time and passes while the bug is
   * still there, which is what the first version of both of these did.
   */
  const watchForTooltip = (page: import('@playwright/test').Page) =>
    page.evaluate(() => {
      const w = window as unknown as { __sawTooltip?: boolean }
      w.__sawTooltip = false
      new MutationObserver(() => {
        if (document.querySelector('[data-testid="map-tooltip"]')) w.__sawTooltip = true
      }).observe(document.body, { childList: true, subtree: true })
    })

  const sawTooltip = (page: import('@playwright/test').Page) =>
    page.evaluate(() => (window as unknown as { __sawTooltip?: boolean }).__sawTooltip === true)

  test('stays away for the whole morph, not just the moment it starts', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/en/?y=2024&v=map')
    await page.locator('svg.map').waitFor()

    await page.locator(KIRUNA).hover({ force: true })
    await expect(page.getByTestId('map-tooltip')).toBeVisible()

    /*
     * The press and the watching happen in the same page task.
     *
     * Driving them separately meant the loop started however long a round trip took after the
     * view changed, and on a slow run that was enough of the 650 ms for the shapes to arrive
     * before the loop finished — so the tooltip came back for the right reason and the test
     * failed anyway. Clicking from inside the page removes the gap entirely.
     */
    const saw = await page.evaluate(async () => {
      const button = [...document.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === 'Bubbles',
      )!
      button.click()

      const path = document.querySelector('svg.map path[data-code="2584"]')!
      const map = document.querySelector('svg.map')!
      let seen = false
      const started = performance.now()
      // Comfortably inside the 650 ms the morph takes, whatever the machine is doing.
      while (performance.now() - started < 400) {
        const r = path.getBoundingClientRect()
        path.dispatchEvent(
          new PointerEvent('pointermove', {
            bubbles: true,
            pointerType: 'mouse',
            clientX: r.x + r.width / 2,
            clientY: r.y + r.height / 2,
          }),
        )
        await new Promise(requestAnimationFrame)
        // Only once the shapes have actually set off. The click is one thing and the state
        // catching up with it is another, and a tooltip drawn over a map still standing still is
        // not the defect — it is the feature working right up to the moment it should stop.
        const travelling = map.getAttribute('data-view') === 'cartogram'
        if (travelling && document.querySelector('[data-testid="map-tooltip"]')) seen = true
      }
      return seen
    })
    expect(saw).toBe(false)

    // And it comes back once they have arrived, or the guard has broken the feature instead.
    await page.waitForTimeout(500)
    const box = (await page.locator(KIRUNA).boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.getByTestId('map-tooltip')).toBeVisible()
  })

  test('says nothing under a finger, because a tap already opens the profile', async ({
    browser,
  }) => {
    // A tap selects, and selecting focuses the shape. A focus event does not say what caused it,
    // so without the guard the box appeared under the finger already covering the shape — for
    // the one render before the profile took focus away.
    const context = await browser.newContext({ hasTouch: true, viewport: DESKTOP })
    const page = await context.newPage()
    await page.goto('/en/?y=2024&v=map')
    await page.locator('svg.map').waitFor()

    await watchForTooltip(page)
    await page.locator(KIRUNA).tap({ force: true })
    await expect(page.getByRole('heading', { level: 2, name: 'Kiruna' })).toBeVisible()
    expect(await sawTooltip(page)).toBe(false)
    await context.close()
  })

  test('rings the municipality a neighbour chip names', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/en/?y=2024&m=1280&v=map')
    await page.locator('svg.map').waitFor()

    await expect(page.locator('[data-highlight-ring]')).toHaveCount(0)
    await page.getByRole('link', { name: 'Göteborg' }).hover()
    // 1480 is Göteborg. The ring names the shape it follows, so this is the right one.
    await expect(page.locator('[data-highlight-ring] path').first()).toHaveAttribute(
      'data-ring-for',
      '1480',
    )
  })

  test('marks the class the hovered municipality falls in, and no other', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/en/?y=2024&v=map')
    await page.locator('svg.map').waitFor()

    await expect(page.locator('.legend li[data-highlight]')).toHaveCount(0)
    await page.locator(KIRUNA).hover({ force: true })
    await expect(page.locator('.legend li[data-highlight]')).toHaveCount(1)
  })

  test('keeps none of it in the URL, which is where shareable things live', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/en/?y=2024&m=1280&v=map')
    await page.locator('svg.map').waitFor()
    const before = page.url()

    await page.locator(KIRUNA).hover({ force: true })
    await page.getByRole('link', { name: 'Göteborg' }).hover()
    expect(page.url()).toBe(before)
  })
})
