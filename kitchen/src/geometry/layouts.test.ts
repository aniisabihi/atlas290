import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AREA_BUDGET, LAYOUT_SCALE, MIN_R, radiusFor, sizeNorms } from '../../../shared/bubbles'
import { strandedIn } from '../../../shared/navigate'
import { Adjacency } from '../../../shared/pantry'
import { DEFAULT_PANTRY_DIR, readPantryParts } from '../publish'

/**
 * Every PUBLISHED bubble layout, re-proven from the files.
 *
 * `bubbles.test.ts` proves the builder on five municipalities. This proves what it actually
 * wrote for all 290, forty-two times over: reachable with the arrow keys at the cone it
 * published, no two slots overlapping, no year's bubble larger than its slot, and the country
 * still recognisably the country. If a data refresh ever changes a layout so that one of these
 * stops being true, `yarn kitchen publish` should have refused — and this is the second line.
 */
const pantry = readPantryParts(DEFAULT_PANTRY_DIR)
const adjacency = Adjacency.parse(
  JSON.parse(readFileSync(join(DEFAULT_PANTRY_DIR, 'geometry/adjacency.json'), 'utf8')),
)
const layouts = pantry.layouts ?? []
const indicatorById = new Map(pantry.indicators.map((i) => [i.id, i]))
const seriesById = new Map(pantry.series.map((s) => [s.indicator, s]))

describe('the published bubble layouts', () => {
  it('exist for every indicator, one circle per municipality', () => {
    expect(layouts.map((l) => l.indicator)).toEqual(pantry.indicators.map((i) => i.id))
    for (const layout of layouts) {
      expect(layout.circles.map((c) => c.code).sort()).toEqual(
        pantry.municipalities.map((m) => m.code).sort(),
      )
    }
  })

  it.each(layouts.map((l) => [l.indicator, l] as const))(
    'leaves no municipality the arrow keys cannot reach: %s',
    (_id, layout) => {
      const stranded = strandedIn({
        neighbours: adjacency.neighbours,
        centroids: new Map(layout.circles.map((c) => [c.code, [c.x, c.y] as const])),
        coneCos: Math.cos((layout.cone * Math.PI) / 180),
      })
      expect(stranded).toEqual([])
    },
  )

  it.each(layouts.map((l) => [l.indicator, l] as const))(
    'has no two slots overlapping: %s',
    (_id, layout) => {
      const overlaps: string[] = []
      const cs = layout.circles
      for (let i = 0; i < cs.length; i++) {
        for (let j = i + 1; j < cs.length; j++) {
          const a = cs[i]!
          const b = cs[j]!
          // Published coordinates are rounded to two decimals, so allow that much.
          if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r - 0.02)
            overlaps.push(`${a.code}/${b.code}`)
        }
      }
      expect(overlaps).toEqual([])
    },
  )

  it.each(layouts.map((l) => [l.indicator, l] as const))(
    'holds every year’s bubble inside its slot: %s',
    (id, layout) => {
      // The promise the site relies on: sizing from the same published values with the same
      // shared rule never produces a radius above the slot the kitchen reserved.
      const indicator = indicatorById.get(id)!
      const series = seriesById.get(id)!
      const slot = new Map(layout.circles.map((c) => [c.code, c.r]))
      const sizing = { minR: layout.minR, maxR: layout.maxR }
      for (let col = 0; col < series.years.length; col++) {
        const norms = sizeNorms(
          pantry.municipalities.map((_, row) => series.values[row]?.[col] ?? null),
          indicator.scale.kind,
        )
        norms.forEach((n, row) => {
          const code = pantry.municipalities[row]!.code
          expect(radiusFor(n, sizing), `${id} ${code} ${series.years[col]}`).toBeLessThanOrEqual(
            slot.get(code)! + 1e-9,
          )
        })
      }
    },
  )

  it.each(layouts.map((l) => [l.indicator, l] as const))(
    'spends the area budget and no more: %s',
    (_id, layout) => {
      const area = layout.circles.reduce((a, c) => a + Math.PI * c.r * c.r, 0)
      const budget = AREA_BUDGET * LAYOUT_SCALE * LAYOUT_SCALE
      // Slots round up by at most a hundredth each, which is well under one per cent of area.
      expect(area).toBeLessThanOrEqual(budget * 1.01)
      expect(area).toBeGreaterThanOrEqual(budget * 0.98)
      expect(layout.minR).toBe(MIN_R)
    },
  )

  it('keeps the country recognisable: no layout drifts far from the geography', () => {
    // The first prototype, without the area budget, drifted 300–460 units from the centroids
    // and lost the shape of the country entirely. Every published layout stays under 30.
    const population = layouts.find((l) => l.indicator === 'population')!
    const home = new Map(population.circles.map((c) => [c.code, c]))
    for (const layout of layouts) {
      // Measured against the population layout rather than the raw centroids, which the
      // published pantry does not carry: both are within a few units of geography, so a layout
      // far from one is far from the other.
      const drift =
        layout.circles.reduce((a, c) => {
          const h = home.get(c.code)!
          return a + Math.hypot(c.x - h.x, c.y - h.y)
        }, 0) / layout.circles.length
      expect(drift, layout.indicator).toBeLessThan(50)
    }
  })
})
