import { Indicator, type IndicatorSeries } from '../../../shared/pantry'
import { buildDefined, type Definition } from './define'
import { CPI_LATEST_YEAR, fetchCpi } from './cpi'
import { type BuildContext, type IndicatorDefinition } from './registry'
import { neutral } from './prose'

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
    en: 'Median total earned income for people aged 16 and over, registered in Sweden’s population the whole year, adjusted to the latest year’s kronor.',
  },
  unit: 'sek',
  priceBasis: 'fixed-latest-year',
  priceBasisYear: CPI_LATEST_YEAR,
  // SCB publishes median income as thousands of kronor to ONE decimal (184.6 tkr), so the
  // original lands on a 100 kr step, not a 1,000 kr one. Snapping to 1,000 recovers 797 of
  // 7,537 cells; snapping to 100 recovers all of them.
  publishedStep: 100,
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: INCOME_YEARS[0]!, to: INCOME_YEARS[INCOME_YEARS.length - 1]! },
  caveat: {
    sv: 'Avser medianinkomst (sammanräknad förvärvsinkomst) för personer 16 år och äldre som var folkbokförda i Sverige hela året, inte per den 31 december. SCB publicerar samma mått för personer folkbokförda den 31 december i en annan tabell (TAB3558), som sträcker sig åtta år längre tillbaka (från 1991), men de två populationerna skiljer sig åt och blandas aldrig här: hela-året-populationen valdes eftersom den gör små och studenttäta kommuner mindre brusiga, vilket väger tyngre i denna databas än ett längre tidsspann. Medianer summeras aldrig. Värdena är justerade till senaste årets penningvärde med SCB:s konsumentprisindex; nominella värden visas inte här.',
    en: 'Median income (total earned income) for people aged 16 and over who were registered in Sweden’s population the whole year, not as of 31 December. SCB publishes the same measure for people registered on 31 December in a different table (TAB3558), reaching eight years further back (from 1991), but the two populations differ and are never mixed here: the whole-year population was chosen because it makes small and student-heavy municipalities less noisy, which matters more in this dataset than a longer time span. Medians are never summed. Values are adjusted to the latest year’s kronor using SCB’s consumer price index; nominal values are not shown here.',
  },
  sensitivity: 'none',
  sources: [{ table: INCOME_TABLE, contentCode: 'HE0110J8', note: neutral('1999–2024') }],
  derivation: {
    sv:
      'En SCB-totalcell per kommun och år: innehållskoden för medianinkomst (”Medianinkomst, ' +
      'tkr”), utpekad genom sin stabila svenska etikett i stället för en hårdkodad kod, vid ' +
      'åldersaggregatet ”tot16+” (16 år och äldre — det enda åldersaggregat tabellen har; ' +
      'tabellen per ettårsålder, TAB3556, har inget, och medianer går inte att summera, vilket ' +
      'är skälet till att källan är TAB3554 och inte TAB3556), könstotalen ”1+2” och ' +
      'inkomstklasstotalen ”TOT” (alla inkomstklasser, även personer utan inkomst). Publicerade ' +
      'siffror är tusentals kronor (tkr); de multipliceras här med 1 000 för att lagras i hela ' +
      'kronor under projektets enhet ’sek’, och räknas sedan om från det årets kronor till det ' +
      'senaste täckta årets kronor med konsumentprisindex för hela landet (cpi.ts) — aldrig ' +
      'kvar som en nominell siffra som i tysthet presenteras som justerad.',
    en:
      'One SCB total cell per municipality and year: the median-income content code ' +
      '("Medianinkomst, tkr"), resolved by its stable Swedish label rather than a hardcoded ' +
      'code, at the age total "tot16+" (16 and over — the only age total this table carries; ' +
      'the per-single-year-of-age table TAB3556 has none, and medians cannot be summed, which ' +
      'is why TAB3554 rather than TAB3556 is the source here), the sex total "1+2" and the ' +
      'income-class total "TOT" (every income bracket, including people with no income). ' +
      'Published figures are thousands of kronor (tkr); multiplied by 1,000 here to store true ' +
      'kronor under this project’s ‘sek’ unit, then converted from that year’s kronor to the ' +
      'latest covered year’s kronor using the national consumer price index (cpi.ts), never ' +
      'left as a nominal figure quietly presented as adjusted.',
  },
})

export async function buildIncome(ctx: BuildContext): Promise<IndicatorSeries> {
  // cpi.ts is deliberately independent of registry.ts (see its own module comment), so this
  // indicator fetches the index itself and hands it to the shared builder through ctx.cpi rather
  // than relying on something upstream having filled that slot.
  const { index, frozen } = await fetchCpi(ctx.freeze)
  ctx.cpi = index
  const series = await buildDefined(incomeDefined(), ctx)
  ctx.frozen.push(...frozen)
  return series
}

/**
 * Median earned income, as a definition (Plan 14).
 *
 * SCB publishes it in thousands of kronor, so `scale: 1000` turns it into the whole kronor the
 * pantry stores, and the adjustment then expresses every year in the price index's own base year.
 * `regions: 'known'` because TAB3554 carries regions that are no longer municipalities, and this
 * indicator wants the 290 population established.
 */
export function incomeDefined(): Definition {
  return {
    indicator: INCOME,
    sources: [
      {
        table: INCOME_TABLE,
        content: INCOME_CONTENT_LABEL,
        years: INCOME_YEARS,
        dims: { Kon: 'total', Alder: 'total', Inkomstklass: 'total' },
        regions: 'known',
      },
    ],
    spec: { kind: 'direct' },
    modifiers: { scale: 1000, inflationAdjust: true },
  }
}

export const incomeDefinition: IndicatorDefinition = { indicator: INCOME, build: buildIncome }
