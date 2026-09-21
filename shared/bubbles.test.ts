import { describe, expect, it } from 'vitest'
import { AREA_BUDGET, LAYOUT_SCALE, MIN_R, maxRadiusFor, radiusFor, sizeNorms } from './bubbles'

/**
 * The one sizing rule the kitchen and the site share. A slot the kitchen reserved and a bubble
 * the site draws must come from the same arithmetic, or one year a bubble lies over its
 * neighbour — so the arithmetic is pinned here, once.
 */
describe('sizeNorms', () => {
  it('puts the year’s lowest at 0 and its highest at 1', () => {
    expect(sizeNorms([10, 20, 30], 'sequential')).toEqual([0, 0.5, 1])
  })

  it('keeps an absent value absent rather than treating it as the lowest', () => {
    expect(sizeNorms([10, null, 30], 'sequential')).toEqual([0, null, 1])
  })

  it('compares a diverging measure by magnitude from zero, not from its minimum', () => {
    // −20 and +20 are equally large changes; the ramp says which way, the size says how much.
    expect(sizeNorms([-20, 0, 20, 10], 'diverging')).toEqual([1, 0, 1, 0.5])
  })

  it('does not let a diverging year’s smallest magnitude become 0 unless it is zero', () => {
    // Magnitudes 5 and 10: the smaller is half as large a change, not "the lowest".
    expect(sizeNorms([5, -10], 'diverging')).toEqual([0.5, 1])
  })

  it('calls every value the highest when they are all equal', () => {
    expect(sizeNorms([7, 7, null], 'sequential')).toEqual([1, 1, null])
  })

  it('returns nothing but absences for a year with no values', () => {
    expect(sizeNorms([null, null], 'sequential')).toEqual([null, null])
  })
})

describe('radiusFor', () => {
  const sizing = { minR: 8, maxR: 40 }

  it('draws an absent value at the floor, so no municipality vanishes', () => {
    expect(radiusFor(null, sizing)).toBe(8)
  })

  it('runs from the floor to the maximum', () => {
    expect(radiusFor(0, sizing)).toBe(8)
    expect(radiusFor(1, sizing)).toBe(40)
  })

  it('is affine in AREA, not in radius', () => {
    // Half the norm is half the area above the floor — the way a bubble chart is read.
    const half = radiusFor(0.5, sizing)
    expect(half ** 2 - 8 ** 2).toBeCloseTo((40 ** 2 - 8 ** 2) / 2, 9)
  })

  it('never grows past the maximum or shrinks below the floor for a norm outside 0–1', () => {
    expect(radiusFor(1.5, sizing)).toBe(40)
    expect(radiusFor(-0.5, sizing)).toBe(8)
  })

  it('is monotonic', () => {
    const radii = [0, 0.1, 0.3, 0.6, 0.9, 1].map((n) => radiusFor(n, sizing))
    expect(radii).toEqual([...radii].sort((a, b) => a - b))
  })
})

describe('maxRadiusFor', () => {
  it('spends exactly the budget when every slot is at its maximum', () => {
    const count = 290
    const maxR = maxRadiusFor(count, count)
    expect(count * Math.PI * maxR ** 2).toBeCloseTo(AREA_BUDGET * LAYOUT_SCALE ** 2, 6)
  })

  it('spends exactly the budget for a mixed set of slots', () => {
    const norms = [1, 0.5, 0.25, 0, 0.75]
    const maxR = maxRadiusFor(
      norms.reduce((a, b) => a + b, 0),
      norms.length,
    )
    const area = norms.reduce((a, n) => a + Math.PI * radiusFor(n, { minR: MIN_R, maxR }) ** 2, 0)
    expect(area).toBeCloseTo(AREA_BUDGET * LAYOUT_SCALE ** 2, 6)
  })

  it('gives a skewed measure a larger maximum than a flat one', () => {
    // Population: one giant, 289 dots. Mean age: everyone near the top. The budget is the same,
    // so the skewed measure's largest bubble is far larger — which is what makes Stockholm's
    // bubble look like Stockholm's bubble.
    const skewed = maxRadiusFor(12, 290)
    const flat = maxRadiusFor(230, 290)
    expect(skewed).toBeGreaterThan(flat * 2)
  })

  it('falls back to the floor rather than an imaginary radius when nothing has a value', () => {
    expect(maxRadiusFor(0, 290)).toBe(MIN_R)
  })

  it('falls back to the floor when the floors alone exceed the budget', () => {
    expect(maxRadiusFor(10, 100_000)).toBe(MIN_R)
  })
})
