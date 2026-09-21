import { describe, expect, it } from 'vitest'
import { MIN_R, radiusFor, sizeNorms } from '../../../shared/bubbles'
import { CONES, buildBubbleLayout, type LayoutInput } from './bubbles'

/**
 * Five municipalities in a row across the middle of the unit square, two of them on the same
 * spot so the collision has work to do, with a two-year series in which the leader changes.
 */
const municipalities = [
  { code: '0001' },
  { code: '0002' },
  { code: '0003' },
  { code: '0004' },
  { code: '0005' },
]
const centroids = new Map<string, readonly [number, number]>([
  ['0001', [0.2, 0.5]],
  ['0002', [0.4, 0.5]],
  ['0003', [0.4, 0.5]],
  ['0004', [0.6, 0.5]],
  ['0005', [0.8, 0.5]],
])
const neighbours = {
  '0001': ['0002'],
  '0002': ['0001', '0003'],
  '0003': ['0002', '0004'],
  '0004': ['0003', '0005'],
  '0005': ['0004'],
}
const values: Array<Array<number | null>> = [
  [100, 50],
  [400, 100],
  [25, null],
  [200, 900],
  [null, null],
]
const input: LayoutInput = {
  indicator: 'test',
  kind: 'sequential',
  centroids,
  municipalities,
  series: { values },
  neighbours,
}

/** The input with its maps built in the opposite insertion order — same facts, different order. */
const reversed: LayoutInput = {
  ...input,
  centroids: new Map([...centroids].reverse()),
  municipalities: [...municipalities].reverse(),
  series: { values: [...values].reverse() },
}

describe('buildBubbleLayout', () => {
  it('is deterministic', () => {
    expect(buildBubbleLayout(input)).toEqual(buildBubbleLayout(input))
  })

  it('does not depend on the order the municipalities arrive in', () => {
    // A Map that happens to be in code order cannot tell "sorted before simulating" from "got
    // lucky with insertion order". Insertion order must not leak into a published layout.
    expect(buildBubbleLayout(reversed)).toEqual(buildBubbleLayout(input))
  })

  it('publishes the circles in code order, one per municipality', () => {
    const layout = buildBubbleLayout(input)
    expect(layout.circles.map((c) => c.code)).toEqual(['0001', '0002', '0003', '0004', '0005'])
  })

  it('separates circles that started on the same spot', () => {
    const layout = buildBubbleLayout(input)
    const [b, c] = [layout.circles[1]!, layout.circles[2]!]
    expect(Math.hypot(b.x - c.x, b.y - c.y)).toBeGreaterThanOrEqual((b.r + c.r) * 0.98)
  })

  it('reserves each municipality a slot no year’s bubble exceeds', () => {
    // The whole promise: the site sizes from the same rule, so a bubble in any year fits its
    // slot and can never lie over a neighbour. Checked for every cell, both years.
    const layout = buildBubbleLayout(input)
    const slot = new Map(layout.circles.map((c) => [c.code, c.r]))
    for (let col = 0; col < 2; col++) {
      const norms = sizeNorms(
        values.map((row) => row[col] ?? null),
        'sequential',
      )
      norms.forEach((n, row) => {
        const r = radiusFor(n, { minR: layout.minR, maxR: layout.maxR })
        expect(r, `${municipalities[row]!.code} in year ${col}`).toBeLessThanOrEqual(
          slot.get(municipalities[row]!.code)!,
        )
      })
    }
  })

  it('gives the year’s leader the full radius, whichever year it leads', () => {
    // 0002 leads year one and 0004 leads year two: both slots are the maximum.
    const layout = buildBubbleLayout(input)
    const slot = new Map(layout.circles.map((c) => [c.code, c.r]))
    expect(slot.get('0002')).toBeGreaterThanOrEqual(layout.maxR)
    expect(slot.get('0004')).toBeGreaterThanOrEqual(layout.maxR)
  })

  it('draws a municipality with no value in any year at the floor', () => {
    const layout = buildBubbleLayout(input)
    expect(layout.circles.find((c) => c.code === '0005')!.r).toBe(MIN_R)
    expect(layout.minR).toBe(MIN_R)
  })

  it('publishes a cone from the allowed set, and the narrowest that works', () => {
    const layout = buildBubbleLayout(input)
    expect([...CONES]).toContain(layout.cone)
    // Five in a row are reachable at 45°; if a wider cone were published for them, the search
    // would be taking the first that works rather than the narrowest.
    expect(layout.cone).toBe(45)
  })

  it('refuses a layout the arrow keys cannot reach, and names the indicator and the code', () => {
    // One municipality alone: nothing can arrow ONTO it, so it is stranded by definition.
    const lone: LayoutInput = {
      indicator: 'lonely',
      kind: 'sequential',
      centroids: new Map([['0001', [0.5, 0.5]]]),
      municipalities: [{ code: '0001' }],
      series: { values: [[1]] },
      neighbours: { '0001': [] },
    }
    expect(() => buildBubbleLayout(lone)).toThrow(/lonely/)
    expect(() => buildBubbleLayout(lone)).toThrow(/0001/)
  })

  it('sizes a diverging measure by magnitude', () => {
    const layout = buildBubbleLayout({
      ...input,
      kind: 'diverging',
      series: {
        values: [
          [-100, -10],
          [50, 20],
          [0, -5],
          [100, 40],
          [null, null],
        ],
      },
    })
    const slot = new Map(layout.circles.map((c) => [c.code, c.r]))
    // −100 and +100 are equally large: the same slot.
    expect(slot.get('0001')).toBe(slot.get('0004'))
    expect(slot.get('0001')).toBeGreaterThan(slot.get('0002')!)
  })
})
