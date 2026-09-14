import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import rawData from '../../public/pantry/data/indicators.json'
import rawTopology from '../../public/pantry/geometry/municipalities.topo.json'
import rawAdjacency from '../../public/pantry/geometry/adjacency.json'
import { Adjacency, PantryData } from '../../shared/pantry'
import type { MunicipalityTopology } from '../../shared/geometry'
import { lookup } from '../data/select'
import { NO_VALUE_FILLS, paletteFor } from '../map/colour'
import { MapView } from './MapView'

const lk = lookup(PantryData.parse(rawData))
const topology = rawTopology as unknown as MunicipalityTopology
const adjacency = Adjacency.parse(rawAdjacency)

const draw = (over: Partial<Parameters<typeof MapView>[0]> = {}) => {
  const onSelect = vi.fn()
  const result = render(
    <MapView
      lk={lk}
      topology={topology}
      adjacency={adjacency}
      indicatorId="population"
      year={2024}
      selected={null}
      lang="en"
      onSelect={onSelect}
      {...over}
    />,
  )
  return { onSelect, ...result }
}

const shapes = () => screen.getAllByRole('button')

describe('MapView', () => {
  it('draws all 290 municipalities as content, not as one picture', () => {
    draw()
    expect(shapes()).toHaveLength(290)
  })

  it('is one tab stop, with a roving tabindex inside it', () => {
    // 290 tab stops between the map and whatever follows would be hostile with a keyboard and
    // worse with a screen reader.
    draw()
    const zero = shapes().filter((s) => s.getAttribute('tabindex') === '0')
    const minusOne = shapes().filter((s) => s.getAttribute('tabindex') === '-1')
    expect(zero).toHaveLength(1)
    expect(minusOne).toHaveLength(289)
  })

  it('moves the tab stop onto the selected municipality', () => {
    draw({ selected: '1280' })
    const zero = shapes().filter((s) => s.getAttribute('tabindex') === '0')
    expect(zero).toHaveLength(1)
    expect(zero[0]!.getAttribute('aria-label')).toMatch(/^Malmö/)
  })

  it('names each municipality with its value and unit', () => {
    draw()
    expect(screen.getByRole('button', { name: 'Stockholm, 995,574 residents' })).toBeTruthy()
  })

  it('says why a value is missing rather than leaving it blank', () => {
    draw({ indicatorId: 'house-prices', year: 1989 })
    expect(screen.getByRole('button', { name: /^Salem,.*too few sales/i })).toBeTruthy()
  })

  it('says a municipality did not exist rather than showing it as zero', () => {
    draw({ year: 2000 })
    expect(screen.getByRole('button', { name: /^Knivsta,.*did not exist/i })).toBeTruthy()
  })

  it('says SCB added noise, while still giving the value', () => {
    draw({ year: 2025 })
    const stockholm = screen.getByRole('button', { name: /^Stockholm/ })
    expect(stockholm.getAttribute('aria-label')).toMatch(/999,239 residents/)
    expect(stockholm.getAttribute('aria-label')).toMatch(/noise/i)
  })

  it('fills a published value with its class colour', () => {
    draw()
    const stockholm = screen.getByRole('button', { name: /^Stockholm/ })
    expect(stockholm.getAttribute('fill')).toBe(paletteFor(lk.indicator('population'))[6])
  })

  it('fills a suppressed cell with a pattern, never a colour from the ramp', () => {
    draw({ indicatorId: 'house-prices', year: 1989 })
    const salem = screen.getByRole('button', { name: /^Salem/ })
    expect(salem.getAttribute('fill')).toBe(`url(#${NO_VALUE_FILLS['too-few-cases'].patternId})`)
  })

  it('defines every no-data pattern once, so a fill can never point at nothing', () => {
    const { container } = draw()
    const ids = new Set(
      [...container.querySelectorAll('defs pattern')].map((p) => p.getAttribute('id')),
    )
    for (const { patternId } of Object.values(NO_VALUE_FILLS)) {
      expect(ids.has(patternId), `pattern ${patternId} is referenced but never defined`).toBe(true)
    }
  })

  it('marks the selected municipality for assistive technology', () => {
    draw({ selected: '1280' })
    const current = shapes().filter((s) => s.getAttribute('aria-current') === 'true')
    expect(current).toHaveLength(1)
    expect(current[0]!.getAttribute('aria-label')).toMatch(/^Malmö/)
  })

  it('draws the selection ring last, so a neighbour cannot overdraw it', () => {
    const { container } = draw({ selected: '1280' })
    const svg = container.querySelector('svg')!
    const ring = container.querySelector('[data-selection-ring]')
    expect(ring).not.toBeNull()
    expect(svg.lastElementChild).toBe(ring)
  })

  it('draws no ring when nothing is selected', () => {
    const { container } = draw()
    expect(container.querySelector('[data-selection-ring]')).toBeNull()
  })

  it('reports the code when a municipality is clicked', async () => {
    const { onSelect } = draw()
    await userEvent.click(screen.getByRole('button', { name: /^Malmö/ }))
    expect(onSelect).toHaveBeenCalledWith('1280')
  })

  it('has an accessible name for the map as a whole', () => {
    draw()
    expect(screen.getByRole('group', { name: /map of sweden/i })).toBeTruthy()
  })
})

describe('MapView keyboard navigation', () => {
  const enterMap = async (over: Parameters<typeof draw>[0] = {}) => {
    const rendered = draw(over)
    const start = screen.getAllByRole('button').find((b) => b.getAttribute('tabindex') === '0')!
    start.focus()
    return { ...rendered, start }
  }

  it('moves focus to the neighbour in the direction pressed', async () => {
    await enterMap({ selected: '0180' })
    await userEvent.keyboard('{ArrowUp}')
    // Stockholm's four keys reach Solna, Huddinge, Ekerö and Lidingö; Up is Solna.
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^Solna/)
  })

  it('carries the tab stop along with the focus', async () => {
    await enterMap({ selected: '0180' })
    await userEvent.keyboard('{ArrowRight}')
    const zero = screen.getAllByRole('button').filter((b) => b.getAttribute('tabindex') === '0')
    expect(zero).toHaveLength(1)
    expect(zero[0]!.getAttribute('aria-label')).toMatch(/^Lidingö/)
  })

  it('moving focus does not change the selection', async () => {
    const { onSelect } = await enterMap({ selected: '0180' })
    await userEvent.keyboard('{ArrowUp}{ArrowDown}{ArrowLeft}')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('stays put and says so when nothing lies that way', async () => {
    const onNoMove = vi.fn()
    // Kiruna is the northernmost municipality; there is nothing above it.
    await enterMap({ selected: '2584', onNoMove })
    await userEvent.keyboard('{ArrowUp}')
    expect(onNoMove).toHaveBeenCalledWith('up')
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^Kiruna/)
  })

  it('selects with Enter and with Space', async () => {
    const { onSelect } = await enterMap({ selected: '0180' })
    await userEvent.keyboard('{ArrowUp}{Enter}')
    expect(onSelect).toHaveBeenLastCalledWith('0184')
    await userEvent.keyboard(' ')
    expect(onSelect).toHaveBeenLastCalledWith('0184')
  })

  it('clears the selection with Escape', async () => {
    const { onSelect } = await enterMap({ selected: '1280' })
    await userEvent.keyboard('{Escape}')
    expect(onSelect).toHaveBeenCalledWith('1280')
  })

  it('jumps to the first and last municipality by name with Home and End', async () => {
    await enterMap({ selected: '0180' })
    await userEvent.keyboard('{Home}')
    // Swedish collation, where å, ä and ö sort after z.
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^Ale/)
    await userEvent.keyboard('{End}')
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^Övertorneå/)
  })
})
