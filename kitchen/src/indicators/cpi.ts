import { parseMetadata, type Selection, type TableMeta } from '../scb/client'
import {
  freezeData,
  freezeMetadata,
  type FreezeOpts,
  type FrozenData,
  type FrozenMeta,
} from '../scb/freeze'
import { toRows } from '../scb/jsonstat'
import { PriceIndex } from '../../../shared/pantry'

/**
 * National consumer price index (KPI), 1980 = 100. Unlike every other indicator in this
 * project, TAB4352 has NO `Region` dimension — it is one annual series for the whole
 * country, not 290 municipality series. That is why this module does not go through
 * `kitchen/src/indicators/registry.ts`'s municipality-mapping build path (`buildRows`,
 * `BuildContext.municipalities`, `IndicatorDefinition`): there is no per-municipality cell to
 * map onto here, so forcing this table through that path would mean inventing 290 identical
 * copies of one national number. `cpi.ts` is deliberately independent of `registry.ts` — it
 * is an INPUT the two money indicators (median income, house prices) call into during their
 * own registry `build()`, not a registry entry itself (Task 13 wires that call, per the plan;
 * `BuildContext.cpi` already exists as the unpopulated slot for it).
 *
 * This also sidesteps the circular-import hazard documented at the bottom of registry.ts:
 * that module already has to defer reading `populationDefinition` until first use because
 * publish.ts and Vitest resolve the population<->registry cycle from different sides. Adding
 * a second cross-module dependency (cpi.ts -> registry.ts, and, once Task 13 wires cpi into
 * the registry's build step, registry.ts -> cpi.ts) would recreate exactly that hazard one
 * level up. So the tiny amount of registry-shaped logic this module needs (resolving a
 * ContentsCode by its stable Swedish label, per docs/decisions/0001-plan-1-build-decisions.md's
 * "trap 2") is duplicated locally below rather than imported.
 */
export const CPI_TABLE = 'TAB4352'

/**
 * The year every money indicator is expressed in: the last year SCB's consumer price index
 * covers. Declared as a constant because the two money indicators must state it in their
 * published metadata, and that metadata is built when the module loads, long before any CPI
 * fetch has happened.
 *
 * It is NOT the same as either indicator's own last year — median income stops at 2024 and is
 * still expressed in 2025 kronor — so nothing downstream may infer it from `coverage.to`.
 *
 * `assertCpiLatestYear` re-checks it against the real fetched index on every build, so the day
 * SCB publishes 2026 the pipeline stops and says so, rather than silently labelling 2026 kronor
 * as 2025 ones.
 */
export const CPI_LATEST_YEAR = 2025

export function assertCpiLatestYear(year: number): number {
  if (year !== CPI_LATEST_YEAR) {
    throw new Error(
      `consumer price index now reaches ${year}, but CPI_LATEST_YEAR still says ` +
        `${CPI_LATEST_YEAR}. Every money value would be adjusted to ${year} kronor while the ` +
        `published metadata claimed ${CPI_LATEST_YEAR}. Update CPI_LATEST_YEAR in cpi.ts.`,
    )
  }
  return year
}

const CPI_CONTENT_LABEL = 'Index'

function variable(meta: TableMeta, code: string) {
  const v = meta.variables.find((x) => x.code === code)
  if (!v) {
    throw new Error(
      `${meta.id}: no variable ${code}; have ${meta.variables.map((x) => x.code).join(', ')}`,
    )
  }
  return v
}

/**
 * Resolves the ContentsCode carrying the given label from the table's own metadata, exactly
 * as registry.ts's resolveContentCode does (see the module comment above for why this is a
 * local copy rather than an import). Throws if no code, or more than one code, carries the
 * label — an ambiguous match must never be silently resolved by array order.
 */
function resolveContentCode(meta: TableMeta, label: string): string {
  const v = variable(meta, 'ContentsCode')
  const matches = v.values.filter((x) => x.label === label)
  if (matches.length === 0) {
    throw new Error(
      `${meta.id}: no ContentsCode labelled '${label}'; have ${v.values
        .map((x) => `${x.code}=${x.label}`)
        .join(', ')}`,
    )
  }
  if (matches.length > 1) {
    throw new Error(
      `${meta.id}: ${matches.length} ContentsCode values are labelled '${label}' ` +
        `(${matches.map((x) => x.code).join(', ')}) – ambiguous, pick one explicitly instead ` +
        `of silently taking the first`,
    )
  }
  return matches[0]!.code
}

/**
 * Fetches the whole TAB4352 series through the freeze layer (so it is cached in
 * kitchen/raw/ and every later run is offline) and returns it as a year -> index-value map,
 * plus every frozen chunk fetched, for the provenance manifest.
 */
/**
 * Turns the fetched index into the shape the pantry publishes, so the site can undo an
 * inflation adjustment without a second copy of every money figure.
 */
export function toPriceIndex(index: Map<number, number>): PriceIndex {
  return PriceIndex.parse({
    base: assertCpiLatestYear(Math.max(...index.keys())),
    values: Object.fromEntries([...index].map(([year, value]) => [String(year), value])),
  })
}

export async function fetchCpi(
  opts: FreezeOpts = {},
): Promise<{ index: Map<number, number>; frozen: Array<FrozenData | FrozenMeta> }> {
  const meta = await freezeMetadata(CPI_TABLE, 'sv', opts)
  const parsed = parseMetadata(CPI_TABLE, meta.response)
  const contentCode = resolveContentCode(parsed, CPI_CONTENT_LABEL)
  const years = variable(parsed, 'Tid').values.map((v) => v.code)

  // No Region key: TAB4352 does not have that dimension, unlike every other table this
  // project fetches.
  const sel: Selection = { ContentsCode: [contentCode], Tid: years }
  const chunks = await freezeData(CPI_TABLE, sel, 'sv', opts)

  const index = new Map<number, number>()
  for (const chunk of chunks) {
    for (const row of toRows(chunk.response)) {
      const year = Number(row.dims.Tid)
      // A null cell here would mean SCB has not yet published that year's average; leaving
      // it out of the map (rather than inserting a null or a 0) is what makes a missing year
      // surface later as toCurrentKronor's "no entry for year" throw, instead of silently
      // becoming a false index value of zero.
      if (row.value !== null) index.set(year, row.value)
    }
  }

  const frozen: Array<FrozenData | FrozenMeta> = [...chunks, meta]
  return { index, frozen }
}

/**
 * Converts `value`, denominated in `fromYear`'s kronor, into `targetYear`'s kronor using the
 * ratio of the two years' CPI index values. A missing entry for EITHER year throws, naming
 * that year — never silently falls back to the nominal value. That throw is the point of
 * this function: a nominal figure quietly presented as inflation-adjusted would be wrong by
 * however many years separate `fromYear` and `targetYear`, and it would be invisible on the
 * map, since the number would simply look plausible and be wrong.
 */
export function toCurrentKronor(
  value: number,
  fromYear: number,
  index: Map<number, number>,
  targetYear: number,
): number {
  const from = index.get(fromYear)
  if (from === undefined) {
    throw new Error(`toCurrentKronor: CPI index has no entry for year ${fromYear}`)
  }
  const to = index.get(targetYear)
  if (to === undefined) {
    throw new Error(`toCurrentKronor: CPI index has no entry for year ${targetYear}`)
  }
  return (value * to) / from
}
