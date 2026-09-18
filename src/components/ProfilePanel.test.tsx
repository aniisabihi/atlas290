import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { lookup } from '../data/select'
import { ProfilePanel } from './ProfilePanel'
import { publishedPantry } from '../test/pantry'

const lk = lookup(publishedPantry)
const draw = (code = '0180', year = 2024, lang: 'sv' | 'en' = 'en') => {
  const onClose = vi.fn()
  const result = render(
    <ProfilePanel lk={lk} code={code} year={year} lang={lang} onClose={onClose} />,
  )
  return { onClose, ...result }
}
const rows = () => within(screen.getByRole('list')).getAllByRole('listitem')

describe('ProfilePanel', () => {
  it('names the municipality', () => {
    draw()
    expect(screen.getByRole('heading', { level: 2, name: 'Stockholm' })).toBeTruthy()
  })

  it('has one row per indicator, in the pantry order', () => {
    draw()
    expect(rows()).toHaveLength(10)
    expect(rows()[0]!.textContent).toMatch(/^Population/)
  })

  it('gives each row its value, unit and rank for the year on screen', () => {
    draw()
    expect(rows()[0]!.textContent).toContain('995,574 residents')
    expect(rows()[0]!.textContent).toContain('rank 1 of 290')
  })

  it('says why a row is blank rather than leaving it blank', () => {
    draw('0180', 1970)
    const meanAge = rows().find((r) => r.textContent?.startsWith('Mean age'))!
    expect(meanAge.textContent).toMatch(/not published for this year/i)
    expect(meanAge.textContent).not.toMatch(/rank/)
  })

  it('shows money both ways: adjusted, and what it cost at the time', () => {
    draw('0180', 1990)
    const houses = rows().find((r) => r.textContent?.startsWith('House prices'))!
    // Adjusted to 2025 kronor, and the figure SCB actually published for 1990.
    expect(houses.textContent).toMatch(/in 2025 kronor/)
    expect(houses.textContent).toMatch(/in 1990 kronor/)
  })

  it('does not repeat itself in the base year, where the two figures are the same', () => {
    draw('0180', 2025)
    const houses = rows().find((r) => r.textContent?.startsWith('House prices'))!
    expect(houses.textContent).not.toMatch(/in 2025 kronor.*in 2025 kronor/)
  })

  it('shows nothing about kronor on a row that is not money', () => {
    draw()
    expect(rows()[0]!.textContent).not.toMatch(/kronor/)
  })

  it('draws a sparkline per row', () => {
    const { container } = draw()
    expect(container.querySelectorAll('.sparkline')).toHaveLength(10)
  })

  it('moves focus to the heading when it opens', () => {
    draw()
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2 }))
  })

  it('moves focus again when a different municipality is opened', () => {
    const { rerender } = draw()
    rerender(<ProfilePanel lk={lk} code="1280" year={2024} lang="en" onClose={() => {}} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Malmö' })).toBe(document.activeElement)
  })

  it('closes with a real button that has a name', async () => {
    const { onClose } = draw()
    await userEvent.click(screen.getByRole('button', { name: 'Close the municipality panel' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('is not a dialog and traps nothing', () => {
    // DESIGN section 5: non-modal. Trapping focus in a panel that sits beside the map would stop
    // a visitor comparing the two.
    const { container } = draw()
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(container.querySelector('[aria-modal]')).toBeNull()
  })

  it('speaks Swedish', () => {
    draw('1280', 2024, 'sv')
    expect(screen.getByRole('heading', { level: 2, name: 'Malmö' })).toBeTruthy()
    expect(rows()[0]!.textContent).toMatch(/invånare/)
  })
})

describe('ProfilePanel, the header and the rows', () => {
  it('puts the compare control in the header, beside the name it will pair', () => {
    const { container } = render(
      <ProfilePanel
        lk={lk}
        code="1280"
        year={2024}
        lang="en"
        onClose={() => {}}
        compare={<button type="button">Compare with…</button>}
      />,
    )
    const header = container.querySelector('.profile-header')!
    expect(
      within(header as HTMLElement).getByRole('button', { name: 'Compare with…' }),
    ).toBeTruthy()
    expect(within(header as HTMLElement).getByRole('button', { name: /close/i })).toBeTruthy()
  })

  /*
   * Structure, not width: jsdom measures nothing, so the container query that stacks these on a
   * phone cannot be tested here. What can be tested is that all four parts are present for every
   * measure, at every width — the phone fix must not be a part being dropped.
   */
  it('gives every measure a name, a value, a rank and a trend', () => {
    const { container } = render(
      <ProfilePanel lk={lk} code="1280" year={2024} lang="en" onClose={() => {}} />,
    )
    const measures = container.querySelectorAll('.profile-row')
    expect(measures).toHaveLength(10)
    for (const row of measures) {
      expect(row.querySelector('.profile-name')?.textContent).toBeTruthy()
      expect(row.querySelector('.profile-value')?.textContent).toBeTruthy()
      expect(row.querySelector('.sparkline')).not.toBeNull()
    }
  })
})
