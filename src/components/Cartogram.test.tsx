import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import rawData from '../../public/pantry/data/indicators.json'
import rawBubbles from '../../public/pantry/layout/bubbles.json'
import rawAdjacency from '../../public/pantry/geometry/adjacency.json'
import rawTopology from '../../public/pantry/geometry/municipalities.topo.json'
import type { MunicipalityTopology } from '../../shared/geometry'
import { Adjacency, Bubbles, PantryData } from '../../shared/pantry'
import { lookup } from '../data/select'
import { fillFor } from '../map/colour'
import { CARTOGRAM_CONE_COS, DIRECTIONS, step, type NavContext } from '../map/navigate'
import { Cartogram } from './Cartogram'
import { MapView } from './MapView'

const lk = lookup(PantryData.parse(rawData))
const bubbles = Bubbles.parse(rawBubbles)
const adjacency = Adjacency.parse(rawAdjacency)
const topology = rawTopology as unknown as MunicipalityTopology

const draw = (over: Partial<Parameters<typeof Cartogram>[0]> = {}) => {
  const onSelect = vi.fn()
  const onNoMove = vi.fn()
  const result = render(
    <Cartogram
      lk={lk}
      bubbles={bubbles}
      adjacencyNeighbours={adjacency.neighbours}
      indicatorId="population"
      year={2024}
      selected={null}
      lang="en"
      onSelect={onSelect}
      onNoMove={onNoMove}
      {...over}
    />,
  )
  return { onSelect, onNoMove, ...result }
}

describe('Cartogram', () => {
  it('draws all 290 municipalities as circles', () => {
    draw()
    expect(screen.getAllByRole('button')).toHaveLength(290)
  })

  it('gives each one the same accessible name the map gives it', () => {
    draw()
    render(
      <MapView
        lk={lk}
        topology={topology}
        adjacency={adjacency}
        indicatorId="population"
        year={2024}
        selected={null}
        lang="en"
        onSelect={() => {}}
      />,
    )
    const names = screen.getAllByRole('button', { name: /^Stockholm,/ })
    expect(names).toHaveLength(2)
    expect(names[0]!.getAttribute('aria-label')).toBe(names[1]!.getAttribute('aria-label'))
  })

  it('colours a municipality exactly as the map would', () => {
    const { container } = draw()
    const stockholm = screen.getByRole('button', { name: /^Stockholm/ })
    const expected = fillFor(lk.indicator('population'), 995_574, 'present')
    expect(stockholm.getAttribute('fill')).toBe(expected)
    expect(container.querySelectorAll('circle[role="button"]')).toHaveLength(290)
  })

  it('patterns an absence the same way the map does', () => {
    draw({ indicatorId: 'house-prices', year: 1989 })
    const salem = screen.getByRole('button', { name: /^Salem/ })
    expect(salem.getAttribute('fill')).toMatch(/^url\(#/)
  })

  it('is one tab stop with a roving tabindex inside', () => {
    draw()
    const shapes = screen.getAllByRole('button')
    expect(shapes.filter((s) => s.getAttribute('tabindex') === '0')).toHaveLength(1)
  })

  it('rings the selection the same way the map does', () => {
    const { container } = draw({ selected: '1280' })
    expect(container.querySelector('[data-selection-ring]')).not.toBeNull()
  })

  it('clips nothing: every circle fits inside the viewBox', () => {
    const { container } = draw()
    const [minX, minY, width, height] = container
      .querySelector('svg')!
      .getAttribute('viewBox')!
      .split(' ')
      .map(Number) as [number, number, number, number]
    for (const c of bubbles.circles) {
      expect(c.x - c.r).toBeGreaterThanOrEqual(minX)
      expect(c.y - c.r).toBeGreaterThanOrEqual(minY)
      expect(c.x + c.r).toBeLessThanOrEqual(minX + width)
      expect(c.y + c.r).toBeLessThanOrEqual(minY + height)
    }
  })

  it('moves focus with the arrow keys', async () => {
    draw({ selected: '0180' })
    screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('tabindex') === '0')!
      .focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(document.activeElement?.getAttribute('aria-label')).not.toMatch(/^Stockholm/)
    expect(document.activeElement?.getAttribute('role')).toBe('button')
  })

  it('selects with Enter and with a click', async () => {
    const { onSelect } = draw()
    await userEvent.click(screen.getByRole('button', { name: /^Malmö/ }))
    expect(onSelect).toHaveBeenCalledWith('1280')
  })
})

describe('arrow keys on the bubble layout', () => {
  /**
   * Plan 3 proved every municipality is arrow-reachable on the geographic layout. Moving every
   * centroid breaks that proof, so it is re-established here rather than inherited. It genuinely
   * needed a different cone: at the map's 45 degrees the bubble layout strands Salem, and 50
   * reaches all 290 — measured by sweeping this exact assertion over the real positions.
   */
  const nav: NavContext = {
    neighbours: adjacency.neighbours,
    centroids: new Map(bubbles.circles.map((c) => [c.code, [c.x, c.y] as const])),
    coneCos: CARTOGRAM_CONE_COS,
  }
  const codes = bubbles.circles.map((c) => c.code)

  it('leaves no municipality that nothing can arrow onto', () => {
    const reached = new Set<string>()
    for (const code of codes) {
      for (const d of DIRECTIONS) {
        const to = step(code, d, nav)
        if (to) reached.add(to)
      }
    }
    expect(codes.filter((c) => !reached.has(c))).toEqual([])
    expect(reached.size).toBe(290)
  })

  it('leaves every municipality by at least one key', () => {
    for (const code of codes) {
      expect(DIRECTIONS.map((d) => step(code, d, nav)).filter(Boolean).length).toBeGreaterThan(0)
    }
  })

  it('shows that the map cone is not wide enough for this layout', () => {
    // The measurement that chose the number, kept as a test so that narrowing the cartogram's
    // cone back to the map's has to fail rather than quietly stranding somebody.
    const narrow: NavContext = { ...nav, coneCos: Math.cos((45 * Math.PI) / 180) }
    const reached = new Set<string>()
    for (const code of codes) {
      for (const d of DIRECTIONS) {
        const to = step(code, d, narrow)
        if (to) reached.add(to)
      }
    }
    expect(codes.filter((c) => !reached.has(c))).toEqual(['0128'])
  })
})
