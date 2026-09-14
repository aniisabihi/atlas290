export type Direction = 'up' | 'down' | 'left' | 'right'

/** Screen coordinates: y grows downwards, so "up" is negative y. */
const VECTORS: Record<Direction, readonly [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
}

export const DIRECTIONS = Object.keys(VECTORS) as Direction[]

export type NavContext = {
  neighbours: Readonly<Record<string, readonly string[]>>
  centroids: ReadonlyMap<string, readonly [number, number]>
  /**
   * How wide a cone counts as "that way", in cosine. Defaults to the geographic map's measured
   * value; the cartogram supplies its own, because the right angle is a property of how the
   * shapes are arranged rather than a universal constant.
   */
  coneCos?: number
}

/**
 * Both cones are the same width and both prefer the nearest candidate, so the whole rule reads as
 * one sentence: the nearest municipality within the cone of the key pressed, preferring one that
 * shares a border.
 *
 * Those numbers were measured rather than chosen. Sweeping the neighbour cone over 45, 60, 75
 * and 90 degrees against both tie-breaks, on the real graph and real centroids:
 *
 *   cone  prefer      reachable  distinct keys per municipality
 *    45   nearest      290/290   3.80   <- shipped
 *    45   aligned      286/290   3.80
 *    60   nearest      290/290   3.28
 *    90   nearest      290/290   2.56
 *    90   aligned      285/290   3.61
 *
 * Preferring the best-aligned candidate strands four or five municipalities whatever the cone;
 * widening the cone restores coverage but collapses two keys onto one destination. 45 degrees
 * with the nearest candidate is the only setting that gets both.
 */
export const MAP_CONE_COS = Math.cos((45 * Math.PI) / 180)

/**
 * The bubble cartogram needs a slightly wider cone than the geographic map, and this is measured
 * rather than chosen. Sweeping the same rule over the Dorling layout:
 *
 *   cone  prefer      reachable   distinct keys
 *    45   nearest      289/290    3.88   <- strands Salem
 *    50   nearest      290/290    3.66   <- shipped
 *    60   nearest      289/290    3.32   <- strands Landskrona
 *    50   aligned      284/290    3.86
 *
 * Plan 3 proved every municipality is arrow-reachable on the geographic layout. That guarantee
 * does not survive moving every centroid, so it is re-established here rather than assumed —
 * `Cartogram.test.tsx` asserts it against the real bubble positions.
 */
export const CARTOGRAM_CONE_COS = Math.cos((50 * Math.PI) / 180)

type Candidate = { code: string; distance: number; cos: number }

/**
 * The best municipality in a cone around `direction`.
 *
 * `prefer: 'alignment'` takes the one closest to straight ahead, which is what makes four arrow
 * keys land on four different places from a municipality with many neighbours. `prefer:
 * 'distance'` takes the nearest, which is what a long-range fallback wants. Ties break on the
 * code, so the same press always does the same thing.
 */
function bestInCone(
  from: string,
  candidates: Iterable<string>,
  direction: Direction,
  minCos: number,
  centroids: NavContext['centroids'],
  prefer: 'alignment' | 'distance',
): string | null {
  const origin = centroids.get(from)
  if (!origin) return null
  const [dx, dy] = VECTORS[direction]
  let best: Candidate | null = null
  for (const code of candidates) {
    if (code === from) continue
    const point = centroids.get(code)
    if (!point) continue
    const vx = point[0] - origin[0]
    const vy = point[1] - origin[1]
    const distance = Math.hypot(vx, vy)
    if (distance === 0) continue
    const cos = (vx * dx + vy * dy) / distance
    if (cos < minCos) continue
    const next: Candidate = { code, distance, cos }
    if (best === null || beats(next, best, prefer)) best = next
  }
  return best?.code ?? null
}

function beats(a: Candidate, b: Candidate, prefer: 'alignment' | 'distance'): boolean {
  if (prefer === 'alignment') {
    if (a.cos !== b.cos) return a.cos > b.cos
    if (a.distance !== b.distance) return a.distance < b.distance
    return a.code < b.code
  }
  if (a.distance !== b.distance) return a.distance < b.distance
  return a.code < b.code
}

/**
 * Where an arrow key goes.
 *
 * A shared-border neighbour in that direction wins, which keeps Plan 1's curated island edges —
 * Gotland reaching the mainland by the real Nynäshamn ferry route — as the primary relation.
 *
 * When a direction has no neighbour, it falls back to the nearest municipality anywhere in the
 * same cone, and that fallback is not a nicety. Measured against the real graph, every rule
 * restricted to the adjacency graph alone leaves six municipalities that nothing can ever arrow
 * onto — Lidingö, Gnosjö, Höör, Ljusnarsberg, Nora and Orsa for a best-aligned rule, a different
 * six for a nearest-neighbour one. They are not dead ends; each can be left. They simply sit
 * permanently in some other municipality's shadow, so a keyboard-only visitor could never land
 * on them, which is the same defect as an island dead end wearing a different hat. With the
 * fallback all 290 are reachable, and `navigate.test.ts` asserts exactly that.
 *
 * Returns null when nothing at all lies that way, and the caller says so out loud rather than
 * moving somewhere the visitor did not ask for.
 */
export function step(from: string, direction: Direction, ctx: NavContext): string | null {
  const cone = ctx.coneCos ?? MAP_CONE_COS
  const neighbour = bestInCone(
    from,
    ctx.neighbours[from] ?? [],
    direction,
    cone,
    ctx.centroids,
    'distance',
  )
  if (neighbour) return neighbour
  return bestInCone(from, ctx.centroids.keys(), direction, cone, ctx.centroids, 'distance')
}
