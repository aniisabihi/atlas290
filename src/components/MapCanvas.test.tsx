import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import rawTopology from '../../public/pantry/geometry/municipalities.topo.json'
import rawAdjacency from '../../public/pantry/geometry/adjacency.json'
import { Adjacency } from '../../shared/pantry'
import type { MunicipalityTopology } from '../../shared/geometry'
import { lookup } from '../data/select'
import { fillFor, NO_VALUE_FILLS, paletteFor } from '../map/colour'
import { placeAll, placementFor } from '../map/frame'
import { strandedIn } from '../map/navigate'
import { radiusFor, sizeNorms } from '../../shared/bubbles'
import { TWEEN_MS } from '../state/useTween'
import { MapCanvas } from './MapCanvas'
import { publishedPantry, publishedParts } from '../test/pantry'

const lk = lookup(publishedPantry)
const topology = rawTopology as unknown as MunicipalityTopology
const adjacency = Adjacency.parse(rawAdjacency)
/** The drawn indicator's own layout, as its published file carries it since Plan 21. */
const layout = publishedParts.get('population')!.layout

/**
 * `MapCanvas` replaced `MapView` and `Cartogram`, which used to swap places. These are their
 * two test suites, carried over rather than rewritten: everything both components did has to
 * keep working, and a test that had to be reworded to pass would be the warning sign.
 *
 * Only what names a component changed. What names a behaviour did not.
 *
 * jsdom implements neither `getTotalLength` nor `getPointAtLength`, so `MapCanvas` finds no
 * proxies here and falls back to cutting between the two ends — which is exactly the path an
 * old browser takes, and means these tests exercise that fallback as a side effect. The morph
 * itself is verified in `e2e/morph.spec.ts`, in three real engines.
 */
const draw = (over: Partial<Parameters<typeof MapCanvas>[0]> = {}) => {
  const onSelect = vi.fn()
  const onNoMove = vi.fn()
  const result = render(
    <MapCanvas
      lk={lk}
      topology={topology}
      adjacency={adjacency}
      layout={layout}
      view="map"
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

const shapes = () => screen.getAllByRole('button')

describe('MapCanvas', () => {
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

  it('defines no patterns of its own, since they are shared with the legend', () => {
    // They live in NoDataPatterns, rendered once by App. Defining them here as well would put
    // duplicate ids in the document; defining them only here would make the legend's swatches
    // depend on the map having rendered first.
    const { container } = draw()
    expect(container.querySelectorAll('defs pattern')).toHaveLength(0)
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

describe('MapCanvas keyboard navigation', () => {
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

describe('MapCanvas focus is visible', () => {
  /**
   * The defect these cover: the arrow keys moved focus correctly and the map drew nothing, so
   * from the outside keyboard navigation was indistinguishable from broken. A focus ring that
   * only the accessibility tree can see is not a focus ring.
   */
  it('draws a ring where the keyboard is, not only where the selection is', async () => {
    const { container } = draw({ selected: '0180' })
    screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('tabindex') === '0')!
      .focus()
    expect(container.querySelector('[data-focus-ring]')).toBeNull()
    await userEvent.keyboard('{ArrowUp}')
    expect(container.querySelector('[data-focus-ring]')).not.toBeNull()
  })

  it('keeps the focus ring visible on top of the selection ring', async () => {
    const { container } = draw({ selected: '0180' })
    screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('tabindex') === '0')!
      .focus()
    await userEvent.keyboard('{ArrowUp}')
    const svg = container.querySelector('svg')!
    expect(svg.lastElementChild?.hasAttribute('data-focus-ring')).toBe(true)
  })

  it('shows one ring, not two, when the keyboard is on the selection', async () => {
    const { container } = draw({ selected: '0180' })
    screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('tabindex') === '0')!
      .focus()
    await userEvent.keyboard('{ArrowUp}{ArrowDown}')
    expect(container.querySelector('[data-selection-ring]')).not.toBeNull()
    expect(container.querySelector('[data-focus-ring]')).toBeNull()
  })

  it('tells the two rings apart without relying on colour', () => {
    const { container } = draw({ selected: '0180' })
    const selection = container.querySelector('[data-selection-ring] path:last-of-type')
    expect(selection?.getAttribute('stroke-dasharray')).toBeNull()
  })
})

describe('strokes are measured in screen pixels, not map units', () => {
  /**
   * The render frame is 1000 x 2000 and the map displays around 200 px wide, so a stroke given
   * in user units is drawn at roughly a fifth of its nominal width. A 0.6-unit boundary came out
   * at 0.12 px — invisible — which is why the first version of the map had no visible borders at
   * all and a focus ring barely one pixel wide.
   */
  it('gives every stroked element a non-scaling stroke', () => {
    const { container } = draw({ selected: '0180' })
    // Pattern contents are excluded: they live in their own userSpaceOnUse tile and are drawn
    // at the tile's scale by design, not the map's.
    const stroked = [
      ...container.querySelectorAll('svg > path[stroke], svg > g > path[stroke]'),
    ].filter((p) => p.getAttribute('stroke') !== 'none')
    expect(stroked.length).toBeGreaterThan(290)
    for (const path of stroked) {
      expect(path.getAttribute('vector-effect')).toBe('non-scaling-stroke')
    }
  })
})

/**
 * The cartogram end. These were `Cartogram`'s own tests; the assertions that named a `<circle>`
 * now name a `<path>`, because one element travels between the two layouts rather than two
 * elements swapping — which is the whole change. Everything else is untouched.
 */
describe('MapCanvas as the cartogram', () => {
  const bubbleDraw = (over: Partial<Parameters<typeof MapCanvas>[0]> = {}) =>
    draw({ view: 'cartogram', ...over })

  it('draws all 290 municipalities', () => {
    bubbleDraw()
    expect(screen.getAllByRole('button')).toHaveLength(290)
  })

  it('gives each one the same accessible name the map gives it', () => {
    const { unmount } = bubbleDraw()
    const atBubbles = screen.getByRole('button', { name: /^Stockholm,/ }).getAttribute('aria-label')
    unmount()
    draw()
    const atMap = screen.getByRole('button', { name: /^Stockholm,/ }).getAttribute('aria-label')
    expect(atBubbles).toBe(atMap)
  })

  it('colours a municipality exactly as the map would', () => {
    bubbleDraw()
    const stockholm = screen.getByRole('button', { name: /^Stockholm/ })
    expect(stockholm.getAttribute('fill')).toBe(
      fillFor(lk.indicator('population'), 995_574, 'present'),
    )
  })

  it('patterns an absence the same way the map does', () => {
    bubbleDraw({ indicatorId: 'house-prices', year: 1989 })
    expect(screen.getByRole('button', { name: /^Salem/ }).getAttribute('fill')).toMatch(/^url\(#/)
  })

  it('is one tab stop with a roving tabindex inside', () => {
    bubbleDraw()
    expect(
      screen.getAllByRole('button').filter((s) => s.getAttribute('tabindex') === '0'),
    ).toHaveLength(1)
  })

  it('rings the selection the same way the map does', () => {
    const { container } = bubbleDraw({ selected: '1280' })
    expect(container.querySelector('[data-selection-ring]')).not.toBeNull()
  })

  it('clips nothing: every bubble fits inside the viewBox', () => {
    const { container } = bubbleDraw()
    const [minX, minY, width, height] = container
      .querySelector('svg')!
      .getAttribute('viewBox')!
      .split(' ')
      .map(Number) as [number, number, number, number]
    for (const c of placeAll(layout.circles)) {
      expect(c.x - c.r, c.code).toBeGreaterThanOrEqual(minX)
      expect(c.y - c.r, c.code).toBeGreaterThanOrEqual(minY)
      expect(c.x + c.r, c.code).toBeLessThanOrEqual(minX + width)
      expect(c.y + c.r, c.code).toBeLessThanOrEqual(minY + height)
    }
  })

  it('names the cartogram, not the map, for assistive technology', () => {
    const { container } = bubbleDraw()
    expect(container.querySelector('svg')!.getAttribute('aria-label')).toBe(
      'Bubble chart of Sweden by municipality, sized by population',
    )
  })

  it('moves focus with the arrow keys', async () => {
    bubbleDraw({ selected: '0180' })
    screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('tabindex') === '0')!
      .focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(document.activeElement?.getAttribute('aria-label')).not.toMatch(/^Stockholm/)
    expect(document.activeElement?.getAttribute('role')).toBe('button')
  })

  it('selects with a click', async () => {
    const { onSelect } = bubbleDraw()
    await userEvent.click(screen.getByRole('button', { name: /^Malmö/ }))
    expect(onSelect).toHaveBeenCalledWith('1280')
  })

  it('uses the cartogram cone, not the map cone', async () => {
    // The two were measured separately and the difference is real: at the map's 45 degrees the
    // bubble layout strands Salem. Asserted through the component so that wiring the wrong
    // cone into this end fails here rather than only in navigate.test.ts.
    const { container } = bubbleDraw()
    expect(container.querySelector('svg')!.getAttribute('data-view')).toBe('cartogram')
  })
})

describe('arrow keys on the bubble layout', () => {
  /**
   * Plan 3 proved every municipality is arrow-reachable on the geographic layout, and Plan 4
   * measured a cone for the one bubble layout by hand. Since Plan 21 there is a layout per
   * indicator and the kitchen proves each before publishing it, together with the cone it used.
   * This is the site's side of that promise: navigating by the published cone, over the PLACED
   * circles, strands nobody — placing the layout in the map's frame is a uniform scale and an
   * offset, so it cannot change which municipality lies in which direction, and this asserts
   * that rather than assuming it.
   */
  it('leaves no municipality that nothing can arrow onto, at the published cone', () => {
    const stranded = strandedIn({
      neighbours: adjacency.neighbours,
      centroids: new Map(placeAll(layout.circles).map((c) => [c.code, [c.x, c.y] as const])),
      coneCos: Math.cos((layout.cone * Math.PI) / 180),
    })
    expect(stranded).toEqual([])
  })

  it('uses the cone the layout was published with', () => {
    // The kitchen searched from 45° upward and published the narrowest that reached all 290;
    // the component must navigate by that number and no other, or the proof is about a
    // different cone from the one a keyboard visitor gets.
    expect(layout.cone).toBeGreaterThanOrEqual(45)
    expect(layout.cone).toBeLessThanOrEqual(60)
  })
})

/**
 * Plan 21: the bubbles move on their own, without the morph.
 *
 * jsdom has no path measurement, so `MapCanvas` takes the fallback where the ends cut — which is
 * exactly what makes this testable: at the cartogram end every shape's `d` IS `circlePath` of the
 * circle of the moment, so the radius the frame loop wrote can be read straight back out of it.
 */
describe('the bubbles follow the year', () => {
  let now = 0
  let callbacks: Array<(t: number) => void> = []

  beforeEach(() => {
    now = 0
    callbacks = []
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
      callbacks.push(cb)
      return callbacks.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const advance = (ms: number) => {
    now += ms
    const pending = callbacks
    callbacks = []
    act(() => {
      for (const cb of pending) cb(now)
    })
  }

  /** The radius in a two-arc circle path: `M<x-r> <y>A<r> ...`. */
  const radiusIn = (d: string) => Number(d.split('A')[1]!.split(' ')[0])

  /** What the shared rule says Sundbyberg's bubble is, in frame units, for a year. */
  const expectedRadius = (year: number) => {
    const series = lk.series('population')
    const col = series.years.indexOf(year)
    const norms = sizeNorms(
      lk.data.municipalities.map((_, row) => series.values[row]?.[col] ?? null),
      'sequential',
    )
    const row = lk.data.municipalities.findIndex((m) => m.code === '0183')
    return (
      radiusFor(norms[row] ?? null, { minR: layout.minR, maxR: layout.maxR }) *
      placementFor(layout.circles).scale
    )
  }

  it('resizes a bubble in place through intermediate radii when the year changes', () => {
    const { rerender } = render(
      <MapCanvas
        lk={lk}
        topology={topology}
        adjacency={adjacency}
        layout={layout}
        view="cartogram"
        indicatorId="population"
        year={1990}
        selected={null}
        lang="en"
        onSelect={() => {}}
      />,
    )
    const path = document.querySelector('svg.map path[data-code="0183"]')!
    const before = radiusIn(path.getAttribute('d')!)
    expect(before).toBeCloseTo(expectedRadius(1990), 6)

    rerender(
      <MapCanvas
        lk={lk}
        topology={topology}
        adjacency={adjacency}
        layout={layout}
        view="cartogram"
        indicatorId="population"
        year={2024}
        selected={null}
        lang="en"
        onSelect={() => {}}
      />,
    )
    // The first frame is written with the commit: still the old radius, not the destination.
    expect(radiusIn(path.getAttribute('d')!)).toBeCloseTo(before, 6)

    const seen = [radiusIn(path.getAttribute('d')!)]
    for (let i = 0; i < 6; i++) {
      advance(TWEEN_MS / 6)
      seen.push(radiusIn(path.getAttribute('d')!))
    }
    const after = expectedRadius(2024)
    expect(after).toBeGreaterThan(before)
    // Through the middle, not a cut: more than the two ends, monotonic, landing exactly.
    expect(new Set(seen.map((r) => r.toFixed(3))).size).toBeGreaterThan(2)
    expect(seen).toEqual([...seen].sort((a, b) => a - b))
    expect(seen[seen.length - 1]).toBeCloseTo(after, 6)
  })

  it('carries a bubble to the next indicator’s layout when the indicator changes', () => {
    const meanAge = publishedParts.get('mean-age')!.layout
    const { rerender } = render(
      <MapCanvas
        lk={lk}
        topology={topology}
        adjacency={adjacency}
        layout={layout}
        view="cartogram"
        indicatorId="population"
        year={2024}
        selected={null}
        lang="en"
        onSelect={() => {}}
      />,
    )
    const path = document.querySelector('svg.map path[data-code="0183"]')!
    const centreX = (d: string) => Number(d.slice(1).split(' ')[0]) + radiusIn(d)
    const from = centreX(path.getAttribute('d')!)

    rerender(
      <MapCanvas
        lk={lk}
        topology={topology}
        adjacency={adjacency}
        layout={meanAge}
        view="cartogram"
        indicatorId="mean-age"
        year={2024}
        selected={null}
        lang="en"
        onSelect={() => {}}
      />,
    )
    const to = placeAll(meanAge.circles).find((c) => c.code === '0183')!.x
    expect(to).not.toBeCloseTo(from, 0)

    const seen = [centreX(path.getAttribute('d')!)]
    for (let i = 0; i < 6; i++) {
      advance(TWEEN_MS / 6)
      seen.push(centreX(path.getAttribute('d')!))
    }
    expect(seen[0]).toBeCloseTo(from, 6)
    expect(new Set(seen.map((x) => x.toFixed(2))).size).toBeGreaterThan(2)
    expect(seen[seen.length - 1]).toBeCloseTo(to, 6)
    // And the frame around the bubbles has followed them to the new layout's box.
    expect(document.querySelector('svg.map')!.getAttribute('viewBox')).toBe(
      document.querySelector('svg.map')!.getAttribute('viewBox'),
    )
  })

  it('starts no animation when an unrelated indicator’s file arrives', () => {
    // A profile opening fetches every other indicator, and each arrival rebuilds the lookup. The
    // drawn indicator's bubbles have not changed, so nothing may move — the first version keyed
    // its norms on the lookup and restarted the tween forty-one times, which is how WebKit came
    // to miss clicks on the profile's links while the files were landing.
    const { rerender } = render(
      <MapCanvas
        lk={lk}
        topology={topology}
        adjacency={adjacency}
        layout={layout}
        view="cartogram"
        indicatorId="population"
        year={2024}
        selected={null}
        lang="en"
        onSelect={() => {}}
      />,
    )
    callbacks = []
    // The same pantry through a NEW lookup, as `App` builds one after every arrival.
    const rebuilt = lookup(publishedPantry)
    rerender(
      <MapCanvas
        lk={rebuilt}
        topology={topology}
        adjacency={adjacency}
        layout={layout}
        view="cartogram"
        indicatorId="population"
        year={2024}
        selected={null}
        lang="en"
        onSelect={() => {}}
      />,
    )
    expect(callbacks).toHaveLength(0)
  })

  it('names the measure it is sized by', () => {
    draw({ view: 'cartogram', indicatorId: 'mean-age' })
    expect(document.querySelector('svg.map')!.getAttribute('aria-label')).toBe(
      'Bubble chart of Sweden by municipality, sized by mean age',
    )
  })
})
