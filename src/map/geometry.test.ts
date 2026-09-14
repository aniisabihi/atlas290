import { describe, expect, it } from 'vitest'
import rawTopology from '../../public/pantry/geometry/municipalities.topo.json'
import type { MunicipalityTopology } from '../../shared/geometry'
import { FRAME, shapesFor } from './geometry'

const topology = rawTopology as unknown as MunicipalityTopology

describe('shapesFor', () => {
  const shapes = shapesFor(topology)

  it('projects all 290 municipalities', () => {
    expect(shapes).toHaveLength(290)
    expect(new Set(shapes.map((s) => s.code)).size).toBe(290)
  })

  it('gives every municipality a non-empty path', () => {
    expect(shapes.every((s) => s.d.length > 0)).toBe(true)
  })

  it('keeps every centroid inside the render frame', () => {
    for (const s of shapes) {
      expect(s.centroid[0], s.code).toBeGreaterThanOrEqual(0)
      expect(s.centroid[0], s.code).toBeLessThanOrEqual(FRAME[0])
      expect(s.centroid[1], s.code).toBeGreaterThanOrEqual(0)
      expect(s.centroid[1], s.code).toBeLessThanOrEqual(FRAME[1])
    }
  })

  it('puts north at a smaller y, which is what arrow-key navigation depends on', () => {
    // Kiruna is Sweden's northernmost municipality, Trelleborg its southernmost.
    const y = (code: string) => shapes.find((s) => s.code === code)!.centroid[1]
    expect(y('2584')).toBeLessThan(y('1287'))
  })

  it('is memoised, so the year slider never reprojects the country', () => {
    expect(shapesFor(topology)).toBe(shapes)
  })
})
