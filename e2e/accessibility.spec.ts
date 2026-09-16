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

/**
 * Both themes, every state. Until Plan 10 this ran in one theme only, which is half a scan: the
 * palettes are different colours on different grounds, and contrast is the rule axe catches most
 * of. The dark run is what found the compare header at 4.15:1.
 */
const THEMES = ['light', 'dark'] as const

for (const [name, url] of STATES) {
  for (const theme of THEMES) {
    test(`no accessibility violations in ${theme}: ${name}`, async ({ page }) => {
      // An axe analysis is CPU-bound, and running every state in two themes doubled how many of
      // them compete for the same cores. The default 30 s was comfortable for one theme and
      // marginal for two — this is the work being slow, not the page.
      test.slow()
      await page.addInitScript((t) => {
        try {
          localStorage.setItem('atlas-theme', t)
        } catch {
          // A browser without storage still renders the default theme, which is worth scanning.
        }
      }, theme)
      await page.goto(url)
      await ready(page)

      /*
       * Light scans everything; dark scans colour only.
       *
       * The two themes render identical DOM — same roles, same names, same structure — so every
       * rule but contrast must reach the same verdict on both, and running them twice costs CI
       * time to re-derive an answer it already has. Contrast is the one that genuinely differs,
       * and it is the one that has earned this: it caught the compare header at 4.15:1, and the
       * Close buttons that inherited the platform's own colours.
       */
      const results = await (
        theme === 'dark' ? new AxeBuilder({ page }).withRules(['color-contrast']) : scan(page)
      ).analyze()
      const summary = results.violations.map(
        (v) =>
          `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} node(s): ${v.nodes[0]?.target.join(' ')}`,
      )
      expect(summary, `axe found violations on ${name} in ${theme}`).toEqual([])
    })
  }
}

for (const [name, url] of [['the not-found page', '/en/nowhere/']] as const) {
  test(`no accessibility violations: ${name}`, async ({ page }) => {
    await page.goto(url)

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
