import { describe, expect, it } from 'vitest'
import {
  circlePath,
  middleOf,
  morphD,
  pairFor,
  sampleCircle,
  sampleOutline,
  startAngleFor,
  SAMPLE_POINTS,
  type MorphPair,
  type Point,
} from './morph'

/**
 * jsdom implements neither `getTotalLength` nor `getPointAtLength`, which is why
 * `sampleOutline` takes the path element rather than creating one: the browser owns the path
 * arithmetic and this file owns the spacing, the ordering and the lerp. The real measurement is
 * exercised in `e2e/morph.spec.ts`, against real geometry in three engines.
 */
function fakePath(shape: { length: number; at: (d: number) => Point }): SVGPathElement {
  let attribute = ''
  return {
    setAttribute: (_: string, value: string) => {
      attribute = value
    },
    getAttribute: () => attribute,
    getTotalLength: () => shape.length,
    getPointAtLength: (d: number) => {
      const [x, y] = shape.at(d)
      return { x, y }
    },
  } as unknown as SVGPathElement
}

/** A unit square walked clockwise, perimeter 4, so sampled points are easy to predict. */
const square = fakePath({
  length: 4,
  at: (d) => {
    const s = ((d % 4) + 4) % 4
    if (s < 1) return [s, 0]
    if (s < 2) return [1, s - 1]
    if (s < 3) return [3 - s, 1]
    return [0, 4 - s]
  },
})

describe('sampleOutline', () => {
  it('returns the number of points asked for', () => {
    expect(sampleOutline(square, 'ignored', 8)).toHaveLength(8)
    expect(sampleOutline(square, 'ignored')).toHaveLength(SAMPLE_POINTS)
  })

  it('spaces them equally along the outline, not equally in x or y', () => {
    // Four points around a unit square are its four corners.
    expect(sampleOutline(square, 'ignored', 4)).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ])
  })

  it('starts at the beginning of the path and does not close it', () => {
    const pts = sampleOutline(square, 'ignored', 8)
    expect(pts[0]).toEqual([0, 0])
    // The last sample is before the start, never a duplicate of it: the lerp closes the path
    // with Z, and a repeated point would waste one of the 32.
    expect(pts[pts.length - 1]).not.toEqual(pts[0])
  })

  it('passes the path data to the element it was given', () => {
    sampleOutline(square, 'M0 0L1 1Z', 4)
    expect(square.getAttribute('d')).toBe('M0 0L1 1Z')
  })

  it('throws on a path with no length rather than dividing by zero', () => {
    const empty = fakePath({ length: 0, at: () => [0, 0] })
    expect(() => sampleOutline(empty, 'M0 0Z', 4)).toThrow(/length 0/)
  })
})

describe('sampleCircle', () => {
  it('returns evenly spaced points on the circle', () => {
    const pts = sampleCircle({ x: 0, y: 0, r: 1 }, 0, 4)
    expect(pts[0]![0]).toBeCloseTo(1, 10)
    expect(pts[1]![1]).toBeCloseTo(1, 10)
    expect(pts[2]![0]).toBeCloseTo(-1, 10)
    for (const p of pts) expect(Math.hypot(p[0], p[1])).toBeCloseTo(1, 10)
  })

  it('starts where it is told', () => {
    const pts = sampleCircle({ x: 0, y: 0, r: 1 }, Math.PI / 2, 4)
    expect(pts[0]![1]).toBeCloseTo(1, 10)
  })
})

describe('startAngleFor', () => {
  it('is the angle of the first point seen from the middle', () => {
    // First point directly to the right of the middle -> angle 0.
    expect(
      startAngleFor([
        [2, 1],
        [0, 1],
        [1, 0],
        [1, 2],
      ]),
    ).toBeCloseTo(0, 10)
    // First point directly below -> angle +pi/2 (y grows downwards on screen).
    expect(
      startAngleFor([
        [1, 2],
        [1, 0],
        [0, 1],
        [2, 1],
      ]),
    ).toBeCloseTo(Math.PI / 2, 10)
  })

  it('stops a shape spinning on its way over', () => {
    // The property that matters. Two shapes whose outlines start at opposite corners must be
    // given circles that start at opposite angles too — otherwise each point would travel
    // around the circle rather than outward, and the municipality would visibly rotate.
    const a: Point[] = [
      [2, 2],
      [0, 2],
      [0, 0],
      [2, 0],
    ]
    const b: Point[] = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ]
    const difference = Math.abs(startAngleFor(a) - startAngleFor(b))
    expect(difference).toBeCloseTo(Math.PI, 10)
  })
})

describe('middleOf', () => {
  it('averages the points', () => {
    expect(
      middleOf([
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
      ]),
    ).toEqual([1, 1])
  })

  it('throws on nothing rather than returning NaN', () => {
    expect(() => middleOf([])).toThrow(/no points/)
  })
})

describe('circlePath', () => {
  it('draws a circle as two arcs, never one', () => {
    // A single 360-degree arc has identical start and end points, which SVG leaves undefined
    // and browsers render as nothing at all.
    const d = circlePath({ x: 10, y: 20, r: 5 })
    expect(d.match(/A/g)).toHaveLength(2)
    expect(d).toBe('M5 20A5 5 0 1 0 15 20A5 5 0 1 0 5 20Z')
  })
})

describe('morphD', () => {
  const pair: MorphPair = {
    code: '0001',
    mapD: 'M0 0L10 0L10 10Z',
    cartogramD: 'CIRCLE',
    from: [
      [0, 0],
      [10, 0],
      [10, 10],
    ],
    to: [
      [100, 100],
      [110, 100],
      [110, 110],
    ],
  }

  it('draws the real map path at rest at the map end', () => {
    // Not the resampling: at rest the visitor is looking at a coastline, and 32 points is not
    // a coastline. This is what lets the sample count be chosen for the frame budget.
    expect(morphD(pair, 0)).toBe('M0 0L10 0L10 10Z')
    expect(morphD(pair, -0.2)).toBe('M0 0L10 0L10 10Z')
  })

  it('draws the real circle at rest at the cartogram end', () => {
    expect(morphD(pair, 1)).toBe('CIRCLE')
    expect(morphD(pair, 1.5)).toBe('CIRCLE')
  })

  it('interpolates in between', () => {
    expect(morphD(pair, 0.5)).toBe('M50.0 50.0L60.0 50.0L60.0 60.0Z')
  })

  it('moves every point toward its own partner, in order', () => {
    // Point i of the outline travels to point i of the circle. Pairing them any other way is
    // what makes a shape turn inside out on the way over.
    const quarter = morphD(pair, 0.25)
    expect(quarter).toBe('M25.0 25.0L35.0 25.0L35.0 35.0Z')
  })

  it('closes the path', () => {
    expect(morphD(pair, 0.5).endsWith('Z')).toBe(true)
  })
})

describe('pairFor', () => {
  it('samples both ends to the same length and keeps the real geometry', () => {
    const pair = pairFor(square, '0001', 'M0 0L1 0L1 1L0 1Z', { code: '0001', x: 5, y: 5, r: 2 }, 8)
    expect(pair.from).toHaveLength(8)
    expect(pair.to).toHaveLength(8)
    expect(pair.mapD).toBe('M0 0L1 0L1 1L0 1Z')
    expect(pair.cartogramD).toBe(circlePath({ x: 5, y: 5, r: 2 }))
    expect(pair.code).toBe('0001')
  })

  it('aims the circle at the shape, so point 0 travels outward rather than across', () => {
    // The mutation this catches: replacing startAngleFor(from) with a fixed 0 in pairFor left
    // every other test in this file green. The square fake starts at its top-left corner, so
    // seen from its middle that first point is up and to the left — and its partner on the
    // circle has to be up and to the left of the centre too. With a fixed start angle it would
    // be at three o'clock, and the whole shape would rotate on its way over.
    const pair = pairFor(square, '0001', 'M0 0Z', { code: '0001', x: 100, y: 100, r: 10 }, 8)
    const [x, y] = pair.to[0]!
    expect(x).toBeLessThan(100)
    expect(y).toBeLessThan(100)
  })

  it('puts every destination point on the circle', () => {
    const pair = pairFor(square, '0001', 'M0 0Z', { code: '0001', x: 5, y: 5, r: 2 }, 8)
    for (const p of pair.to) expect(Math.hypot(p[0] - 5, p[1] - 5)).toBeCloseTo(2, 10)
  })
})
