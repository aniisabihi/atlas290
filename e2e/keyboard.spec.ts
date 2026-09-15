import { expect, test, type Page } from '@playwright/test'

/**
 * The questions only a real browser can answer.
 *
 * Plans 3 and 4 both ended with the same admission: keyboard behaviour was checked in WebKit
 * alone, because that was the engine available. Worse, Plan 3 first claimed arrow navigation
 * worked on the strength of `dispatchEvent` from JavaScript, which proves a handler is wired and
 * nothing about whether a real key press reaches it or whether anything visible happens. Both of
 * those gaps are what this file closes.
 */

const label = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement
    return el
      ? `${el.tagName.toLowerCase()}:${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30) ?? ''}`
      : 'none'
  })

/** Tabs until the focused element is inside the map or cartogram, or gives up. */
async function tabToTheMap(page: Page, limit = 20): Promise<number> {
  for (let presses = 1; presses <= limit; presses += 1) {
    await page.keyboard.press('Tab')
    const inside = await page.evaluate(() => {
      const el = document.activeElement
      return el?.tagName === 'path' || el?.tagName === 'circle'
    })
    if (inside) return presses
  }
  return -1
}

test.describe('the keyboard reaches the map', () => {
  test('Tab gets into the map, in this browser', async ({ page }, testInfo) => {
    await page.goto('/en/?y=2024&v=map')
    await page.getByRole('group', { name: /map of sweden/i }).waitFor()

    const presses = await tabToTheMap(page)

    // Recorded rather than merely asserted: the number of stops before the map is a real
    // accessibility property, and Plan 4's manual pass put it at ten.
    testInfo.annotations.push({ type: 'tab stops to the map', description: String(presses) })

    expect(presses, 'Tab never reached a municipality').toBeGreaterThan(0)
    expect(presses).toBeLessThanOrEqual(14)
  })

  /**
   * Whether Tab visits links and buttons at all is a property of the HOST, not of the engine.
   *
   * Playwright's WebKit on macOS honours the system-wide Full Keyboard Access setting, which is
   * off by default, and then Tab moves only between text fields and a few others — the skip link,
   * the language switch, Play and the view switch are all unreachable. The same WebKit build on
   * Linux CI reaches every control, because there is no such setting to inherit.
   *
   * Pinning that per engine, which is what the first version of this test did, is wrong twice
   * over: it asserts something untrue of WebKit-on-Linux, and it passes or fails depending on
   * which machine runs it. So the suite detects the configuration and asserts the right thing for
   * each, and insists on the one property that must hold in both: **Tab reaches the map**.
   */
  async function tabOrder(page: Page, presses = 16): Promise<string[]> {
    const seen: string[] = []
    for (let i = 0; i < presses; i += 1) {
      await page.keyboard.press('Tab')
      seen.push(await page.evaluate(() => document.activeElement?.tagName.toLowerCase() ?? 'none'))
    }
    return seen
  }

  test('what Tab reaches, in whichever configuration this host is in', async ({
    page,
  }, testInfo) => {
    await page.goto('/en/?y=2024&v=map')
    await page.getByRole('group', { name: /map of sweden/i }).waitFor()
    // Enough presses to pass every control and reach the map: ten stops precede it where links
    // and buttons are reachable, three where they are not.
    const reached = await tabOrder(page)

    const fullKeyboardAccess = reached.includes('a')
    testInfo.annotations.push({
      type: 'full keyboard access',
      description: fullKeyboardAccess ? 'on' : 'off (macOS default for WebKit)',
    })

    // True in both configurations, and the one that actually matters.
    expect(reached, 'Tab never reached the map').toContain('path')

    if (fullKeyboardAccess) {
      expect(reached[0], 'the skip link should be the very first stop').toBe('a')
      expect(reached).toContain('button')
      expect(reached).toContain('input')
    } else {
      // Reduced set: the map and the form controls, no links or buttons. Recorded rather than
      // treated as a failure, because it is the host's setting and not something this page can
      // change. docs/accessibility.md says what it means for a visitor.
      expect(reached).not.toContain('a')
    }
  })

  test('the skip link is the first stop, and goes straight there', async ({ page }) => {
    await page.goto('/en/?y=2024&v=map')
    await page.getByRole('group', { name: /map of sweden/i }).waitFor()
    await page.keyboard.press('Tab')

    const onTheLink = await page.evaluate(
      () => document.activeElement?.tagName.toLowerCase() === 'a',
    )
    // Skipped only where the host does not Tab to links at all, which the test above asserts.
    test.skip(
      !onTheLink,
      'this host does not give links keyboard focus (macOS full keyboard access is off)',
    )

    await expect(page.getByRole('link', { name: /skip to the map/i })).toBeFocused()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Tab')
    expect(await label(page)).toMatch(/^path:/)
  })

  test('the skip link works in the table view too, where #map does not exist', async ({ page }) => {
    // It used to point at #map, which the table view does not render — so the one control that
    // exists to rescue a keyboard visitor was broken in exactly the view they are most likely to
    // want. Caught by axe's skip-link rule once the rule set was widened past WCAG tags.
    await page.goto('/en/?y=2024&t=1')
    await page.getByRole('table').waitFor()
    await page.keyboard.press('Tab')

    const onTheLink = await page.evaluate(
      () => document.activeElement?.tagName.toLowerCase() === 'a',
    )
    test.skip(!onTheLink, 'this host does not give links keyboard focus')

    await expect(page.getByRole('link', { name: /skip to the table/i })).toBeFocused()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Tab')
    expect(await label(page)).toMatch(/^button:(Municipality|Value|Rank)/)
  })
})

test.describe('arrow keys move, and show that they moved', () => {
  test('a real arrow press moves focus and draws a ring', async ({ page }) => {
    await page.goto('/en/?y=2024&m=1280&v=map')
    // Focus the shape directly rather than clicking it: clicking the selected municipality
    // deselects it, and clicking an unselected one opens the profile, which deliberately takes
    // focus to its own heading. Both are correct; neither is what this test is about.
    await page.getByRole('button', { name: /^Malmö,/ }).focus()

    // The Plan 3 defect, in test form: focus moved and the map drew nothing, which from the
    // outside is indistinguishable from broken.
    await expect(page.locator('[data-focus-ring]')).toHaveCount(0)
    await page.keyboard.press('ArrowUp')
    await expect(page.locator('[data-focus-ring]')).toHaveCount(1)
    expect(await label(page)).not.toMatch(/Malmö/)
  })

  test('clicking a municipality opens its profile and puts focus on the heading', async ({
    page,
  }) => {
    // Plan 4's rule, checked in a real browser for the first time. A screen reader should land
    // on the name of the thing that just opened rather than being left on a page that changed
    // underneath it.
    await page.goto('/en/?y=2024&v=map')
    await page.getByRole('button', { name: /^Malmö,/ }).click()
    await expect(page.getByRole('heading', { level: 2, name: 'Malmö' })).toBeFocused()
  })

  test('clicking the selected municipality deselects it and leaves focus on the shape', async ({
    page,
  }) => {
    await page.goto('/en/?y=2024&m=1280&v=map')
    const malmo = page.getByRole('button', { name: /^Malmö,/ })
    await malmo.click()
    await expect(page).not.toHaveURL(/m=1280/)
    await expect(malmo).toBeFocused()
    // And the keyboard still works from there.
    await page.keyboard.press('ArrowUp')
    expect(await label(page)).not.toMatch(/Malmö/)
  })

  test('a key pointing at open sea says so instead of moving', async ({ page }) => {
    // Kiruna is selected in the URL, which is what puts the map's single tab stop on it. Focusing
    // a shape that carries tabindex="-1" would be entering the map in a way no visitor can: the
    // roving tabindex means only one shape is reachable, and the key handler steps from that one.
    await page.goto('/en/?y=2024&m=2584&v=map')
    const kiruna = page.getByRole('button', { name: /^Kiruna,/ })
    await kiruna.focus()
    await page.keyboard.press('ArrowUp')
    await expect(kiruna).toBeFocused()
    await expect(page.locator('[data-live-region]')).toContainText(
      /no neighbouring municipality/i,
      { timeout: 3000 },
    )
  })
})

test.describe('the year slider, which jsdom cannot test at all', () => {
  test('responds to a real arrow key', async ({ page }) => {
    // Plan 3's unit tests had to drive `change` directly, because jsdom implements neither a
    // range input's arrow-key behaviour nor its pointer drag. This is the real thing.
    await page.goto('/en/?y=2000&v=map')
    const slider = page.getByRole('slider')
    await slider.focus()
    await page.keyboard.press('ArrowRight')
    await expect(slider).toHaveValue('2001')
    await expect(page).toHaveURL(/y=2001/)
  })

  test('plays and stops when told', async ({ page }) => {
    await page.goto('/en/?y=1968&v=map')
    await page.getByRole('button', { name: 'Play' }).click()
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
    await expect(page.getByRole('slider')).not.toHaveValue('1968', { timeout: 4000 })
    await page.getByRole('button', { name: 'Pause' }).click()
    const stopped = await page.getByRole('slider').inputValue()
    await page.waitForTimeout(1500)
    await expect(page.getByRole('slider')).toHaveValue(stopped)
  })
})
