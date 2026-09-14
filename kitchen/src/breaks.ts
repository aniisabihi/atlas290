import { CREATED, SPLIT_PARENT } from './municipalities'

/**
 * Which convention decides the year a parent's drop appears, per docs/decisions/
 * 0001-plan-1-build-decisions.md and the real-data verification documented on
 * `computeParentBreakYears` below:
 *
 * - 'snapshot': population, tax rate, density, median income, education. A year-Y row
 *   already reflects the administrative division of 1 January year Y+1 (TAB638's own
 *   dataset note), so the child's first real cell — and the parent's matching drop — land
 *   in year `CREATED[child]` itself. This is `existed(code, y)`'s own crossing point.
 * - 'flow': net migration, house sales. These measure something that happened DURING
 *   calendar year Y under the boundary that actually applied that year, one calendar year
 *   later than the snapshot convention (migration.ts's `migrationExisted` and housing.ts's
 *   `housingExisted` both encode this as `existed(code, y - 1)`), so the break lands in
 *   `CREATED[child] + 1`.
 */
export type SourceKind = 'snapshot' | 'flow'

/**
 * Maps each PARENT municipality code to the distinct year(s) in which one or more of its
 * children's split first shows up as a drop, under the given source convention.
 *
 * Takes `splitParent`/`created` as parameters (rather than reading `SPLIT_PARENT`/`CREATED`
 * directly) so both structural cases this must handle can be exercised without relying on
 * SPLIT_PARENT happening to contain them:
 *
 *   - a parent losing TWO children in the SAME year collapses to ONE break year, not two —
 *     this is the case that actually occurs among the six real splits: Nyköping (0480)
 *     loses both Gnesta (0461) and Trosa (0488) in 1991. Verified against real TAB638 data
 *     (kitchen/spikes/verify-split-years.ts, rerun 2026-09-14 against frozen data, no
 *     network call): Nyköping's population drops from 65,908 (1990) to 47,754 (1991) — a
 *     single drop of 18,154, not two separate drops of ~9,000 or ~13,000 each. Reusing the
 *     same population.ts fixture also present in kitchen/src/indicators/population.test.ts
 *     shows Uppsala's matching case: 191,110 (2001) to 179,673 (2002), a single drop of
 *     11,437 for Knivsta.
 *   - a parent losing children in DIFFERENT years keeps every distinct year. No real split
 *     produces this (each of the five parents here loses its child(ren) in exactly one
 *     year), so it is exercised only with a synthetic map in breaks.test.ts — the structure
 *     must not assume "one parent, one child, one year" just because that happens to be true
 *     five times out of five.
 *
 * Throws, naming the child code, if `splitParent` names a child `created` has no entry for —
 * silently skipping it would mean a real split goes unflagged with nothing failing.
 */
export function computeParentBreakYears(
  splitParent: Record<string, string>,
  created: Record<string, number>,
  kind: SourceKind,
): Map<string, number[]> {
  const shift = kind === 'flow' ? 1 : 0
  const byParent = new Map<string, Set<number>>()
  for (const [child, parent] of Object.entries(splitParent)) {
    const createdYear = created[child]
    if (createdYear === undefined) {
      throw new Error(
        `breaks: no CREATED year for child '${child}' (parent '${parent}') — cannot ` +
          `determine its break year`,
      )
    }
    const breakYear = createdYear + shift
    const years = byParent.get(parent) ?? new Set<number>()
    years.add(breakYear)
    byParent.set(parent, years)
  }
  const result = new Map<string, number[]>()
  for (const [parent, years] of byParent) {
    result.set(
      parent,
      [...years].sort((a, b) => a - b),
    )
  }
  return result
}

/**
 * `computeParentBreakYears` against the real registry (`SPLIT_PARENT`/`CREATED` from
 * kitchen/src/municipalities.ts) — what every real caller uses. Recomputed on every call
 * rather than cached: the six-entry input is trivial to walk and this avoids any question of
 * whether a cached result could go stale relative to the (append-only, code-reviewed) source
 * constants.
 */
export function parentBreakYears(kind: SourceKind = 'snapshot'): Map<string, number[]> {
  return computeParentBreakYears(SPLIT_PARENT, CREATED, kind)
}

/**
 * True when `code` is a parent municipality and `year` is one of its real structural-break
 * years under the given convention — the signal a derived CHANGE indicator (population
 * change, Task 10) uses to null a cell rather than publish a boundary redraw as if it were
 * people moving. Only ever true for the PARENT's own code: a child's first real year is a
 * genuine, correct appearance of a new municipality, not a break to flag.
 */
export function isStructuralBreak(
  code: string,
  year: number,
  kind: SourceKind = 'snapshot',
): boolean {
  return parentBreakYears(kind).get(code)?.includes(year) ?? false
}
