import { forceCollide, forceSimulation, forceX, forceY } from 'd3-force'
import { Bubbles } from '../../../shared/pantry'

type Node = { code: string; x: number; y: number; r: number; x0: number; y0: number }

/** Largest bubble radius as a fraction of the unit square's width. */
const MAX_R = 0.06

/**
 * Dorling cartogram: circles sized by sqrt(population), pushed apart, pulled gently home.
 * d3-force's default random source is a seeded LCG, so the layout is deterministic — but
 * determinism also depends on iterating in a fixed order, so nodes are sorted by code
 * before the simulation runs, the tick count is fixed (not stop-when-stable), and every
 * output coordinate is rounded, so running this twice gives byte-identical output.
 */
export function buildBubbles(
  centroids: Map<string, [number, number]>,
  population: Map<string, number>,
  year: number,
): Bubbles {
  const maxPop = Math.max(...population.values())
  const nodes: Node[] = [...centroids.entries()]
    // Plain structural comparison, not localeCompare: node order feeds the force simulation
    // below, so the sort must not depend on the running machine's ICU collation. Municipality
    // codes are ASCII digits, so no locale reorders them today — this is hardening a
    // determinism guarantee that should hold structurally, not a fix for an observed bug.
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([code, [x, y]]) => ({
      code,
      x,
      y,
      x0: x,
      y0: y,
      r: MAX_R * Math.sqrt((population.get(code) ?? 0) / maxPop),
    }))
  const sim = forceSimulation(nodes)
    .force('x', forceX<Node>((d) => d.x0).strength(0.05))
    .force('y', forceY<Node>((d) => d.y0).strength(0.05))
    .force('collide', forceCollide<Node>((d) => d.r + 0.002).iterations(3))
    .stop()
  for (let i = 0; i < 300; i++) sim.tick()
  return Bubbles.parse({
    schemaVersion: 1,
    basedOn: { indicator: 'population', year },
    circles: nodes.map((n) => ({
      code: n.code,
      x: Number(n.x.toFixed(5)),
      y: Number(n.y.toFixed(5)),
      r: Number(n.r.toFixed(5)),
    })),
  })
}
