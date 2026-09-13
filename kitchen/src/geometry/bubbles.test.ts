import { describe, expect, it } from 'vitest'
import { buildBubbles } from './bubbles'

const centroids = new Map<string, [number, number]>([
  ['0001', [0.5, 0.5]],
  ['0002', [0.5, 0.5]],
  ['0003', [0.9, 0.9]],
])
const population = new Map([
  ['0001', 100_000],
  ['0002', 25_000],
  ['0003', 400_000],
])

// Same entries as `centroids` above, built by inserting in the reverse order — a Map that
// happens to already be in code order (like the fixture above) cannot tell "the code sorts
// nodes before simulating" apart from "the code just iterates the Map's own insertion order
// and got lucky". Insertion order must not leak into the published layout.
const reversedCentroids = new Map<string, [number, number]>([
  ['0003', [0.9, 0.9]],
  ['0002', [0.5, 0.5]],
  ['0001', [0.5, 0.5]],
])
const reversedPopulation = new Map([
  ['0003', 400_000],
  ['0002', 25_000],
  ['0001', 100_000],
])

describe('buildBubbles', () => {
  it('is deterministic and separates overlapping circles', () => {
    const a = buildBubbles(centroids, population, 2024)
    const b = buildBubbles(centroids, population, 2024)
    expect(a).toEqual(b)
    const [c1, c2] = [a.circles[0]!, a.circles[1]!]
    expect(Math.hypot(c1.x - c2.x, c1.y - c2.y)).toBeGreaterThanOrEqual((c1.r + c2.r) * 0.98)
  })

  it('is independent of the input Map insertion order (review: determinism must not rely on the sort)', () => {
    const forward = buildBubbles(centroids, population, 2024)
    const reversed = buildBubbles(reversedCentroids, reversedPopulation, 2024)
    expect(reversed).toEqual(forward)
  })

  it('scales radius with the square root of population', () => {
    const a = buildBubbles(centroids, population, 2024)
    const r = Object.fromEntries(a.circles.map((c) => [c.code, c.r]))
    expect(r['0001']! / r['0002']!).toBeCloseTo(2, 5)
    expect(a.basedOn).toEqual({ indicator: 'population', year: 2024 })
  })
})
