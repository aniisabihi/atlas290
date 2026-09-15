import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * axe-core against the real built pages.
 *
 * It catches perhaps a third of what matters — names, roles, contrast, structure — which is
 * exactly why `docs/accessibility.md` still records a manual pass. What it does catch, it catches
 * on every commit, which is more than a person will ever manage.
 *
 * Each state is scanned separately because each renders different DOM. A clean scan of the map
 * says nothing about the table.
 */

const scan = (page: Page) =>
  new AxeBuilder({ page }).withTags([
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
    'wcag22aa',
    // Not a WCAG level, but it is where axe keeps landmark structure — and the missing <main>
    // that Lighthouse caught and this scan did not was exactly a best-practice rule.
    'best-practice',
  ])

/** Waits until the pantry has loaded and something real is on screen. */
async function ready(page: Page) {
  await page.locator('svg.map, svg.cartogram, table.data-table').first().waitFor()
}

const STATES: Array<[name: string, url: string]> = [
  ['the map', '/en/?y=2024&v=map'],
  ['the cartogram', '/en/?y=2024&v=cartogram'],
  ['the table', '/en/?y=2024&t=1'],
  ['a municipality selected, with its profile open', '/en/?y=2024&m=0180&v=map'],
  ['a comparison', '/en/?y=2024&m=0180&c=1280&v=map'],
  ['a year the indicator does not cover', '/en/?i=mean-age&y=1970&v=map'],
  ['a year with suppressed and missing values', '/en/?i=house-prices&y=1989&v=map'],
  ['the Swedish page', '/sv/?y=2024&m=1280&v=map'],
]

for (const [name, url] of STATES) {
  test(`no accessibility violations: ${name}`, async ({ page }) => {
    await page.goto(url)
    await ready(page)

    const results = await scan(page).analyze()

    // Printed rather than merely counted, so a failure names the rule and the element instead of
    // saying "expected 3 to be 0".
    const summary = results.violations.map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} node(s): ${v.nodes[0]?.target.join(' ')}`,
    )
    expect(summary, `axe found violations on ${name}`).toEqual([])
  })
}

test('the About disclosure, once opened', async ({ page }) => {
  // Its content does not exist in the DOM until the details element is open, so scanning the
  // page with it closed proves nothing about the longest prose on the site.
  await page.goto('/en/?y=2024&v=map')
  await ready(page)
  await page.locator('.about-indicator summary').click()
  await page.getByRole('heading', { level: 3, name: 'Worth knowing' }).waitFor()
  const results = await scan(page).analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
})
