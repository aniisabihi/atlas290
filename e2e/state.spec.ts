import { expect, test } from '@playwright/test'

/** The claim the whole architecture rests on: the URL is the application's memory. */
test.describe('a link is a view', () => {
  test('a deep link restores indicator, year, municipality and profile', async ({ page }) => {
    await page.goto('/en/?i=house-prices&y=1990&m=0184')
    await expect(page.getByRole('heading', { level: 2, name: 'Solna' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Measure' })).toHaveValue('house-prices')
    await expect(page.getByRole('slider')).toHaveValue('1990')
    await expect(page).toHaveTitle(/^Solna · House prices 1990/)
  })

  test('an out-of-coverage year is honoured, not quietly corrected', async ({ page }) => {
    await page.goto('/en/?i=mean-age&y=1970')
    await expect(page.getByRole('slider')).toHaveValue('1970')
    await expect(page.getByText(/Mean age is published for 1998–2025/)).toBeVisible()
    await page.getByRole('button', { name: 'Go to 1998' }).click()
    await expect(page).toHaveURL(/y=1998/)
  })

  test('switching to the cartogram keeps the selection', async ({ page }) => {
    await page.goto('/en/?y=2024&m=1280&v=map')
    await page.getByRole('button', { name: 'Bubbles' }).click()
    await expect(page.getByRole('group', { name: /bubble chart/i })).toBeVisible()
    await expect(page).toHaveURL(/m=1280/)
    await expect(page.getByRole('heading', { level: 2, name: 'Malmö' })).toBeVisible()
  })

  test('the back button goes back', async ({ page }) => {
    await page.goto('/en/?y=2024')
    await page.getByRole('combobox', { name: 'Measure' }).selectOption('mean-age')
    await expect(page).toHaveURL(/i=mean-age/)
    await page.goBack()
    await expect(page).toHaveURL(/\/en\/\?y=2024$/)
    await expect(page.getByRole('combobox', { name: 'Measure' })).toHaveValue('population')
  })

  test('a fact link lands on a view that shows the fact', async ({ page }) => {
    // The facts are generated now (Plan 7), so this names one by its family rather than by a
    // sentence somebody wrote: the `unusual` fact is the one that compares a municipality with
    // the places most like it, and its link has to land on that municipality and that measure.
    await page.goto('/en/?y=2024')
    await page.getByRole('link', { name: /than in the places most like it/ }).click()
    await expect(page.getByRole('heading', { level: 2, name: 'Kävlinge' })).toBeVisible()
    await expect(page).toHaveURL(/i=tax-rate/)
    await expect(page.getByText('29.69%')).toBeVisible()
  })
})

test.describe('language lives in the path', () => {
  test('each page declares its own language before any script runs', async ({ page }) => {
    await page.goto('/sv/?y=2024')
    await expect(page.locator('html')).toHaveAttribute('lang', 'sv')
    await page.goto('/en/?y=2024')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })

  test('the root sends a Swedish browser to Swedish, carrying the view', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'sv-SE' })
    const page = await context.newPage()
    await page.goto('/?i=mean-age&y=2010')
    await expect(page).toHaveURL(/\/sv\/\?i=mean-age&y=2010/)
    await context.close()
  })

  test('and an English browser to English', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'en-GB' })
    const page = await context.newPage()
    await page.goto('/?y=2024')
    await expect(page).toHaveURL(/\/en\/\?y=2024/)
    await context.close()
  })

  test('the switch carries the whole view across', async ({ page }) => {
    await page.goto('/en/?i=mean-age&y=2010&m=1280')
    await page.getByRole('link', { name: /switch language/i }).click()
    await expect(page).toHaveURL('/sv/?i=mean-age&y=2010&m=1280')
    await expect(page.locator('html')).toHaveAttribute('lang', 'sv')
  })
})
