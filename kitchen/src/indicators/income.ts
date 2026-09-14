import {
  Indicator,
  type IndicatorSeries,
  type Municipality,
  statusCode,
} from '../../../shared/pantry'
import { existed } from '../municipalities'
import { parseMetadata, type Selection, type TableMeta } from '../scb/client'
import {
  freezeData,
  freezeMetadata,
  type FreezeOpts,
  type FrozenData,
  type FrozenMeta,
} from '../scb/freeze'
import { fetchCpi, toCurrentKronor } from './cpi'
import { toRows } from '../scb/jsonstat'
import {
  buildRows,
  resolveContentCode,
  totalOrDeclaredSum,
  values,
  type BuildContext,
  type IndicatorDefinition,
} from './registry'

export const INCOME_TABLE = 'TAB3554'

/**
 * Income's own year range: 1999-2024, per the plan's verified-facts table. Distinct from
 * population's 1968-2025 (`ctx.years`) — defined locally, exactly as every other indicator
 * (tax, density, migration) defines its own, rather than borrowed from ctx.years by analogy.
 */
export const INCOME_YEARS = Array.from({ length: 2024 - 1999 + 1 }, (_, i) => 1999 + i)

/**
 * Swedish label SCB uses for the median (as opposed to mean) content code in TAB3554. Resolved
 * by label rather than hardcoded HE0110J8, per docs/decisions/0001-plan-1-build-decisions.md's
 * trap 2 — the same convention every indicator in this project uses, and the label the brief
 * for this task explicitly required resolving by rather than hardcoding.
 */
const INCOME_CONTENT_LABEL = 'Medianinkomst, tkr'

/**
 * ARCHITECT'S DECISION, recorded here rather than merely in the indicator's caveat below so a
 * future maintainer sees it at the point where it would be changed:
 *
 * TAB3554 covers people registered in the Swedish population register THE WHOLE YEAR, 1999
 * onwards. TAB3558 publishes the exact same median-income measure (content code HE0110K2,
 * confirmed against its own frozen metadata: same Region/Kon/Alder/Inkomstklass shape, same
 * 'tot16+' age total) for people registered on 31 December instead, reaching back to 1991 —
 * eight years further.
 *
 * The two populations are NOT the same and must never be mixed within one series: a
 * whole-year-resident figure and a 31-December figure for the same municipality and year can
 * legitimately differ, because the 31 December measure includes people who moved in or out
 * partway through the year. The architect chose TAB3554 (whole-year residents) over TAB3558
 * (31 December residents) specifically BECAUSE part-year residents make small and
 * student-heavy municipalities noisy, and this project cares more about comparability between
 * places than about eight extra years of history.
 *
 * Switching to TAB3558 is a one-line change: replace INCOME_TABLE's value with 'TAB3558',
 * replace INCOME_CONTENT_LABEL's content code lookup target if SCB's label ever differs
 * (unconfirmed — not needed while TAB3554 is in use), and widen INCOME_YEARS' start year to
 * 1991. Nothing else in this module depends on which of the two tables is selected.
 */

export const INCOME: Indicator = Indicator.parse({
  id: 'median-income',
  name: { sv: 'Medianinkomst', en: 'Median income' },
  description: {
    sv: 'Medianvärdet av den sammanräknade förvärvsinkomsten för personer 16 år och äldre, folkbokförda i Sverige hela året, justerat till senaste årets penningvärde.',
    en: "Median total earned income for people aged 16 and over, registered in Sweden's population the whole year, adjusted to the latest year's kronor.",
  },
  unit: 'sek',
  priceBasis: 'fixed-latest-year',
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: INCOME_YEARS[0]!, to: INCOME_YEARS[INCOME_YEARS.length - 1]! },
  caveat: {
    sv: 'Avser medianinkomst (sammanräknad förvärvsinkomst) för personer 16 år och äldre som var folkbokförda i Sverige hela året, inte per den 31 december. SCB publicerar samma mått för personer folkbokförda den 31 december i en annan tabell (TAB3558), som sträcker sig åtta år längre tillbaka (från 1991), men de två populationerna skiljer sig åt och blandas aldrig här: hela-året-populationen valdes eftersom den gör små och studenttäta kommuner mindre brusiga, vilket väger tyngre i denna databas än ett längre tidsspann. Medianer summeras aldrig. Värdena är justerade till senaste årets penningvärde med SCB:s konsumentprisindex; nominella värden visas inte här.',
    en: "Median income (total earned income) for people aged 16 and over who were registered in Sweden's population the whole year, not as of 31 December. SCB publishes the same measure for people registered on 31 December in a different table (TAB3558), reaching eight years further back (from 1991), but the two populations differ and are never mixed here: the whole-year population was chosen because it makes small and student-heavy municipalities less noisy, which matters more in this dataset than a longer time span. Medians are never summed. Values are adjusted to the latest year's kronor using SCB's consumer price index; nominal values are not shown here.",
  },
  sensitivity: 'none',
  sources: [{ table: INCOME_TABLE, contentCode: 'HE0110J8', note: '1999–2024' }],
  derivation:
    'One SCB total cell per municipality and year: the median-income content code ' +
    '("Medianinkomst, tkr"), resolved by its stable Swedish label rather than a hardcoded ' +
    'code, at the age total "tot16+" (16 and over — the only age total this table carries; ' +
    'the per-single-year-of-age table TAB3556 has none, and medians cannot be summed, which ' +
    'is why TAB3554 rather than TAB3556 is the source here), the sex total "1+2" and the ' +
    'income-class total "TOT" (every income bracket, including people with no income). ' +
    'Published figures are thousands of kronor (tkr); multiplied by 1,000 here to store true ' +
    "kronor under this project's 'sek' unit, then converted from that year's kronor to the " +
    "latest covered year's kronor using the national consumer price index (cpi.ts), never " +
    'left as a nominal figure quietly presented as adjusted.',
})

/**
 * TAB3554's selection: only the region codes that are BOTH offered by this table AND known
 * current municipality codes (never a blind four-digit regex — the plan's trap 1 verified
 * live on TAB1212/TAB6640 for Stor-Stockholm/Göteborg/Malmö's four-digit codes 0010/0020/0030).
 * Checked specifically for TAB3554 while building this indicator (its own frozen metadata,
 * 2026-09-14): of 312 Region entries, exactly 290 are four-digit, and all 290 are real,
 * current municipality codes — TAB3554 does NOT carry the phantom Stor-Stockholm-shaped
 * four-digit codes TAB1212 and TAB6640 do. The known-code join is still used here rather than a bare
 * `/^\d{4}$/` regex, both as the project's default convention and as a safety margin should
 * SCB ever add such a code to this table later.
 */
export function incomeSelection(
  meta: TableMeta,
  municipalityCodes: string[],
  years: string[],
): Selection {
  const known = new Set(municipalityCodes)
  return {
    Region: values(meta, 'Region').filter((c) => known.has(c)),
    Kon: totalOrDeclaredSum(meta, 'Kon'),
    Alder: totalOrDeclaredSum(meta, 'Alder'),
    Inkomstklass: totalOrDeclaredSum(meta, 'Inkomstklass'),
    ContentsCode: [resolveContentCode(meta, INCOME_CONTENT_LABEL)],
    Tid: years,
  }
}

/** Maps each fetched region+year cell to its nominal (still tkr) value. */
function valueByRegionYear(chunks: FrozenData[]): Map<string, number | null> {
  const map = new Map<string, number | null>()
  for (const chunk of chunks) {
    for (const r of toRows(chunk.response)) {
      map.set(`${r.dims.Region}|${r.dims.Tid}`, r.value)
    }
  }
  return map
}

/**
 * Resolves the year every value is adjusted to. A dedicated, named guard rather than trusting
 * `toCurrentKronor`'s own per-year throw to cover this case: an EMPTY cpi index would make
 * `Math.max(...cpiIndex.keys())` evaluate to `-Infinity`, and `toCurrentKronor` would then
 * throw "no entry for year -Infinity" — a message that happens to satisfy the same loose
 * `/no entry/` pattern the per-year-missing case also produces, which would let a broken (or
 * deleted) empty-index guard hide behind the OTHER guard's wording. Asserting this guard's own,
 * differently-worded message (`income.test.ts`'s "CPI index is empty" test) is what makes the
 * two cases distinguishable, and was confirmed by temporarily deleting this function's body and
 * watching that specific test go red while the per-year test kept passing.
 */
function currentKronorTargetYear(cpiIndex: Map<number, number>): number {
  if (cpiIndex.size === 0) {
    throw new Error(
      'median-income: CPI index has no entries at all — cannot determine the latest year to ' +
        'adjust every value to',
    )
  }
  return Math.max(...cpiIndex.keys())
}

/**
 * Builds the columnar median-income series. Same existence gate as tax rate and density
 * (`existed(m.code, y)`, no additional shift): unlike net migration, which is a FLOW measured
 * during calendar year Y and therefore needs its own one-year-later gate
 * (`migration.ts`'s `migrationExisted`), median income — like population, tax rate and
 * density — is a measure taken AS OF a given year under the administrative division SCB
 * already applies to that year's row, so population's own `existed()` is the right gate with
 * no adjustment (confirmed against the real Knivsta figures below, once fetched).
 *
 * Rule per cell: `existed` gates first, discarding whatever SCB sent (SCB sends literal 0, not
 * null, before a municipality exists, ruling R16); a missing fetched cell is
 * 'not-yet-published'; otherwise the tkr figure is converted to whole kronor and adjusted to
 * `targetYear`'s kronor via `toCurrentKronor`, which throws (never silently passes the nominal
 * value through) if the CPI index lacks either year. No 'perturbed' status is ever produced:
 * TAB3554 carries no Cell Key Method note, unlike population and density.
 */
export function buildIncomeSeries(
  municipalities: Municipality[],
  chunks: FrozenData[],
  years: number[],
  cpiIndex: Map<number, number>,
  targetYear: number = currentKronorTargetYear(cpiIndex),
): IndicatorSeries {
  const nominalTkr = valueByRegionYear(chunks)
  const cells = buildRows(municipalities, years, (m, y) => {
    if (!existed(m.code, y)) {
      return { v: null as number | null, s: statusCode('did-not-exist') }
    }
    const tkr = nominalTkr.get(`${m.code}|${y}`) ?? null
    if (tkr === null) {
      return { v: null, s: statusCode('not-yet-published') }
    }
    const kronor = tkr * 1000
    const adjusted = toCurrentKronor(kronor, y, cpiIndex, targetYear)
    return { v: adjusted, s: statusCode('present') }
  })
  return {
    indicator: INCOME.id,
    years,
    values: cells.map((r) => r.map((c) => c.v)),
    status: cells.map((r) => r.map((c) => c.s)),
  }
}

export async function buildIncome(ctx: BuildContext): Promise<IndicatorSeries> {
  const meta = await freezeMetadata(INCOME_TABLE, 'sv', ctx.freeze)
  const parsed = parseMetadata(INCOME_TABLE, meta.response)
  const years = INCOME_YEARS.map(String)
  const codes = ctx.municipalities.map((m) => m.code)
  const chunks = await freezeData(
    INCOME_TABLE,
    incomeSelection(parsed, codes, years),
    'sv',
    ctx.freeze,
  )

  // cpi.ts is deliberately independent of registry.ts (see its own module comment), so this
  // indicator calls it directly rather than reading ctx.cpi — that slot stays unpopulated
  // until Task 13 wires it, per the plan.
  const { index: cpiIndex, frozen: cpiFrozen } = await fetchCpi(ctx.freeze)

  const series = buildIncomeSeries(ctx.municipalities, chunks, INCOME_YEARS, cpiIndex)
  ctx.frozen.push(...chunks, meta, ...cpiFrozen)
  return series
}

export const incomeDefinition: IndicatorDefinition = { indicator: INCOME, build: buildIncome }

/**
 * Standalone real-fetch entry point, mirroring population.ts's fetchPopulation, tax.ts's
 * fetchTax and density.ts's fetchDensity — used for the spot-check run, independent of the
 * shared REGISTRY singleton. Requires municipalities to already exist (population's own
 * responsibility).
 */
export async function fetchIncome(
  municipalities: Municipality[],
  opts: FreezeOpts = {},
): Promise<{ series: IndicatorSeries; frozen: Array<FrozenData | FrozenMeta> }> {
  const ctx: BuildContext = {
    municipalities,
    years: INCOME_YEARS,
    freeze: opts,
    frozen: [],
    series: new Map(),
  }
  const series = await buildIncome(ctx)
  return { series, frozen: ctx.frozen }
}
