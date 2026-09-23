import { Indicator } from '../../../shared/pantry'
import { buildDefined, type Definition } from './define'
import { type IndicatorDefinition } from './registry'

export const LABOUR_TABLE = 'TAB3200'

/** TAB3200's own range, read off its frozen metadata: Tid runs 2020..2024, five values. */
export const LABOUR_YEARS = Array.from({ length: 2024 - 2020 + 1 }, (_, i) => 2020 + i)

const EMPLOYMENT_CONTENT_LABEL = 'sysselsättningsgrad'
const UNEMPLOYMENT_CONTENT_LABEL = 'arbetslöshet'

/**
 * The age band both labour-market indicators are published for.
 *
 * `TAB3200.Alder` offers twenty bands and **no total code** — five-year bands from 15–19 up, and
 * six overlapping wide bands (`15-74`, `16-64`, `16-65`, `16-66`, `20-64`, `20-65`, `20-66`).
 * Summing them would double-count massively, so a band has to be chosen, and the choice is part
 * of what the number means rather than an implementation detail.
 *
 * 20–64 is Sweden's own convention for sysselsättningsgrad and the band the national target is
 * expressed in. Both indicators from this table use it, so the employment rate and the
 * unemployment rate on this site describe the same people.
 */
const WORKING_AGE = '20-64'

/** A declaration shared by both: same table, same band, same totals — only the measure differs. */
function labourSource(content: string) {
  return {
    table: LABOUR_TABLE,
    content,
    years: LABOUR_YEARS,
    dims: {
      Kon: 'total' as const,
      Alder: { values: [WORKING_AGE] },
      // Born in Sweden, born abroad, or both. This site publishes the whole population of the
      // band; the split is a question for a later indicator, not a silent choice here.
      Fodelseregion: 'total' as const,
    },
  }
}

export const EMPLOYMENT: Indicator = Indicator.parse({
  id: 'employment-rate',
  name: { sv: 'Sysselsättningsgrad', en: 'Employment rate' },
  description: {
    sv: 'Andel av befolkningen 20–64 år som är sysselsatt, enligt registerbaserad arbetsmarknadsstatistik.',
    en: 'Share of the population aged 20–64 in employment, from the register-based labour market statistics.',
  },
  unit: 'percent',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: LABOUR_YEARS[0]!, to: LABOUR_YEARS[LABOUR_YEARS.length - 1]! },
  caveat: {
    sv: 'Avser åldern 20–64 år, båda könen och samtliga födelseregioner. TAB3200 saknar totalkod för ålder och erbjuder tjugo överlappande band; 20–64 är Sveriges eget mått och används här för både sysselsättning och arbetslöshet så att de beskriver samma människor. Serien är kort — den börjar 2020 — eftersom registret inte publiceras längre bakåt på kommunnivå. Statistiken är registerbaserad och mäter bostadskommun, inte arbetsplats: en pendlare räknas där hen bor.',
    en: 'Ages 20–64, both sexes, all regions of birth. TAB3200 has no total code for age and offers twenty overlapping bands; 20–64 is Sweden’s own measure, used here for both employment and unemployment so that the two describe the same people. The series is short — it begins in 2020 — because the register is not published further back at municipal level. It is register-based and counts where a person lives, not where they work: a commuter is counted at home.',
  },
  sensitivity: 'none',
  sources: [
    {
      table: LABOUR_TABLE,
      contentCode: '000002NS',
      note: { sv: '2020–2024, åldrarna 20–64', en: '2020–2024, ages 20–64' },
    },
  ],
  derivation: {
    sv:
      'En SCB-cell per kommun och år: TAB3200:s innehållskod ”sysselsättningsgrad”, utpekad ' +
      'genom sin stabila svenska etikett, vid Alder=20-64 med könstotalen (1+2) och totalen för ' +
      'födelseregion. SCB beräknar andelen; den härleds inte här ur antal.',
    en:
      'One SCB cell per municipality and year: TAB3200’s "sysselsättningsgrad" content code, ' +
      'resolved by its stable Swedish label, at Alder=20-64 with the sex total (1+2) and the ' +
      'birth-region total. SCB computes the rate; it is not derived here from counts.',
  },
})

export const UNEMPLOYMENT: Indicator = Indicator.parse({
  id: 'unemployment-rate',
  name: { sv: 'Arbetslöshet', en: 'Unemployment rate' },
  description: {
    sv: 'Andel av arbetskraften 20–64 år som är arbetslös, enligt registerbaserad arbetsmarknadsstatistik.',
    en: 'Share of the labour force aged 20–64 that is unemployed, from the register-based labour market statistics.',
  },
  unit: 'percent',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: LABOUR_YEARS[0]!, to: LABOUR_YEARS[LABOUR_YEARS.length - 1]! },
  caveat: {
    sv: 'Nämnaren är arbetskraften — sysselsatta plus arbetslösa — inte hela befolkningen, så detta tal och sysselsättningsgraden summerar inte till 100. Samma åldersband (20–64), samma register och samma korta serie från 2020 som sysselsättningsgraden.',
    en: 'The denominator is the labour force — those employed plus those unemployed — not the whole population, so this figure and the employment rate do not sum to 100. Same age band (20–64), same register and the same short series from 2020 as the employment rate.',
  },
  sensitivity: 'none',
  sources: [
    {
      table: LABOUR_TABLE,
      contentCode: '000002NN',
      note: { sv: '2020–2024, åldrarna 20–64', en: '2020–2024, ages 20–64' },
    },
  ],
  derivation: {
    sv:
      'En SCB-cell per kommun och år: TAB3200:s innehållskod ”arbetslöshet”, utpekad genom sin ' +
      'stabila svenska etikett, vid Alder=20-64 med totalerna för kön och födelseregion. SCB ' +
      'beräknar andelen av arbetskraften; den härleds inte här.',
    en:
      'One SCB cell per municipality and year: TAB3200’s "arbetslöshet" content code, resolved ' +
      'by its stable Swedish label, at Alder=20-64 with the sex and birth-region totals. SCB ' +
      'computes the rate against the labour force; it is not derived here.',
  },
})

export function employmentDefined(): Definition {
  return {
    indicator: EMPLOYMENT,
    sources: [labourSource(EMPLOYMENT_CONTENT_LABEL)],
    spec: { kind: 'direct' },
  }
}

export function unemploymentDefined(): Definition {
  return {
    indicator: UNEMPLOYMENT,
    sources: [labourSource(UNEMPLOYMENT_CONTENT_LABEL)],
    spec: { kind: 'direct' },
  }
}

export const employmentDefinition: IndicatorDefinition = {
  indicator: EMPLOYMENT,
  build: (ctx) => buildDefined(employmentDefined(), ctx),
}

export const unemploymentDefinition: IndicatorDefinition = {
  indicator: UNEMPLOYMENT,
  build: (ctx) => buildDefined(unemploymentDefined(), ctx),
}
