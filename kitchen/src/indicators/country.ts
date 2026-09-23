import {
  Indicator,
  statusCode,
  type IndicatorSeries,
  type Municipality,
} from '../../../shared/pantry'
import { buildRows, type BuildContext, type IndicatorDefinition } from './registry'
// Read only inside the builder's body, never at this module's own top level — decision 0014 D4.
import { POPULATION } from './population'
import { SHARE_65_PLUS } from './derived'

/**
 * Question 30 of the question list, finally answered — and named for what it computes rather
 * than for what the question was called.
 *
 * The question list asked "Is this place ageing FASTER than the country?" and then gave the
 * formula "Share 65+ minus the national share, percentage points". Those are two different
 * questions: the title is about a rate of change, the formula is about a level. Only the
 * formula was ever specified, so the formula is what ships, and the id, the name and the caveat
 * all say "against the country" rather than "ageing faster". Naming it after the title would
 * have been the more appealing claim and the false one.
 *
 * ADR-0022 records why this is an indicator rather than the colour scale the fourth slice
 * imagined: a scale cannot put a figure anywhere, and the question asks for percentage points.
 */
export const SHARE_65_VS_COUNTRY: Indicator = Indicator.parse({
  id: 'share-65-plus-vs-country',
  name: {
    sv: 'Andel 65+ jämfört med riket',
    en: 'Share aged 65+ against the country',
  },
  description: {
    sv: 'Kommunens andel invånare som fyllt 65 minus rikets andel samma år, i procentenheter. Positivt tal betyder en äldre befolkning än riket.',
    en: 'The municipality’s share of residents aged 65 and over minus the country’s share the same year, in percentage points. A positive figure means an older population than Sweden as a whole.',
  },
  unit: 'percentage-points',
  priceBasis: 'none',
  scale: { kind: 'diverging', breaks: [] },
  // share-65-plus's own range, written out rather than read from it: a module-level read of
  // another indicator's constant races the import cycle (decision 0014 D4, and the defect plan
  // 16 hit with `NATURAL_YEARS = YEARS`). check.ts rule 7 would catch a drift between the two.
  coverage: { from: 1968, to: 2025 },
  caveat: {
    sv: 'Måttet svarar på om kommunen är ÄLDRE än riket, inte på om den åldras snabbare — det är en nivå, inte en förändringstakt, och en kommun kan ligga högt och samtidigt bli yngre. Rikets andel är befolkningsviktad: alla 65-plussare i landet delat med alla invånare, inte medelvärdet av 290 kommunandelar, som hade låtit Bjurholm väga lika tungt som Stockholm. Skillnaden anges i procentenheter, inte procent. Från 2025 är underlaget stördat av SCB:s Cell Key Method, precis som andel 65+ självt.',
    en: 'This answers whether the municipality is OLDER than the country, not whether it is ageing faster — it is a level, not a rate of change, and a place can sit high while getting younger. The national share is population-weighted: every resident aged 65 and over in Sweden over every resident, not the mean of 290 municipal shares, which would let Bjurholm weigh as much as Stockholm. The difference is in percentage points, not percent. From 2025 the underlying figures carry SCB’s Cell Key Method noise, exactly as share-65-plus does.',
  },
  sensitivity: 'none',
  sources: [],
  derivation: {
    sv:
      'share-65-plus minus rikets andel samma år. Rikets andel beräknas ur den här datamängdens ' +
      'egna två publicerade serier och inget annat: varje kommuns antal över 65 återskapas som ' +
      'share-65-plus gånger folkmängd, de antalen summeras över alla 290, och summan delas med ' +
      'den summerade folkmängden. Det är exakt snarare än en ny härledning, eftersom ' +
      'share-65-plus i sin tur beräknades ur samma folkmängdsserie — så täljare och nämnare kan ' +
      'inte i tysthet gå isär. Ingenting hämtas på nytt.',
    en:
      'share-65-plus minus the national share of the same year. The national share is computed ' +
      'from this pantry’s own two published series and nothing else: each municipality’s ' +
      'over-65 count is recovered as share-65-plus times population, those counts are summed ' +
      'across all 290, and the sum is divided by the summed population. That is exact rather ' +
      'than a re-derivation, because share-65-plus was itself computed from this same ' +
      'population series — so numerator and denominator cannot quietly disagree. Nothing is ' +
      'refetched.',
  },
})

/**
 * The population-weighted national share of residents aged 65 and over, per year.
 *
 * Exported so a test can check it against a figure derived a different way, rather than only
 * against the pipeline that produced it.
 *
 * A year contributes a municipality only when BOTH its share and its population are present:
 * a municipality that did not exist yet must not silently count as zero over-65s, which would
 * drag the national share down in exactly the early years where the fewest municipalities
 * report.
 */
export function nationalShare65(
  share: IndicatorSeries,
  population: IndicatorSeries,
  year: number,
): number | null {
  const shareCol = share.years.indexOf(year)
  const popCol = population.years.indexOf(year)
  if (shareCol === -1 || popCol === -1) return null
  let over65 = 0
  let residents = 0
  for (let row = 0; row < share.values.length; row++) {
    const s = share.values[row]?.[shareCol] ?? null
    const p = population.values[row]?.[popCol] ?? null
    if (s === null || p === null) continue
    over65 += (s / 100) * p
    residents += p
  }
  return residents === 0 ? null : (over65 / residents) * 100
}

export function buildShare65VsCountrySeries(
  municipalities: Municipality[],
  share: IndicatorSeries,
  population: IndicatorSeries,
): IndicatorSeries {
  const years = [...share.years]
  const national = new Map(years.map((y) => [y, nationalShare65(share, population, y)]))
  const colOf = new Map(share.years.map((y, i) => [y, i]))
  const rowOf = new Map(municipalities.map((m, i) => [m.code, i]))

  const cells = buildRows(municipalities, years, (m, y) => {
    const row = rowOf.get(m.code)
    const col = colOf.get(y)
    const own = row === undefined || col === undefined ? null : (share.values[row]?.[col] ?? null)
    const country = national.get(y) ?? null
    // The municipality's own absence is the one that matters here, and its reason is the one
    // worth carrying: a place that did not exist has no share to compare, and says so.
    if (own === null) {
      const inherited =
        row !== undefined && col !== undefined ? share.status[row]?.[col] : undefined
      return { v: null as number | null, s: inherited ?? statusCode('not-yet-published') }
    }
    if (country === null) return { v: null, s: statusCode('not-yet-published') }
    const perturbed =
      row !== undefined && col !== undefined && share.status[row]?.[col] === statusCode('perturbed')
    return { v: own - country, s: statusCode(perturbed ? 'perturbed' : 'present') }
  })

  return {
    indicator: SHARE_65_VS_COUNTRY.id,
    years,
    values: cells.map((r) => r.map((c) => c.v)),
    status: cells.map((r) => r.map((c) => c.s)),
  }
}

/**
 * ctx-reading wrapper REGISTRY calls. Hand-written rather than a builder, for the reason
 * [0014](../../../docs/decisions/0014-indicators-become-definitions.md) gives for
 * `population-change`: a generic "subtract this indicator's own national aggregate" builder
 * would have exactly one user.
 *
 * Reads both operands from ctx and refetches nothing, so it must come after both in REGISTRY.
 */
export async function buildShare65VsCountry(ctx: BuildContext): Promise<IndicatorSeries> {
  const share = ctx.series.get(SHARE_65_PLUS.id)
  const population = ctx.series.get(POPULATION.id)
  if (!share || !population) {
    throw new Error(
      `${SHARE_65_VS_COUNTRY.id}: needs both ${SHARE_65_PLUS.id} and ${POPULATION.id} already ` +
        'built — both must come before it in REGISTRY, since the national share is computed ' +
        'from the two of them',
    )
  }
  return buildShare65VsCountrySeries(ctx.municipalities, share, population)
}

export const share65VsCountryDefinition: IndicatorDefinition = {
  indicator: SHARE_65_VS_COUNTRY,
  build: buildShare65VsCountry,
}
