import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * The two things Plan 6 adds, in a real browser.
 *
 * This file exists because the unit tests could not have caught the defect it guards against:
 * they assert the `href` attribute of each link, which is a different claim from "clicking it
 * takes you there". A component test asserting an attribute passes happily against a link
 * nothing can activate.
 */
test.describe('places like this', () => {
  test('a real click on a similar place opens that place', async ({ page }) => {
    await page.goto('/en/?y=2024&m=1281')
    await expect(page.getByRole('heading', { level: 2, name: 'Lund' })).toBeVisible()

    const similar = page.getByRole('region', { name: 'Places like this one' })
    await expect(similar).toBeVisible()
    await expect(similar.getByRole('link')).toHaveCount(5)

    await similar.getByRole('link', { name: 'Uppsala' }).click()

    await expect(page).toHaveURL(/m=0380/)
    await expect(page.getByRole('heading', { level: 2, name: 'Uppsala' })).toBeVisible()
    await expect(page).toHaveTitle(/^Uppsala ·/)
  })

  test('the links keep the indicator and year the visitor is looking at', async ({ page }) => {
    await page.goto('/en/?i=mean-age&y=2010&m=1281')
    await page
      .getByRole('region', { name: 'Places like this one' })
      .getByRole('link', { name: 'Umeå' })
      .click()
    await expect(page).toHaveURL(/i=mean-age/)
    await expect(page).toHaveURL(/y=2010/)
    await expect(page).toHaveURL(/m=2480/)
  })

  test('states how the neighbours were found', async ({ page }) => {
    await page.goto('/en/?y=2024&m=1281')
    await expect(
      page.getByText('Closest across 10 measures, 2015–2024', { exact: false }),
    ).toBeVisible()
  })

  test('the list is reachable and operable from the keyboard alone', async ({ page }) => {
    await page.goto('/en/?y=2024&m=1281')
    const uppsala = page
      .getByRole('region', { name: 'Places like this one' })
      .getByRole('link', { name: 'Uppsala' })
    await uppsala.focus()
    await expect(uppsala).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/m=0380/)
  })
})

test.describe('the profile story', () => {
  test('reads in English', async ({ page }) => {
    await page.goto('/en/?y=2024&m=2463')
    const story = page.getByRole('region', { name: 'In short' })
    await expect(story).toBeVisible()
    await expect(story.getByText(/It has shrunk 53% since 1968/)).toBeVisible()
  })

  test('reads in Swedish', async ({ page }) => {
    await page.goto('/sv/?y=2024&m=2463')
    const story = page.getByRole('region', { name: 'Kort om kommunen' })
    await expect(story).toBeVisible()
    await expect(story.getByText(/Kommunen har krympt 53 % sedan 1968/)).toBeVisible()
  })

  test('follows the year slider rather than always showing the last year', async ({ page }) => {
    await page.goto('/en/?y=1990&m=0180')
    const story = page.getByRole('region', { name: 'In short' })
    await expect(story.getByText(/since 1968, from 758,930 to/)).toBeVisible()
    await expect(story.getByText(/995,574/)).toHaveCount(0)
  })
})

test('the two new sections keep the profile clean under axe', async ({ page }) => {
  await page.goto('/en/?y=2024&m=1281')
  await expect(page.getByRole('region', { name: 'Places like this one' })).toBeVisible()
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze()
  expect(results.violations).toEqual([])
})
