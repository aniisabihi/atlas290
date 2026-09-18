import { Indicator } from '../../../shared/pantry'
import { buildDefined, type Definition } from './define'
import { type IndicatorDefinition } from './registry'

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
