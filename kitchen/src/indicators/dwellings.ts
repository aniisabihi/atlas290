import { Indicator } from '../../../shared/pantry'
import { buildDefined, type Definition } from './define'
import { type IndicatorDefinition } from './registry'
// Read only inside the definition functions' bodies, never at this module's own top level — the
// same reasoning every other module that divides by population documents for this import.
import { POPULATION } from './population'

export const RENT_TABLE = 'TAB4590'

/** TAB4590's own range, read off its frozen metadata: 2016..2025. */
export const RENT_YEARS = Array.from({ length: 2025 - 2016 + 1 }, (_, i) => 2016 + i)

const RENT_CONTENT_LABEL = 'Medianhyra i hyreslägenhet'

/**
 * TAB4590 publishes rent two ways, and neither is a rent.
 *
 * `Ah_kvm` is the year's rent per square metre; `Mh_kvm` is the new monthly rent per square
 * metre. There is no total, and there could not be one — they are different periods of the same
 * measure, and adding them would produce a number with no unit.
 *
 * The annual figure is the one taken. It covers the whole year rather than whatever the rent
 * happened to be at the moment of measurement, which is what makes a series of them comparable
 * year to year.
 */
const ANNUAL_PER_SQM = 'Ah_kvm'

export const RENT: Indicator = Indicator.parse({
  id: 'median-rent-per-sqm',
  name: { sv: 'Medianhyra per kvadratmeter', en: 'Median rent per square metre' },
  description: {
    sv: 'Medianhyra i hyreslägenheter, kronor per kvadratmeter och år.',
    en: 'Median rent in rental flats, kronor per square metre per year.',
  },
  unit: 'sek',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: RENT_YEARS[0]!, to: RENT_YEARS[RENT_YEARS.length - 1]! },
  caveat: {
    sv: 'Per kvadratmeter och år, inte per lägenhet: en kommun med små lägenheter kan ha hög kvadratmeterhyra och låg månadshyra. Därför heter indikatorn det den mäter. Beloppen är nominella kronor och räknas INTE om till ett gemensamt prisår, till skillnad från medianinkomst och huspriser — serien är tio år kort och SCB:s egen felmarginal per kommun är betydande, särskilt i små kommuner. Avser enbart hyresrätter; bostadsrätter och äganderätter har ingen hyra att mäta.',
    en: 'Per square metre per year, not per flat: a municipality of small flats can show a high rent per square metre and a low monthly rent. That is why the indicator is named for what it measures. The amounts are nominal kronor and are NOT converted to a common price year, unlike median income and house prices — the series is only ten years long and SCB’s own margin of error per municipality is substantial, especially in small ones. Rental flats only; owner-occupied and tenant-owned homes have no rent to measure.',
  },
  sensitivity: 'none',
  sources: [{ table: RENT_TABLE, contentCode: '000000J4', note: '2016–2025, Ah_kvm' }],
  derivation:
    'One SCB cell per municipality and year: TAB4590’s "Medianhyra i hyreslägenhet" content ' +
    'code at Hyresuppg=Ah_kvm (annual rent per square metre), both resolved by their stable ' +
    'Swedish labels. The same table also publishes a mean and two margins of error; the median ' +
    'is taken because a handful of very expensive flats moves a mean and not a median.',
})

export function rentDefined(): Definition {
  return {
    indicator: RENT,
    sources: [
      {
        table: RENT_TABLE,
        content: RENT_CONTENT_LABEL,
        years: RENT_YEARS,
        dims: { Hyresuppg: { values: [ANNUAL_PER_SQM] } },
        regions: 'known',
      },
    ],
    spec: { kind: 'direct' },
  }
}

export const rentDefinition: IndicatorDefinition = {
  indicator: RENT,
  build: (ctx) => buildDefined(rentDefined(), ctx),
}

export const COMPLETED_TABLE = 'TAB2538'
export const STOCK_TABLE = 'TAB824'

/**
 * Completed dwellings are published from 1938, and this indicator starts in 1968.
 *
 * The rate needs a population to divide by, and this pantry's population series begins in 1968.
 * The earlier counts exist and are simply not used; publishing them as a rate would need a
 * denominator this project does not have.
 */
export const COMPLETED_YEARS = Array.from({ length: 2025 - 1968 + 1 }, (_, i) => 1968 + i)
/** TAB824's own range, read off its frozen metadata: 1990..2025. */
export const STOCK_YEARS = Array.from({ length: 2025 - 1990 + 1 }, (_, i) => 1990 + i)

const COMPLETED_CONTENT_LABEL = 'Färdigställda lägenheter i nybyggda hus'
const STOCK_CONTENT_LABEL = 'Antal'

export const COMPLETED: Indicator = Indicator.parse({
  id: 'dwellings-completed-rate',
  name: {
    sv: 'Färdigställda bostäder per 1 000 invånare',
    en: 'Dwellings completed per 1,000 residents',
  },
  description: {
    sv: 'Antal färdigställda lägenheter i nybyggda hus under året, per 1 000 invånare. Småhus och flerbostadshus tillsammans.',
    en: 'Dwellings completed in newly built houses during the year, per 1,000 residents. Detached houses and blocks of flats together.',
  },
  unit: 'per-thousand',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: COMPLETED_YEARS[0]!, to: COMPLETED_YEARS[COMPLETED_YEARS.length - 1]! },
  caveat: {
    sv: 'Avser färdigställda lägenheter, alltså när bygget är klart — inte när det påbörjades eller när bygglovet gavs. Ett enda större projekt kan därför lyfta en liten kommun kraftigt ett år och lämna den på noll nästa; läs serien, inte ett enskilt år. Endast nybyggnad räknas: ombyggnad som ger nya lägenheter ingår inte. TAB2538 går tillbaka till 1938, men serien börjar 1968 eftersom talet behöver en folkmängd att delas med och folkmängdsserien här börjar då.',
    en: 'Counts dwellings completed — when the building is finished, not when it was started or permitted. A single large project can therefore lift a small municipality sharply in one year and leave it at zero the next; read the series, not a single year. New build only: conversions that create dwellings are not included. TAB2538 reaches back to 1938, but this series starts in 1968 because the rate needs a population to divide by and the population series here starts then.',
  },
  sensitivity: 'none',
  sources: [{ table: COMPLETED_TABLE, contentCode: 'BO0101A5', note: '1968–2025' }],
  derivation:
    'Completed dwellings over the population of the same year, times 1,000. TAB2538 splits by ' +
    'house type with no total code, so the two types are summed — they are disjoint counts of ' +
    'the same thing, which is why the sum is declared safe rather than assumed. The denominator ' +
    'is this pantry’s own published population.',
})

export const STOCK: Indicator = Indicator.parse({
  id: 'dwellings-per-1000',
  name: { sv: 'Bostäder per 1 000 invånare', en: 'Dwellings per 1,000 residents' },
  description: {
    sv: 'Antal lägenheter i kommunen per 1 000 invånare, inklusive specialbostäder. Med lägenhet menas varje bostad, även ett småhus.',
    en: 'Dwellings in the municipality per 1,000 residents, including special housing. A dwelling here is any home, a detached house included.',
  },
  unit: 'per-thousand',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: STOCK_YEARS[0]!, to: STOCK_YEARS[STOCK_YEARS.length - 1]! },
  caveat: {
    sv: 'Räknar bostäder, inte deras storlek: en kommun med många små lägenheter får ett högt tal utan att det bor fler människor per rum. Fritidshus ingår inte, vilket märks i kommuner där en stor del av bebyggelsen är fritidsbebyggelse. Specialbostäder — student- och äldreboenden — ingår, vilket lyfter universitetsstäder.',
    en: 'Counts homes, not their size: a municipality of many small flats shows a high figure without anyone living less densely. Holiday homes are excluded, which shows in municipalities where much of the building stock is holiday housing. Special housing — student and elderly accommodation — is included, which lifts university towns.',
  },
  sensitivity: 'none',
  sources: [{ table: STOCK_TABLE, contentCode: 'BO0104AH', note: '1990–2025' }],
  derivation:
    'Every dwelling over the population of the same year, times 1,000. TAB824 splits by house ' +
    'type and by tenure, neither with a total code, so both are summed: the four house types ' +
    'and the four tenures each partition the same stock exactly once, so summing over both ' +
    'counts every dwelling once. The denominator is this pantry’s own published population.',
})

export function completedDefined(): Definition {
  return {
    indicator: COMPLETED,
    sources: [
      {
        table: COMPLETED_TABLE,
        content: COMPLETED_CONTENT_LABEL,
        years: COMPLETED_YEARS,
        dims: { Hustyp: 'total' },
        regions: 'known',
      },
    ],
    spec: { kind: 'ratio', of: POPULATION.id, times: 1000 },
  }
}

export function stockDefined(): Definition {
  return {
    indicator: STOCK,
    sources: [
      {
        table: STOCK_TABLE,
        content: STOCK_CONTENT_LABEL,
        years: STOCK_YEARS,
        dims: { Hustyp: 'total', Upplatelseform: 'total' },
        regions: 'known',
      },
    ],
    spec: { kind: 'ratio', of: POPULATION.id, times: 1000 },
  }
}

export const completedDefinition: IndicatorDefinition = {
  indicator: COMPLETED,
  build: (ctx) => buildDefined(completedDefined(), ctx),
}

export const stockDefinition: IndicatorDefinition = {
  indicator: STOCK,
  build: (ctx) => buildDefined(stockDefined(), ctx),
}
