import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { lookup } from '../data/select'
import { DataTable } from './DataTable'
import { publishedPantry } from '../test/pantry'

const lk = lookup(publishedPantry)
const draw = (indicatorId = 'population', year = 2024, lang: 'sv' | 'en' = 'en') => {
  const onSelect = vi.fn()
  const result = render(
    <DataTable
      lk={lk}
      indicatorId={indicatorId}
      year={year}
      selected={null}
      lang={lang}
      onSelect={onSelect}
    />,
  )
  return { onSelect, ...result }
}

const bodyRows = () => within(screen.getAllByRole('rowgroup')[1]!).getAllByRole('row')
const names = () => bodyRows().map((r) => within(r).getByRole('rowheader').textContent)
const sortButton = (name: string) => screen.getByRole('button', { name })

describe('DataTable', () => {
  it('is a real table with a caption naming the indicator and year', () => {
    draw()
    expect(screen.getByRole('table', { name: 'Population, 2024' })).toBeTruthy()
  })

  it('has three column headers', () => {
    draw()
    expect(screen.getAllByRole('columnheader')).toHaveLength(3)
  })

  it('lists every municipality, not only the ones with a value', () => {
    draw('house-prices', 1989)
    expect(bodyRows()).toHaveLength(290)
  })

  it('says why a cell is empty rather than leaving it blank', () => {
    // A blank cell in a sortable table reads as zero.
    draw('house-prices', 1989)
    const salem = bodyRows().find((r) => within(r).getByRole('rowheader').textContent === 'Salem')!
    expect(salem.textContent).toMatch(/too few sales/i)
  })

  it('sorts by name in the Swedish alphabet by default', () => {
    draw()
    expect(names()[0]).toBe('Ale')
    expect(names()[289]).toBe('Övertorneå')
  })

  it('sorts by value, largest first, and says so on the header', () => {
    draw()
    const header = screen.getAllByRole('columnheader')[1]!
    expect(header.getAttribute('aria-sort')).toBe('none')
    return userEvent.click(sortButton('Value')).then(() => {
      expect(names()[0]).toBe('Stockholm')
      expect(screen.getAllByRole('columnheader')[1]!.getAttribute('aria-sort')).toBe('descending')
    })
  })

  it('reverses when the same header is used again', async () => {
    draw()
    await userEvent.click(sortButton('Value'))
    await userEvent.click(sortButton('Value'))
    expect(screen.getAllByRole('columnheader')[1]!.getAttribute('aria-sort')).toBe('ascending')
    expect(names()[0]).toBe('Dorotea')
  })

  it('keeps rows without a value at the end whichever way the column points', async () => {
    // They are not the smallest; they are absent, and sorting them to the top of an ascending
    // column would be exactly the "absence is zero" mistake the whole pantry avoids.
    draw('house-prices', 1989)
    const firstRowWithoutValue = () =>
      bodyRows().findIndex((r) => /too few sales|did not exist/i.test(r.textContent ?? ''))
    await userEvent.click(sortButton('Value'))
    expect(firstRowWithoutValue()).toBeGreaterThan(200)
    await userEvent.click(sortButton('Value'))
    expect(firstRowWithoutValue()).toBeGreaterThan(200)
  })

  it('sorts by rank with rank 1 first, which is the direction that reads naturally', async () => {
    draw()
    await userEvent.click(sortButton('Rank'))
    expect(names()[0]).toBe('Stockholm')
    expect(screen.getAllByRole('columnheader')[2]!.getAttribute('aria-sort')).toBe('ascending')
  })

  it('reports the code when a row is chosen, so the table and the map share one selection', async () => {
    const { onSelect } = draw()
    await userEvent.click(screen.getByRole('button', { name: 'Malmö' }))
    expect(onSelect).toHaveBeenCalledWith('1280')
  })

  it('marks the selected municipality', () => {
    render(
      <DataTable
        lk={lk}
        indicatorId="population"
        year={2024}
        selected="1280"
        lang="en"
        onSelect={() => {}}
      />,
    )
    const current = bodyRows().filter((r) => r.getAttribute('aria-current') === 'true')
    expect(current).toHaveLength(1)
    expect(within(current[0]!).getByRole('rowheader').textContent).toBe('Malmö')
  })

  it('speaks Swedish', () => {
    draw('population', 2024, 'sv')
    expect(screen.getByRole('table', { name: 'Folkmängd, 2024' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Kommun' })).toBeTruthy()
  })
})

/**
 * The table is the map's twin, so it takes the map's box.
 *
 * All 290 rows stay in the document — find-in-page, a screen reader's table mode and the reflow
 * test all read the same table — and the box scrolls. Laid out in the page instead, the 290 rows
 * made the document thirteen thousand pixels tall and turned a view into a scroll.
 */
describe('DataTable, as a view rather than a page', () => {
  it('keeps every municipality in the document, not just the visible ones', () => {
    const { container } = draw()
    expect(container.querySelectorAll('tbody tr')).toHaveLength(290)
  })

  it('sits in the scroll container the stage height is applied to', () => {
    const { container } = draw()
    const table = container.querySelector('table.data-table')
    expect(table?.closest('.table-scroll')).not.toBeNull()
  })

  it('keeps the sort controls in the header, so scrolling cannot take them away', () => {
    const { container } = draw()
    const head = container.querySelector('thead')!
    expect(head.querySelectorAll('button').length).toBeGreaterThan(0)
  })

  it('opens scrolled to the selected municipality, not to the top of the alphabet', () => {
    // Choosing Malmö and then the table used to show Ale, Alingsås and Alvesta, with the row
    // the visitor had chosen 200 rows further down. jsdom lays nothing out, so the geometry is
    // stated: the box is 400 px tall and Malmö's row starts 5,000 px below its top.
    const box = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const top = this.getAttribute('aria-current') === 'true' ? 5000 : 0
        return { top, bottom: top + 40, left: 0, right: 0, width: 0, height: 40 } as DOMRect
      })
    const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400)
    try {
      render(
        <DataTable
          lk={lk}
          indicatorId="population"
          year={2024}
          selected="1280"
          lang="en"
          onSelect={vi.fn()}
        />,
      )
      // Centred: the row's top, less half the box, plus half the row (40 px tall).
      expect(screen.getByRole('region').scrollTop).toBe(5000 - 200 + 20)
    } finally {
      box.mockRestore()
      height.mockRestore()
    }
  })

  it('shows a rank without repeating the column heading in every cell', () => {
    draw()
    const stockholm = bodyRows().find(
      (r) => within(r).getByRole('rowheader').textContent === 'Stockholm',
    )!
    expect(stockholm.textContent).toMatch(/1 of 290$/)
    expect(stockholm.textContent).not.toMatch(/rank/i)
  })
})
