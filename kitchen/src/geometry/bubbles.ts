import { forceCollide, forceSimulation, forceX, forceY } from 'd3-force'
import { LAYOUT_SCALE, MIN_R, maxRadiusFor, radiusFor, sizeNorms } from '../../../shared/bubbles'
import type { ScaleKind } from '../../../shared/bubbles'
import { strandedIn } from '../../../shared/navigate'
import { BubbleLayout, type IndicatorSeries } from '../../../shared/pantry'
import { cmp } from '../cmp'

/**
 * One Dorling layout per indicator, since Plan 21.
 *
 * Until then there was one layout, sized by population, and the site drew every measure on it.
 * A bubble's size therefore said how many people lived there whatever the map was about. Sizing
 * by the measure instead cannot be done on that layout: its positions were solved for population
 * radii, and any other sizing puts bubbles over each other wherever municipalities are dense. So
 * the layout is solved per indicator, from the slots that indicator actually needs, and published
 * inside that indicator's file.
 *
 * **A slot is the largest bubble a municipality takes in any year**, so the year slider changes
 * sizes and never positions — a bubble grows and shrinks in place — and no two bubbles can overlap
 * in any year, because the collision was solved for the biggest each ever gets.
 *
 * **Every layout spends the same total area**, `AREA_BUDGET` of its box, which is what keeps the
 * country recognisable. See `shared/bubbles.ts` for the sizing rule and the measured reasons.
 *
 * **The kitchen proves each layout reachable before it writes it.** Plan 3 proved every
 * municipality arrow-reachable on the map and Plan 4 on the one bubble layout, both by measuring
 * a cone against a fixed set of positions. Forty-two layouts cannot each be measured by hand, so
 * this tries the spacing variants below in a fixed order, takes the first whose narrowest cone
 * reaches all 290, publishes that cone with the layout, and refuses to publish at all when none
 * does. The site's tests then re-prove every published layout by the same rule.
 *
 * Deterministic, as everything the kitchen writes must be: nodes are sorted by code before the
 * simulation runs, the tick count is fixed rather than stop-when-stable, d3-force's random source
 * is its own seeded generator, the variants are tried in one order, and every published number is
 * rounded.
 */

export type LayoutInput = {
  /** Named in every error, because a layout that fails is one indicator's problem. */
  indicator: string
  kind: ScaleKind
  /** In the unit square, as `centroids()` in `./build.ts` returns them. */
  centroids: ReadonlyMap<string, readonly [number, number]>
  /** Row order is the municipality order; `series.values[row][col]` is a cell. */
  municipalities: readonly { code: string }[]
  series: Pick<IndicatorSeries, 'values'>
  /** The geographic adjacency, which the arrow keys prefer wherever it points the right way. */
  neighbours: Readonly<Record<string, readonly string[]>>
}

/**
 * Tried in this order. The first is the pairing the population layout has always used; the rest
 * loosen or tighten the pull home and the gap between bubbles. Measured on the real pantry: with
 * `MIN_R` at 8 every one of the 42 layouts is reachable on the first variant or the second, so the
 * later ones are insurance against a future refresh rather than something the current data needs.
 */
export const SPACING_VARIANTS: readonly { home: number; gap: number }[] = [
  { home: 0.05, gap: 2 },
  { home: 0.03, gap: 2 },
  { home: 0.08, gap: 2 },
  { home: 0.05, gap: 4 },
  { home: 0.03, gap: 4 },
  { home: 0.08, gap: 4 },
]

/**
 * Widest to try, in degrees. The map's cone is 45 and the old bubble layout needed 50; past 60 the
 * arrow keys start collapsing two directions onto one destination, which `navigate.ts` measured
 * as the cost of widening. A layout that needs more than this is not published.
 */
export const CONES = [45, 50, 55, 60] as const

const TICKS = 300
/** Decimal places in a published coordinate: 0.01 of a 1000-unit box is far below a pixel. */
const PLACES = 2

type Node = { code: string; x: number; y: number; r: number; x0: number; y0: number }

/** Rounded UP, so the site's radius — computed from the same `maxR` — can never exceed the slot. */
function ceilTo(value: number, places: number): number {
  const factor = 10 ** places
  return Number((Math.ceil(value * factor - 1e-9) / factor).toFixed(places))
}

function floorTo(value: number, places: number): number {
  const factor = 10 ** places
  return Number((Math.floor(value * factor + 1e-9) / factor).toFixed(places))
}

function roundTo(value: number, places: number): number {
  return Number(value.toFixed(places))
}

function dorling(
  homes: readonly { code: string; x: number; y: number; r: number }[],
  variant: { home: number; gap: number },
): Node[] {
  const nodes: Node[] = homes.map((h) => ({ ...h, x0: h.x, y0: h.y }))
  const sim = forceSimulation(nodes)
    .force('x', forceX<Node>((d) => d.x0).strength(variant.home))
    .force('y', forceY<Node>((d) => d.y0).strength(variant.home))
    .force('collide', forceCollide<Node>((d) => d.r + variant.gap).iterations(3))
    .stop()
  for (let i = 0; i < TICKS; i++) sim.tick()
  return nodes
}

export function buildBubbleLayout(input: LayoutInput): BubbleLayout {
  const { municipalities, series, kind } = input
  const rows = municipalities.length
  const years = series.values[0]?.length ?? 0

  // The largest norm each municipality takes in any year. Absent throughout stays null, and is
  // drawn at the floor in every year.
  const maxNorm: Array<number | null> = municipalities.map(() => null)
  for (let col = 0; col < years; col++) {
    const norms = sizeNorms(
      municipalities.map((_, row) => series.values[row]?.[col] ?? null),
      kind,
    )
    norms.forEach((n, row) => {
      if (n === null) return
      const previous = maxNorm[row]
      maxNorm[row] = previous === null || previous === undefined ? n : Math.max(previous, n)
    })
  }
  const sumOfMaxNorms = maxNorm.reduce<number>((a, n) => a + (n ?? 0), 0)
  // Floored, so the published maximum is never above the one the slots were sized from.
  const maxR = floorTo(maxRadiusFor(sumOfMaxNorms, rows), 4)
  const sizing = { minR: MIN_R, maxR }

  const homes = municipalities
    .map((m, row) => {
      const c = input.centroids.get(m.code)
      if (!c) throw new Error(`${input.indicator}: no centroid for municipality ${m.code}`)
      return {
        code: m.code,
        x: c[0] * LAYOUT_SCALE,
        y: c[1] * LAYOUT_SCALE,
        r: ceilTo(radiusFor(maxNorm[row] ?? null, sizing), PLACES),
      }
    })
    // Plain structural comparison, not localeCompare (see kitchen/src/cmp.ts): node order feeds
    // the force simulation, so the sort must not depend on the running machine's collation.
    .sort((a, b) => cmp(a.code, b.code))

  let lastStranded: string[] = []
  for (const variant of SPACING_VARIANTS) {
    const circles = dorling(homes, variant).map((n) => ({
      code: n.code,
      x: roundTo(n.x, PLACES),
      y: roundTo(n.y, PLACES),
      r: n.r,
    }))
    // Proven on the ROUNDED positions, which are the ones the site will navigate.
    const centroids = new Map(circles.map((c) => [c.code, [c.x, c.y] as const]))
    for (const cone of CONES) {
      const stranded = strandedIn({
        neighbours: input.neighbours,
        centroids,
        coneCos: Math.cos((cone * Math.PI) / 180),
      })
      if (stranded.length === 0) {
        return BubbleLayout.parse({ minR: MIN_R, maxR, cone, circles })
      }
      lastStranded = stranded
    }
  }
  throw new Error(
    `${input.indicator}: no bubble layout reaches every municipality with the arrow keys. ` +
      `Tried ${SPACING_VARIANTS.length} spacings and cones up to ${CONES[CONES.length - 1]}°; ` +
      `the last attempt stranded ${lastStranded.join(', ')}. Widen SPACING_VARIANTS or CONES ` +
      'in kitchen/src/geometry/bubbles.ts, or raise MIN_R in shared/bubbles.ts.',
  )
}
