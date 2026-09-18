import { parseMetadata, type Selection, type TableMeta } from '../scb/client'
import {
  freezeData,
  freezeMetadata,
  type FreezeOpts,
  type FrozenData,
  type FrozenMeta,
} from '../scb/freeze'
import { toRows } from '../scb/jsonstat'
import { resolveContentCode, totalOrDeclaredSum, values } from './registry'

/**
 * How one dimension of a table is selected.
 *
 * - `'total'` — the dimension's own total code where it has one, and otherwise every value, but
 *   ONLY where `SUM_SAFE` declares that table and dimension verified. Anything else throws:
 *   summing an unverified set can overcount by a multiple, and a pipeline that guesses is worse
 *   than one that refuses.
 * - `{ values }` — an explicit list, for a range that is not a total: single ages 65 and over,
 *   for instance.
 * - `'all'` — every value, deliberately, where the whole set IS the thing wanted.
 */
export type DimRule = 'total' | 'all' | { values: readonly string[] }

/**
 * One SCB table, as an indicator declares it.
 *
 * `content` is the Swedish LABEL, never the code. The code varies by table and by era of the same
 * table while the label is stable — decision 0001's trap 2, and the convention every hand-written
 * indicator already follows.
 */
export type Source = {
  table: string
  content: string
  years: readonly number[]
  /** Every dimension beyond Region, ContentsCode and Tid. Omit where the table has none. */
  dims?: Readonly<Record<string, DimRule>>
}

/** What a resolved source yields: one value per `region|year`, and what was read to get it. */
export type ResolvedRows = {
  values: Map<string, number | null>
  frozen: Array<FrozenData | FrozenMeta>
}

/**
 * Builds the SCB selection a source describes.
 *
 * Region is always filtered to the 290 four-digit municipality codes, dropping the national and
 * county rows every one of these tables also carries — the one rule with no exception, which is
 * why it is here rather than in each definition.
 */
export function selectionFor(meta: TableMeta, source: Source): Selection {
  const selection: Selection = {
    Region: values(meta, 'Region').filter((c) => /^\d{4}$/.test(c)),
  }
  for (const [dim, rule] of Object.entries(source.dims ?? {})) {
    selection[dim] =
      rule === 'total'
        ? totalOrDeclaredSum(meta, dim)
        : rule === 'all'
          ? values(meta, dim)
          : [...rule.values]
  }
  selection['ContentsCode'] = [resolveContentCode(meta, source.content)]
  selection['Tid'] = source.years.map(String)
  return selection
}

/**
 * Sums a source's cells into one value per `region|year`.
 *
 * A dimension selected as a set — two sexes, four marital statuses, thirty-six single ages —
 * arrives as many rows sharing one key, and the value wanted is their sum. **Any missing part
 * makes the whole unknown**: a sum over cells one of which SCB did not publish is not a total,
 * it is a smaller number that looks like one. That rule is carried over unchanged from
 * `population.ts`, which established it.
 */
function sumByRegionYear(chunks: readonly FrozenData[]): Map<string, number | null> {
  const parts = new Map<string, { sum: number; sawNull: boolean }>()
  for (const chunk of chunks) {
    for (const row of toRows(chunk.response)) {
      const key = `${row.dims['Region']}|${row.dims['Tid']}`
      const entry = parts.get(key) ?? { sum: 0, sawNull: false }
      if (row.value === null) entry.sawNull = true
      else entry.sum += row.value
      parts.set(key, entry)
    }
  }
  const totals = new Map<string, number | null>()
  for (const [key, entry] of parts) totals.set(key, entry.sawNull ? null : entry.sum)
  return totals
}

/**
 * Reads every declared source and merges them into one map.
 *
 * Sources are merged in order and **a later source wins** a key both publish. That is the
 * stitching population, share-65-plus and net-migration-rate each do by hand today, where a newer
 * table continues an older one: the new table is listed last and its years take precedence.
 *
 * Summing happens strictly WITHIN a source. Two tables are never added together — they are
 * alternative publications of the same measure for different years, and adding them would double
 * any year they share.
 */
export async function resolveSources(
  sources: readonly Source[],
  freeze: FreezeOpts,
): Promise<ResolvedRows> {
  const merged = new Map<string, number | null>()
  const frozen: Array<FrozenData | FrozenMeta> = []

  // Data chunks first, then the metadata responses — the order ruling R2 established, kept so
  // the provenance manifest reads the same way it always has.
  const metas: FrozenMeta[] = []
  for (const source of sources) {
    const meta = await freezeMetadata(source.table, 'sv', freeze)
    const parsed = parseMetadata(source.table, meta.response)
    const chunks = await freezeData(source.table, selectionFor(parsed, source), 'sv', freeze)
    for (const [key, value] of sumByRegionYear(chunks)) merged.set(key, value)
    frozen.push(...chunks)
    metas.push(meta)
  }
  frozen.push(...metas)

  return { values: merged, frozen }
}
