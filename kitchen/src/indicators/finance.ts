import { Indicator } from '../../../shared/pantry'
import { CPI_LATEST_YEAR, fetchCpi } from './cpi'
import { buildDefined, type Definition } from './define'
import { type BuildContext, type IndicatorDefinition } from './registry'
import type { IndicatorSeries } from '../../../shared/pantry'
import { neutral } from './prose'

export const TAX_BASE_TABLE = 'TAB3600'
export const DISPOSABLE_TABLE = 'TAB1492'

/**
 * Taxable income per resident stops at the price index, not at the table.
 *
 * TAB3600 publishes 1995–2026: like the tax rate, next year's figure is decided in advance. But
 * this is money, and every money series in this pantry is expressed in one year's kronor. The
 * consumer price index reaches 2025 (`CPI_LATEST_YEAR`), so 2026 cannot be expressed in the same
 * kronor as the rest of the series.
 *
 * Publishing it unadjusted would put one nominal figure at the end of thirty adjusted ones, with
 * nothing on the page to say which was which — the exact failure `inflationAdjust` throws to
 * prevent. The year is left out instead, and the caveat says it exists.
 */
export const TAX_BASE_YEARS = Array.from({ length: CPI_LATEST_YEAR - 1995 + 1 }, (_, i) => 1995 + i)

/** TAB1492's own range, read off its frozen metadata: 2011..2024. */
export const DISPOSABLE_YEARS = Array.from({ length: 2024 - 2011 + 1 }, (_, i) => 2011 + i)

const TAX_BASE_CONTENT_LABEL = 'Skattekraft, kronor per invånare'
const DISPOSABLE_CONTENT_LABEL = 'Medianvärde, tkr'

/** TAB1492's household-type code for every household, rather than one family shape. */
const ALL_HOUSEHOLDS = 'E90'
/** Its age band for every adult. `TOTAL_CODES` does not know this one; the table has no total. */
const ADULTS = '18+'

export const TAX_BASE: Indicator = Indicator.parse({
  id: 'taxable-income-per-resident',
  name: { sv: 'Skattekraft', en: 'Tax base per resident' },
  description: {
    sv: 'Kommunens beskattningsbara förvärvsinkomst per invånare — det underlag den kommunala skattesatsen tas ut på.',
    en: 'The municipality’s taxable earned income per resident — the base its tax rate is levied on.',
  },
  unit: 'sek',
  priceBasis: 'fixed-latest-year',
  priceBasisYear: CPI_LATEST_YEAR,
  // TAB3600 publishes skattekraft in whole kronor — Stockholm 2024 reads 329390, Borgholm
  // 212862 — so the step that recovers the published figure from the adjusted one is 1.
  publishedStep: 1,
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: TAX_BASE_YEARS[0]!, to: TAX_BASE_YEARS[TAX_BASE_YEARS.length - 1]! },
  caveat: {
    sv: 'Uttryckt i det senaste årets kronor med konsumentprisindex, så att år kan jämföras med år. TAB3600 publicerar även 2026, men prisindexet når bara till 2025; den nominella siffran för 2026 utelämnas hellre än att läggas sist i en i övrigt inflationsjusterad serie utan att något på sidan skiljer den från de andra. Skattekraften mäter underlaget, inte vad kommunen får in: utjämningssystemet flyttar stora belopp mellan kommuner efter att detta har beräknats.',
    en: 'Expressed in the latest year’s kronor using the consumer price index, so years can be compared with years. TAB3600 also publishes 2026, but the price index only reaches 2025; the nominal 2026 figure is left out rather than placed at the end of an otherwise adjusted series with nothing on the page to distinguish it. The tax base measures what is taxable, not what the municipality receives: the equalisation system moves large sums between municipalities after this is computed.',
  },
  sensitivity: 'none',
  sources: [{ table: TAX_BASE_TABLE, contentCode: 'OE0101A0', note: neutral('1995–2025') }],
  derivation: {
    sv:
      'En SCB-cell per kommun och år: TAB3600:s innehållskod ”Skattekraft, kronor per ' +
      'invånare”, utpekad genom sin stabila svenska etikett — samma tabell publicerar också den ' +
      'totala beskattningsbara inkomsten och en andel av riksmedelvärdet, och att ta någon av ' +
      'dem skulle publicera en rimlig siffra för en annan fråga. Redan i kronor per invånare, ' +
      'så ingenting delas här; varje år räknas sedan om till prisindexets eget basår.',
    en:
      'One SCB cell per municipality and year: TAB3600’s "Skattekraft, kronor per invånare" ' +
      'content code, resolved by its stable Swedish label — the same table also publishes the ' +
      'total tax base and a share of the national mean, and taking either would publish a ' +
      'plausible number for a different question. Already in kronor per resident, so nothing is ' +
      'divided here; every year is then converted to the price index’s own base year.',
  },
})

export const DISPOSABLE: Indicator = Indicator.parse({
  id: 'disposable-household-income',
  name: { sv: 'Disponibel hushållsinkomst', en: 'Disposable household income' },
  description: {
    sv: 'Medianhushållets disponibla inkomst — vad hushållet har kvar efter skatter och bidrag — för samtliga hushåll med minst en person 18 år eller äldre.',
    en: 'The median household’s disposable income — what is left after taxes and transfers — across all households with at least one person aged 18 or over.',
  },
  unit: 'sek',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: DISPOSABLE_YEARS[0]!, to: DISPOSABLE_YEARS[DISPOSABLE_YEARS.length - 1]! },
  caveat: {
    sv: 'SCB publicerar denna tabell i fasta priser och sätter själv basåret. Serien är alltså redan inflationsjusterad — men inte av detta projekt och inte till samma år som medianinkomst och huspriser, som räknas om till prisindexets senaste år här. Jämför därför inte kronbelopp rakt av mellan denna indikator och de två. Avser hushåll, inte personer: ett hushåll kan vara en eller sex personer, och kommuner med många stora hushåll får högre siffror utan att någon enskild har mer.',
    en: 'SCB publishes this table in fixed prices and chooses the base year itself. The series is therefore already adjusted for inflation — but not by this project, and not to the same year as median income and house prices, which are converted here to the price index’s latest year. Do not compare kronor directly between this indicator and those two. It describes households, not people: a household may be one person or six, and a municipality with many large households shows higher figures without anyone individually having more.',
  },
  sensitivity: 'none',
  sources: [
    { table: DISPOSABLE_TABLE, contentCode: '000006SY', note: neutral('2011–2024, E90, 18+') },
  ],
  derivation: {
    sv:
      'En SCB-cell per kommun och år: TAB1492:s innehållskod ”Medianvärde, tkr” vid ' +
      'hushållstypen E90 (samtliga hushåll) och åldern 18+, var och en utpekad uttryckligen ' +
      'eftersom tabellen erbjuder femton hushållstyper och åtta överlappande åldersgrupper och ' +
      'ingen total för någon av dem. Publiceras i tusentals kronor och multipliceras här med 1 000 ' +
      'för att lagras i hela kronor. Ingen inflationsjustering görs: SCB har redan uttryckt ' +
      'serien i fasta priser, och att justera den igen skulle deflatera en redan deflaterad ' +
      'siffra.',
    en:
      'One SCB cell per municipality and year: TAB1492’s "Medianvärde, tkr" content code at ' +
      'household type E90 (all households) and age 18+, each resolved explicitly because this ' +
      'table offers fifteen household types and eight overlapping age bands and no total for ' +
      'either. Published in thousands of kronor, multiplied by 1,000 here to store true kronor. ' +
      'No inflation adjustment is applied: SCB has already expressed the series in fixed ' +
      'prices, and adjusting it again would deflate an already-deflated figure.',
  },
})

export function taxBaseDefined(): Definition {
  return {
    indicator: TAX_BASE,
    sources: [{ table: TAX_BASE_TABLE, content: TAX_BASE_CONTENT_LABEL, years: TAX_BASE_YEARS }],
    spec: { kind: 'direct' },
    modifiers: { inflationAdjust: true },
  }
}

export function disposableDefined(): Definition {
  return {
    indicator: DISPOSABLE,
    sources: [
      {
        table: DISPOSABLE_TABLE,
        content: DISPOSABLE_CONTENT_LABEL,
        years: DISPOSABLE_YEARS,
        dims: { Hushallstyp: { values: [ALL_HOUSEHOLDS] }, Alder: { values: [ADULTS] } },
        regions: 'known',
      },
    ],
    spec: { kind: 'direct' },
    modifiers: { scale: 1000 },
  }
}

/** Fetches the price index itself, exactly as income and housing do, for the same reason. */
export async function buildTaxBase(ctx: BuildContext): Promise<IndicatorSeries> {
  const { index, frozen } = await fetchCpi(ctx.freeze)
  ctx.cpi = index
  const series = await buildDefined(taxBaseDefined(), ctx)
  ctx.frozen.push(...frozen)
  return series
}

export const taxBaseDefinition: IndicatorDefinition = {
  indicator: TAX_BASE,
  build: buildTaxBase,
}

export const disposableDefinition: IndicatorDefinition = {
  indicator: DISPOSABLE,
  build: (ctx) => buildDefined(disposableDefined(), ctx),
}

export const PRICE_TO_INCOME: Indicator = Indicator.parse({
  id: 'house-price-to-income',
  name: { sv: 'Huspris i årsinkomster', en: 'House price in years of income' },
  description: {
    sv: 'Medelpriset på ett småhus delat med medianinkomsten: hur många årsinkomster ett hus kostar.',
    en: 'The mean price of a house divided by the median income: how many years of income a house costs.',
  },
  unit: 'years',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  // The overlap of the two series it divides, and nothing else: house prices run 1981–2025 and
  // median income 1999–2024, so this can only speak for 1999–2024.
  coverage: { from: 1999, to: 2024 },
  caveat: {
    sv: 'En kvot mellan två mått som inte beskriver samma personer: priset är genomsnittet för de småhus som faktiskt såldes under året, inkomsten är medianen för alla invånare 16 år och äldre. Den som köper ett hus är oftast inte medianinkomsttagaren, och ett hus köps sällan för en enda persons inkomst. Talet är ett grovt mått på hur ansträngd bostadsmarknaden är, inte på vad någon verkligen betalar. Båda serierna är uttryckta i samma års kronor, så kvoten påverkas inte av inflationen. Kommuner med för få försäljningar ett år saknar värde, eftersom priset då inte publiceras.',
    en: 'A ratio between two measures that do not describe the same people: the price is the mean for the houses actually sold that year, the income is the median for every resident aged 16 and over. Whoever buys a house is usually not the median earner, and a house is rarely bought on one person’s income. The figure is a rough measure of how stretched the housing market is, not of what anyone actually pays. Both series are expressed in the same year’s kronor, so inflation does not move the ratio. A municipality with too few sales in a year has no value, because no price is published for it.',
  },
  sensitivity: 'none',
  sources: [
    {
      table: 'TAB1169',
      contentCode: 'BO0501C2',
      note: { sv: 'från house-prices', en: 'via house-prices' },
    },
    {
      table: 'TAB3554',
      contentCode: 'HE0110J8',
      note: { sv: 'från median-income', en: 'via median-income' },
    },
  ],
  derivation: {
    sv:
      'house-prices delat med median-income, cell för cell, ur den här datamängdens egna två ' +
      'publicerade serier i stället för ur en tredje hämtning — så att kvoten kan kontrolleras ' +
      'mot de två siffror en läsare redan ser. Båda är justerade till samma basår innan detta ' +
      'körs, så kvoten förvrängs inte av inflationen. Åren är de som båda serierna publicerar; ' +
      'där någon av sidorna saknas saknas också kvoten.',
    en:
      'house-prices divided by median-income, cell by cell, from this pantry’s own two ' +
      'published series rather than from a third fetch — so the ratio can be checked against ' +
      'the two numbers a reader can already see. Both are adjusted to the same base year before ' +
      'this runs, so the quotient is not distorted by inflation. The years are the ones both ' +
      'series publish; where either side is absent, so is the ratio.',
  },
})

export function priceToIncomeDefined(): Definition {
  return {
    indicator: PRICE_TO_INCOME,
    sources: [],
    spec: { kind: 'quotient', of: 'house-prices', by: 'median-income' },
  }
}

export const priceToIncomeDefinition: IndicatorDefinition = {
  indicator: PRICE_TO_INCOME,
  build: (ctx) => buildDefined(priceToIncomeDefined(), ctx),
}
