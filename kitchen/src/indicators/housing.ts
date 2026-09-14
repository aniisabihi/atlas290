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
  values,
  type BuildContext,
  type IndicatorDefinition,
} from './registry'

export const HOUSING_TABLE = 'TAB1169'

/**
 * Housing's own year range: 1981-2025, per the plan's verified-facts table. Distinct from
 * population's 1968-2025 (`ctx.years`) — defined locally, exactly as every other indicator
 * (tax, density, migration, income) defines its own.
 */
export const HOUSING_YEARS = Array.from({ length: 2025 - 1981 + 1 }, (_, i) => 1981 + i)

/**
 * Swedish labels SCB uses for TAB1169's two needed content codes. Resolved by label rather than
 * hardcoded (BO0501C2/BO0501C1), per docs/decisions/0001-plan-1-build-decisions.md's trap 2 —
 * the same convention every indicator in this project uses. TAB1169 also carries two further
 * content codes this indicator does NOT use ("Bas-/taxeringsvärde, medelvärde i tkr" and
 * "Köpeskillingskoefficient"), which resolving by label — rather than by array position —
 * guards against picking by accident.
 */
const HOUSING_PRICE_LABEL = 'Köpeskilling, medelvärde i tkr'
const HOUSING_COUNT_LABEL = 'Antal'

/**
 * Swedish label for TAB1169's `Fastighetstyp` value that means "permanent home" — confirmed
 * against the table's own live frozen metadata (kitchen/raw/TAB1169/sv/metadata.json) on
 * 2026-09-14, NOT merely trusted from the brief that specified this task: `Fastighetstyp` has
 * exactly two values, `220` labelled "permanentbostad (ej tomträtt)" (permanent home, not
 * leasehold) and `221` labelled "fritidshus" (holiday home). The brief's assignment of 220 to
 * permanent homes was correct, but it is resolved here by this label at run time — exactly like
 * every ContentsCode in this project — rather than the code `220` being hardcoded and trusted
 * blind, so a future change to SCB's codelist would surface as a thrown error naming this label
 * rather than silently mapping the wrong property type onto the pantry. Selecting `221`
 * (holiday homes) instead would badly distort coastal and mountain municipalities where a large
 * share of sales are summer houses — the reason this indicator restricts to `220` at all.
 */
const PERMANENT_HOME_LABEL = 'permanentbostad (ej tomträtt)'

/**
 * Below this many sales in a municipality-year, the published mean price is nulled and the
 * cell marked 'too-few-cases' rather than shown, because a mean built on a handful of sales is
 * not a reliable municipal figure — one unusual property moves it entirely.
 *
 * Chosen by fetching the REAL sale-count distribution for Fastighetstyp=220 across all 290
 * municipalities and 1981-2025 (12,950 published municipality-year cells; 100 more are null
 * because the municipality did not yet exist) rather than picking a round number first:
 *
 *   min 2, p1 16, p5 32, p10 45, p25 74, median 125, p75 232, p90 389, p95 526, max 1,610.
 *
 * Candidate thresholds and what each would suppress (counted from the real data, not
 * estimated):
 *
 *   threshold  muni-years suppressed   % of 12,950   municipalities with >=1 suppressed year
 *   10         28                      0.22%         7 of 290
 *   15         99                      0.76%         12 of 290
 *   20         227                     1.75%         22 of 290
 *   25         384                     2.97%         34 of 290
 *   30         555                     4.29%         47 of 290
 *   50         1,608                   12.42%         95 of 290 (roughly a third of the map)
 *
 * 10 suppresses almost nothing (0.22%) and is not doing its job: municipalities with a
 * genuinely thin market (Solna, whose housing stock is overwhelmingly flats rather than the
 * "småhus" this table counts, and the sparsely populated inland municipalities of
 * Västerbotten/Norrbotten — Dorotea, Bjurholm, Sorsele, Malå, Överkalix, Arjeplog, Åsele,
 * Övertorneå, Pajala, Norsjö) would still show a mean built on 10-19 sales in many of their
 * years. 50 suppresses 12.42% of all cells and 95 of 290 municipalities (a third of the map) —
 * exactly the "too high" failure mode the task brief warned against.
 *
 * 20 is chosen: it suppresses a small, real share (1.75% of cells, 22 of 290 municipalities —
 * not a round number picked in advance, but the actual count at this threshold), and the
 * municipalities it flags form a recognisable, real pattern (the same handful of sparse
 * northern-inland municipalities plus Solna) rather than either "almost nobody" (10) or "a
 * third of every municipality" (50).
 */
export const HOUSING_MIN_COUNT = 20

export const HOUSING: Indicator = Indicator.parse({
  id: 'house-prices',
  name: { sv: 'Småhuspriser', en: 'House prices' },
  description: {
    sv: 'Medelvärdet av köpeskillingen för sålda småhus för permanentboende (Fastighetstyp 220, ej fritidshus), justerat till senaste årets penningvärde.',
    en: "Mean sale price of sold single-family homes for permanent residence (property type 220, excluding holiday homes), adjusted to the latest year's kronor.",
  },
  unit: 'sek',
  priceBasis: 'fixed-latest-year',
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: HOUSING_YEARS[0]!, to: HOUSING_YEARS[HOUSING_YEARS.length - 1]! },
  minCount: HOUSING_MIN_COUNT,
  caveat: {
    sv:
      'Avser permanentbostäder (Fastighetstyp 220), inte fritidshus (221), eftersom fritidshus ' +
      'skulle snedvrida kust- och fjällkommuner där en stor andel av försäljningarna är ' +
      'sommarstugor. Där antalet försäljningar en kommun och ett år understiger 20 döljs ' +
      'medelpriset och cellen märks "för få fall" i stället för att publicera ett medelvärde ' +
      'byggt på en handfull hus. Tröskeln 20 valdes genom att räkna den verkliga fördelningen av ' +
      'antal försäljningar (1981-2025, alla 290 kommuner): median 125, men så lågt som 2 i ' +
      'enstaka kommun-år. Vid tröskeln 20 döljs 227 av 12 950 publicerade kommun-år (1,75 ' +
      'procent), i 22 av 290 kommuner (7,6 procent) — främst glesbygdskommuner i Västerbottens ' +
      'och Norrbottens inland (Dorotea, Bjurholm, Sorsele, Malå, Överkalix, Arjeplog, Åsele, ' +
      'Övertorneå, Pajala, Norsjö) samt Solna, vars bostadsbestånd domineras av flerbostadshus ' +
      'snarare än småhus. Värdena är justerade till senaste årets penningvärde med SCB:s ' +
      'konsumentprisindex; nominella värden visas inte här.',
    en:
      'Covers permanent homes (property type 220), not holiday homes (221), because holiday ' +
      'homes would badly distort coastal and mountain municipalities where a large share of ' +
      'sales are summer houses. Where the number of sales in a municipality-year falls below ' +
      "20, the mean price is hidden and the cell marked 'too few cases' rather than publishing " +
      'a mean built on a handful of houses. The threshold of 20 was chosen by counting the ' +
      'real distribution of sale counts (1981-2025, all 290 municipalities): median 125, but as ' +
      'low as 2 in individual municipality-years. At the threshold of 20, 227 of 12,950 ' +
      'published municipality-years are hidden (1.75 percent), across 22 of 290 municipalities ' +
      '(7.6 percent) — mostly sparsely populated inland municipalities of Västerbotten and ' +
      'Norrbotten (Dorotea, Bjurholm, Sorsele, Malå, Överkalix, Arjeplog, Åsele, Övertorneå, ' +
      'Pajala, Norsjö) plus Solna, whose housing stock is dominated by flats rather than ' +
      "single-family homes. Values are adjusted to the latest year's kronor using SCB's " +
      'consumer price index; nominal values are not shown here.',
  },
  sensitivity: 'none',
  sources: [
    {
      table: HOUSING_TABLE,
      contentCode: 'BO0501C2',
      note: '1981–2025, Fastighetstyp 220 (permanent homes); mean sale price',
    },
    {
      table: HOUSING_TABLE,
      contentCode: 'BO0501C1',
      note: '1981–2025, Fastighetstyp 220 (permanent homes); sale count, used for the minimum-count rule',
    },
  ],
  derivation:
    'One SCB cell per municipality and year, at Fastighetstyp "220" (permanentbostad, ej ' +
    'tomträtt — resolved by its stable Swedish label, never the holiday-home code "221"): the ' +
    'mean-price content code ("Köpeskilling, medelvärde i tkr") and the sale-count content code ' +
    '("Antal"), both resolved by label rather than hardcoded. Where the sale count is below ' +
    "this indicator's minCount (20), the price is discarded and the cell marked " +
    "'too-few-cases' rather than published. Published prices are thousands of kronor (tkr); " +
    "multiplied by 1,000 here to store true kronor under this project's 'sek' unit, then " +
    "converted from that year's kronor to the latest covered year's kronor using the national " +
    'consumer price index (cpi.ts), never left as a nominal figure quietly presented as ' +
    'adjusted.',
})

/**
 * TAB1169's shared selection shape: only the region codes that are BOTH offered by this table
 * AND known current municipality codes (never a blind four-digit regex — the plan's trap 1),
 * at the permanent-home Fastighetstyp code (resolved by label, see PERMANENT_HOME_LABEL above),
 * for the given content code and years. `priceOrCountLabel` is HOUSING_PRICE_LABEL or
 * HOUSING_COUNT_LABEL, resolved by `housingPriceSelection`/`housingCountSelection` below —
 * kept as one private function so both selections share identical Region/Fastighetstyp logic
 * and cannot silently drift apart.
 */
function housingSelection(
  meta: TableMeta,
  municipalityCodes: string[],
  years: string[],
  contentLabel: string,
): Selection {
  const known = new Set(municipalityCodes)
  const fastighetstyp = variable(meta, 'Fastighetstyp')
  const permanentMatches = fastighetstyp.values.filter((x) => x.label === PERMANENT_HOME_LABEL)
  if (permanentMatches.length === 0) {
    throw new Error(
      `${meta.id}: no Fastighetstyp value labelled '${PERMANENT_HOME_LABEL}'; have ` +
        `${fastighetstyp.values.map((x) => `${x.code}=${x.label}`).join(', ')}`,
    )
  }
  if (permanentMatches.length > 1) {
    throw new Error(
      `${meta.id}: ${permanentMatches.length} Fastighetstyp values are labelled ` +
        `'${PERMANENT_HOME_LABEL}' (${permanentMatches.map((x) => x.code).join(', ')}) — ` +
        'ambiguous, pick one explicitly instead of silently taking the first',
    )
  }
  return {
    Region: values(meta, 'Region').filter((c) => known.has(c)),
    Fastighetstyp: [permanentMatches[0]!.code],
    ContentsCode: [resolveContentCode(meta, contentLabel)],
    Tid: years,
  }
}

function variable(meta: TableMeta, code: string) {
  const v = meta.variables.find((x) => x.code === code)
  if (!v) {
    throw new Error(
      `${meta.id}: no variable ${code}; have ${meta.variables.map((x) => x.code).join(', ')}`,
    )
  }
  return v
}

/** TAB1169's mean-price selection: Fastighetstyp 220, the price content code, given years. */
export function housingPriceSelection(
  meta: TableMeta,
  municipalityCodes: string[],
  years: string[],
): Selection {
  return housingSelection(meta, municipalityCodes, years, HOUSING_PRICE_LABEL)
}

/** TAB1169's sale-count selection: Fastighetstyp 220, the count content code, given years. */
export function housingCountSelection(
  meta: TableMeta,
  municipalityCodes: string[],
  years: string[],
): Selection {
  return housingSelection(meta, municipalityCodes, years, HOUSING_COUNT_LABEL)
}

/** Maps each fetched region+year cell to its value. Price and count are fetched as separate
 * selections (each with its own single ContentsCode), so a chunk passed here never mixes the
 * two under the same region+year key. */
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
 * Resolves the year every value is adjusted to. Same dedicated, distinctly-worded guard
 * income.ts's currentKronorTargetYear uses, for the same reason: an EMPTY cpi index would make
 * `Math.max(...cpiIndex.keys())` evaluate to `-Infinity`, and `toCurrentKronor` would then
 * throw "no entry for year -Infinity" — a message that happens to satisfy the same loose
 * `/no entry/` pattern the per-year-missing case also produces. Asserting THIS guard's own
 * wording ("CPI index has no entries at all") is what makes the two cases distinguishable.
 */
function currentKronorTargetYear(cpiIndex: Map<number, number>): number {
  if (cpiIndex.size === 0) {
    throw new Error(
      'house-prices: CPI index has no entries at all — cannot determine the latest year to ' +
        'adjust every value to',
    )
  }
  return Math.max(...cpiIndex.keys())
}

/**
 * House sales are a FLOW measured during calendar year Y using the administrative boundary
 * that actually applied during that year — the same kind of measure net migration is, NOT a
 * snapshot like population, tax rate, density or median income. This was verified directly
 * against the real frozen TAB1169 data for every one of the six municipality splits (not
 * assumed by analogy with migration.ts, and not called out by name in this task's own brief):
 *
 *   Gnesta   (0461, CREATED 1991): first real sale count is 1992, not 1991
 *   Trosa    (0488, CREATED 1991): first real sale count is 1992
 *   Bollebygd(1443, CREATED 1994): first real sale count is 1995
 *   Lekeberg (1814, CREATED 1994): first real sale count is 1995
 *   Nykvarn  (0140, CREATED 1998): first real sale count is 1999
 *   Knivsta  (0330, CREATED 2002): first real sale count is 2003
 *
 * every one exactly `CREATED[code] + 1` — the identical one-year-later shift migration.ts's own
 * `migrationExisted` documents, for the identical reason (a year-Y population row already
 * reflects 1 January year Y+1's boundary per TAB638's own note, but a year-Y SALE COUNT reflects
 * the boundary that actually existed during year Y itself). `existed(code, y)` — true a full
 * calendar year too early for this measure — must not gate housing directly;
 * `existed(code, y - 1)` is the same gate, shifted the one year housing (like migration) needs.
 */
function housingExisted(code: string, year: number): boolean {
  return existed(code, year - 1)
}

/**
 * Builds the columnar house-prices series. Rule per cell: `housingExisted` gates first,
 * discarding whatever SCB sent for a year before the municipality existed under this measure's
 * own (migration-shaped) convention; a missing fetched price or count is 'not-yet-published';
 * a fetched count below `minCount` nulls the value and marks 'too-few-cases' rather than
 * publishing a mean built on a handful of sales; otherwise the tkr figure is converted to whole
 * kronor and adjusted to `targetYear`'s kronor via `toCurrentKronor`, which throws (never
 * silently passes the nominal value through) if the CPI index lacks either year. No 'perturbed'
 * status is ever produced: TAB1169 carries no Cell Key Method note.
 */
export function buildHousingSeries(
  municipalities: Municipality[],
  priceChunks: FrozenData[],
  countChunks: FrozenData[],
  years: number[],
  cpiIndex: Map<number, number>,
  minCount: number = HOUSING_MIN_COUNT,
  targetYear: number = currentKronorTargetYear(cpiIndex),
): IndicatorSeries {
  const nominalTkr = valueByRegionYear(priceChunks)
  const counts = valueByRegionYear(countChunks)
  const cells = buildRows(municipalities, years, (m, y) => {
    if (!housingExisted(m.code, y)) {
      return { v: null as number | null, s: statusCode('did-not-exist') }
    }
    const key = `${m.code}|${y}`
    const tkr = nominalTkr.get(key) ?? null
    const count = counts.get(key) ?? null
    if (tkr === null || count === null) {
      return { v: null, s: statusCode('not-yet-published') }
    }
    if (count < minCount) {
      return { v: null, s: statusCode('too-few-cases') }
    }
    const kronor = tkr * 1000
    const adjusted = toCurrentKronor(kronor, y, cpiIndex, targetYear)
    return { v: adjusted, s: statusCode('present') }
  })
  return {
    indicator: HOUSING.id,
    years,
    values: cells.map((r) => r.map((c) => c.v)),
    status: cells.map((r) => r.map((c) => c.s)),
  }
}

export async function buildHousing(ctx: BuildContext): Promise<IndicatorSeries> {
  const meta = await freezeMetadata(HOUSING_TABLE, 'sv', ctx.freeze)
  const parsed = parseMetadata(HOUSING_TABLE, meta.response)
  const years = HOUSING_YEARS.map(String)
  const codes = ctx.municipalities.map((m) => m.code)

  const priceChunks = await freezeData(
    HOUSING_TABLE,
    housingPriceSelection(parsed, codes, years),
    'sv',
    ctx.freeze,
  )
  const countChunks = await freezeData(
    HOUSING_TABLE,
    housingCountSelection(parsed, codes, years),
    'sv',
    ctx.freeze,
  )

  // cpi.ts is deliberately independent of registry.ts (see its own module comment), so this
  // indicator calls it directly rather than reading ctx.cpi — that slot stays unpopulated
  // until Task 13 wires it, per the plan (same approach income.ts takes).
  const { index: cpiIndex, frozen: cpiFrozen } = await fetchCpi(ctx.freeze)

  const series = buildHousingSeries(
    ctx.municipalities,
    priceChunks,
    countChunks,
    HOUSING_YEARS,
    cpiIndex,
  )
  ctx.frozen.push(...priceChunks, ...countChunks, meta, ...cpiFrozen)
  return series
}

export const housingDefinition: IndicatorDefinition = { indicator: HOUSING, build: buildHousing }

/**
 * Standalone real-fetch entry point, mirroring population.ts's fetchPopulation, tax.ts's
 * fetchTax, density.ts's fetchDensity and income.ts's fetchIncome — used for the spot-check
 * run, independent of the shared REGISTRY singleton. Requires municipalities to already exist
 * (population's own responsibility).
 */
export async function fetchHousing(
  municipalities: Municipality[],
  opts: FreezeOpts = {},
): Promise<{ series: IndicatorSeries; frozen: Array<FrozenData | FrozenMeta> }> {
  const ctx: BuildContext = {
    municipalities,
    years: HOUSING_YEARS,
    freeze: opts,
    frozen: [],
    series: new Map(),
  }
  const series = await buildHousing(ctx)
  return { series, frozen: ctx.frozen }
}
