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
 * - `{ singleFrom, alsoInclude }` — every SINGLE year of age from that number up, plus the named
 *   open-ended top band.
 *
 *   The two halves are both load-bearing. `singleFrom` matches only purely numeric codes,
 *   because TAB5557's age dimension also carries aggregate bands — `65-69`, `70-74`, `90-99` —
 *   and a rule that swept those in alongside the single ages would count the same people twice.
 *   A first version of this rule matched "leading digits at least 65" and did exactly that; it
 *   was caught by the frozen-response layer, which refused a selection nobody had ever fetched.
 *
 *   The top band is named per source rather than pattern-matched, because the tables genuinely
 *   disagree about what to call it — `100+` on TAB638 and `100+1` on TAB5557 — and that
 *   disagreement is data, not something to be clever about.
 * - `{ label }` — the one value carrying that Swedish label. The same principle content codes
 *   already follow: the code varies by table and by era, the label is stable. Refuses a label no
 *   value carries, and refuses one several carry, rather than taking the first.
 */
export type DimRule =
  | 'total'
  | 'all'
  | { values: readonly string[] }
  | { label: string }
  | { singleFrom: number; alsoInclude?: readonly string[] }

/** Resolves a dimension VALUE by its label, with the guards `resolveContentCode` applies. */
function valueByLabel(meta: TableMeta, dim: string, label: string): string {
  const variable = meta.variables.find((v) => v.code === dim)
  if (!variable) {
    throw new Error(
      `${meta.id}: no dimension ${dim}; have ${meta.variables.map((v) => v.code).join(', ')}`,
    )
  }
  const matches = variable.values.filter((v) => v.label === label)
  if (matches.length === 0) {
    throw new Error(
      `${meta.id}: no ${dim} value labelled '${label}'; have ` +
        `${variable.values.map((v) => `${v.code}=${v.label}`).join(', ')}`,
    )
  }
  if (matches.length > 1) {
    throw new Error(
      `${meta.id}: ${matches.length} ${dim} values are labelled '${label}' ` +
        `(${matches.map((v) => v.code).join(', ')}) — ambiguous, pick one explicitly instead ` +
        'of silently taking the first',
    )
  }
  return matches[0]!.code
}

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
  /**
   * Which regions to ask for.
   *
   * `'four-digit'` takes every region whose code looks like a municipality, dropping the country
   * and the counties these tables also carry. `'known'` intersects that with the 290 codes
   * population established, which is what an indicator wants when its table carries regions that
   * are no longer municipalities.
   *
   * The difference is already real in the hand-written modules; declaring it makes it visible.
   */
  regions?: 'four-digit' | 'known'
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
export function selectionFor(
  meta: TableMeta,
  source: Source,
  knownCodes?: readonly string[],
): Selection {
  const known = new Set(knownCodes ?? [])
  const wanted =
    source.regions === 'known'
      ? (code: string) => known.has(code)
      : (code: string) => /^\d{4}$/.test(code)
  const selection: Selection = { Region: values(meta, 'Region').filter(wanted) }
  for (const [dim, rule] of Object.entries(source.dims ?? {})) {
    selection[dim] =
      rule === 'total'
        ? totalOrDeclaredSum(meta, dim)
        : rule === 'all'
          ? values(meta, dim)
          : 'label' in rule
            ? [valueByLabel(meta, dim, rule.label)]
            : 'singleFrom' in rule
              ? values(meta, dim).filter(
                  (code) =>
                    (/^\d+$/.test(code) && Number(code) >= rule.singleFrom) ||
                    (rule.alsoInclude ?? []).includes(code),
                )
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
function sumByRegionYear(
  chunks: readonly FrozenData[],
  groupBy?: string,
): Map<string, number | null> {
  const parts = new Map<string, { sum: number; sawNull: boolean }>()
  for (const chunk of chunks) {
    for (const row of toRows(chunk.response)) {
      const key = groupBy
        ? `${row.dims['Region']}|${row.dims['Tid']}|${row.dims[groupBy]}`
        : `${row.dims['Region']}|${row.dims['Tid']}`
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
  knownCodes?: readonly string[],
  /**
   * Keep one dimension's breakdown instead of summing it away, keying by
   * `region|year|value`.
   *
   * Education needs it: its share is one fetch of every education level, of which some are the
   * numerator and all are the denominator. Fetching numerator and denominator as two selections
   * would be two different requests, and only one of them is frozen.
   */
  groupBy?: string,
): Promise<ResolvedRows> {
  const merged = new Map<string, number | null>()
  const frozen: Array<FrozenData | FrozenMeta> = []

  // Data chunks first, then the metadata responses — the order ruling R2 established, kept so
  // the provenance manifest reads the same way it always has.
  const metas: FrozenMeta[] = []
  for (const source of sources) {
    const meta = await freezeMetadata(source.table, 'sv', freeze)
    const parsed = parseMetadata(source.table, meta.response)
    const chunks = await freezeData(
      source.table,
      selectionFor(parsed, source, knownCodes),
      'sv',
      freeze,
    )
    for (const [key, value] of sumByRegionYear(chunks, groupBy)) merged.set(key, value)
    frozen.push(...chunks)
    metas.push(meta)
  }
  frozen.push(...metas)

  return { values: merged, frozen }
}
