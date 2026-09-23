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
        `(${matches.map((v) => v.code).join(', ')}) – ambiguous, pick one explicitly instead ` +
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
  /**
   * The Swedish label of the content this source reads — or several labels, where one indicator
   * needs a numerator and a denominator that the table publishes as two content codes.
   *
   * Several only makes sense together with `groupBy: 'ContentsCode'`, which keys the resolved
   * rows by LABEL rather than by code. That is not a convenience: the three commuting tables
   * call the same measure `AM0207H9`, `AM0207C8` and `00000548`, so a share keyed by code could
   * not span the stitch, while the labels are identical across all three. Decision 0001's trap 2
   * — the code varies by table and by era, the label is stable — applied to the one place that
   * had not needed it.
   */
  content: string | readonly string[]
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
  /**
   * A check this table's metadata must pass before any selection is built from it, for the
   * assumptions a dimension rule cannot express.
   *
   * A rule says WHICH codes to take. It cannot say what a code is expected to MEAN, and for one
   * dimension in this project that distinction is load-bearing: `post-secondary-education` picks
   * `UtbildningsNiva` levels 5, 6 and 7 because of what those levels are, which is a human
   * definition rather than something recoverable from the table. If SCB reassigned code 6, every
   * selection would still be valid and the published share would quietly mean something else.
   *
   * Runs before the selection, so a codelist drift fails loudly rather than being fetched under.
   */
  verify?: (meta: TableMeta) => void
  /**
   * Subtract this source's values from what the earlier sources left, instead of replacing them.
   *
   * `natural-change-rate` is births minus deaths: the two birth tables resolve normally, stitched
   * by year, and the two death tables subtract. The rate is then the `ratio` builder that already
   * exists, over a numerator that is already the difference — no new arithmetic in the builder.
   *
   * A subtraction with nothing before it yields null rather than a negative number, because
   * "deaths, with no births figure to set them against" is not a natural change of minus that
   * many.
   */
  subtract?: boolean
  /**
   * Maps the year this indicator publishes under to the `Tid` code SCB keys the table by.
   *
   * Two tables do not key by year at all. Life expectancy is published for five-year windows
   * (`1998-2002`) and councillors by mandate period (`2023-2026`), and `IndicatorSeries.years`
   * is a list of integers. Rather than widen the contract, each period is pinned to one
   * representative year and this says which code that year asks for — the fifth slice design's
   * D6, and the reason those indicators' caveats have to say what the year means.
   */
  period?: (year: number) => string
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
  source.verify?.(meta)
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
  const contents = typeof source.content === 'string' ? [source.content] : source.content
  selection['ContentsCode'] = contents.map((label) => resolveContentCode(meta, label))
  selection['Tid'] = source.years.map((y) => (source.period ? source.period(y) : String(y)))
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
  groupBy: string | undefined,
  /** The published year a `Tid` code stands for, where the two differ (`Source.period`). */
  yearOf: (tid: string) => string,
  /** What a grouped dimension's value is called in the key — its label, for ContentsCode. */
  groupValue: (code: string) => string,
): Map<string, number | null> {
  const parts = new Map<string, { sum: number; sawNull: boolean }>()
  for (const chunk of chunks) {
    for (const row of toRows(chunk.response)) {
      const year = yearOf(row.dims['Tid'] ?? '')
      const key = groupBy
        ? `${row.dims['Region']}|${year}|${groupValue(row.dims[groupBy] ?? '')}`
        : `${row.dims['Region']}|${year}`
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
 * A source marked `subtract` is the exception: it is taken away from what came before rather than
 * replacing it, which is how `natural-change-rate` says births minus deaths without needing a
 * builder of its own.
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
    // A period-keyed table's rows come back keyed by the period code and are published under
    // the representative year, so the map back is built from this source's own declaration
    // rather than guessed from the code.
    const yearOfTid = source.period
      ? (() => {
          const byCode = new Map(source.years.map((y) => [source.period!(y), String(y)]))
          return (tid: string) => byCode.get(tid) ?? tid
        })()
      : (tid: string) => tid
    // Grouping by ContentsCode keys by the LABEL, the only identity stable across a stitch of
    // tables that use different codes for the same measure.
    const labelOfContent =
      groupBy === 'ContentsCode'
        ? (() => {
            const v = parsed.variables.find((x) => x.code === 'ContentsCode')
            const byCode = new Map((v?.values ?? []).map((x) => [x.code, x.label]))
            return (code: string) => byCode.get(code) ?? code
          })()
        : (code: string) => code

    for (const [key, value] of sumByRegionYear(chunks, groupBy, yearOfTid, labelOfContent)) {
      if (!source.subtract) {
        merged.set(key, value)
        continue
      }
      const before = merged.get(key)
      // Either side unknown makes the difference unknown: a subtraction from an absent figure is
      // not that figure negated, and a known figure minus an unknown one is not itself.
      merged.set(
        key,
        before === undefined || before === null || value === null ? null : before - value,
      )
    }
    frozen.push(...chunks)
    metas.push(meta)
  }
  frozen.push(...metas)

  return { values: merged, frozen }
}
