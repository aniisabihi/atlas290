import { describe, expect, it } from 'vitest'
import { publishedPantry } from '../test/pantry'
import rawAdjacency from '../../public/pantry/geometry/adjacency.json'
import rawTopology from '../../public/pantry/geometry/municipalities.topo.json'
import type { MunicipalityTopology } from '../../shared/geometry'
import { shapesFor } from './geometry'
import { DIRECTIONS, step, type Direction, type NavContext } from './navigate'

const shapes = shapesFor(rawTopology as unknown as MunicipalityTopology)
const ctx: NavContext = {
  neighbours: (rawAdjacency as { neighbours: Record<string, string[]> }).neighbours,
  centroids: new Map(shapes.map((s) => [s.code, s.centroid])),
}
const name = new Map(publishedPantry.municipalities.map((m) => [m.code, m.name.sv]))
const codes = shapes.map((s) => s.code)

/** Real graph, real projected centroids. A four-node fixture cannot validate any of this. */
describe('step', () => {
  it('uses the curated ferry route for the direction it actually lies in', () => {
    // Gotland's only neighbour is Nynäshamn, added by hand in Plan 1 because that is the ferry
    // people actually take. It lies north, so Up uses it in preference to anything nearer.
    expect(step('0980', 'up', ctx)).toBe('0192')
    // West of Gotland is open sea until Öland, which is a real answer rather than a dead end.
    expect(step('0980', 'left', ctx)).toBe('0885')
    // East and south of Gotland there is nothing but the Baltic, and the map says so.
    expect(step('0980', 'right', ctx)).toBeNull()
    expect(step('0980', 'down', ctx)).toBeNull()
  })

  it('sends the four keys to four different places from a well-connected municipality', () => {
    // Stockholm: Solna, Huddinge, Ekerö and Lidingö. Two keys landing on the same municipality
    // is the failure mode of a wider cone, measured at 2.56 distinct keys per municipality for
    // a 90-degree one against 3.80 for this.
    const targets = DIRECTIONS.map((d) => step('0180', d, ctx))
    expect(targets).toEqual(['0184', '0126', '0125', '0186'])
  })

  it('gives a one-neighbour municipality real moves in the other directions', () => {
    // Höganäs borders only Helsingborg. Without the fallback, three of its four keys would do
    // nothing at all.
    expect(step('1284', 'down', ctx)).toBe('1283')
    const others = (['up', 'right'] as Direction[]).map((d) => step('1284', d, ctx))
    expect(others.filter(Boolean).length).toBeGreaterThan(0)
  })

  it('never moves to where it already is', () => {
    for (const code of codes) {
      for (const d of DIRECTIONS) expect(step(code, d, ctx)).not.toBe(code)
    }
  })

  it('only ever moves in the direction that was actually pressed', () => {
    // The single invariant that catches a sign error: "up" must reduce y, because the projected
    // frame puts north at a smaller y.
    const at = (c: string) => ctx.centroids.get(c)!
    for (const code of codes) {
      for (const d of DIRECTIONS) {
        const target = step(code, d, ctx)
        if (!target) continue
        const [fx, fy] = at(code)
        const [tx, ty] = at(target)
        const moved = { up: fy - ty, down: ty - fy, left: fx - tx, right: tx - fx }[d]
        expect(moved, `${name.get(code)} ${d} -> ${name.get(target)}`).toBeGreaterThan(0)
      }
    }
  })

  it('leaves no municipality that nothing can arrow onto', () => {
    // The guarantee this whole rule exists for. Restricted to the adjacency graph, six
    // municipalities sit permanently in a neighbour's shadow and a keyboard-only visitor can
    // never land on them; this asserts the fallback closes that hole for all 290.
    const reachable = new Set<string>()
    for (const code of codes) {
      for (const d of DIRECTIONS) {
        const target = step(code, d, ctx)
        if (target) reachable.add(target)
      }
    }
    const unreachable = codes.filter((c) => !reachable.has(c)).map((c) => name.get(c))
    expect(unreachable).toEqual([])
    expect(reachable.size).toBe(290)
  })

  it('leaves every municipality by at least one key, so nowhere is a dead end', () => {
    for (const code of codes) {
      const moves = DIRECTIONS.map((d) => step(code, d, ctx)).filter(Boolean)
      expect(moves.length, `${name.get(code)} has no move at all`).toBeGreaterThan(0)
    }
  })

  it('says nothing lies north of the northernmost municipality', () => {
    expect(step('2584', 'up', ctx)).toBeNull()
  })

  it('is deterministic', () => {
    for (const d of DIRECTIONS) expect(step('1280', d, ctx)).toBe(step('1280', d, ctx))
  })
})
