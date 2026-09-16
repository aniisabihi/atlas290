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
  test('a selected municipality appears without pushing the map off the screen', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/en/?y=2024&v=map')
    await page.locator('svg.map').waitFor()

    const before = await page.locator('.map-frame').boundingBox()
    await page.locator('svg.map path[data-code="1280"]').click()

    const heading = page.getByRole('heading', { level: 2, name: 'Malmö' })
    await expect(heading).toBeVisible()
    // In the viewport, not merely in the document: the defect was a profile that rendered below
    // five facts, so clicking a municipality changed nothing a visitor could see.
    await expect(heading).toBeInViewport()

    // And the map is still there. It used to be the thing that scrolled away.
    const after = await page.locator('.map-frame').boundingBox()
    expect(after?.y).toBe(before?.y)
    await expect(page.locator('.map-frame')).toBeInViewport()
  })

  test('the profile sits in the reading column, above the facts', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/en/?y=2024&m=1280&v=map')
    await page.locator('svg.map').waitFor()

    const profile = await page.locator('.reading-column .profile').boundingBox()
    const facts = await page.locator('.facts').boundingBox()
    expect(profile).not.toBeNull()
    expect(profile!.y).toBeLessThan(facts!.y)
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
