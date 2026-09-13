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

describe('buildBubbles', () => {
  it('is deterministic and separates overlapping circles', () => {
    const a = buildBubbles(centroids, population, 2024)
    const b = buildBubbles(centroids, population, 2024)
    expect(a).toEqual(b)
    const [c1, c2] = [a.circles[0]!, a.circles[1]!]
    expect(Math.hypot(c1.x - c2.x, c1.y - c2.y)).toBeGreaterThanOrEqual((c1.r + c2.r) * 0.98)
  })

  it('scales radius with the square root of population', () => {
    const a = buildBubbles(centroids, population, 2024)
    const r = Object.fromEntries(a.circles.map((c) => [c.code, c.r]))
    expect(r['0001']! / r['0002']!).toBeCloseTo(2, 5)
    expect(a.basedOn).toEqual({ indicator: 'population', year: 2024 })
  })
})
