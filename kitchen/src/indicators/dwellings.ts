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

/**
 * One share of TAB824's standing stock, partitioned by a dimension.
 *
 * `share-houses` cuts it by house type and `share-rentals` by tenure. Both read the same fetch:
 * the dimension being partitioned is kept, and every other dimension is summed within it, so a
 * share by tenure counts every house type and a share by house type counts every tenure.
 */
function stockShare(over: string) {
  return {
    table: STOCK_TABLE,
    content: STOCK_CONTENT_LABEL,
    years: STOCK_YEARS,
    dims: {
      Hustyp: (over === 'Hustyp' ? 'all' : 'total') as 'all' | 'total',
      Upplatelseform: (over === 'Upplatelseform' ? 'all' : 'total') as 'all' | 'total',
    },
    regions: 'known' as const,
  }
}

/** Every house type TAB824 publishes. Listed, because "all four" is a claim about the share. */
const HOUSE_TYPES = ['SMÅHUS', 'FLERBOST', 'ÖVRHUS', 'SPEC']
/** Every tenure TAB824 publishes, including the one that means "not recorded". */
const TENURES = ['1', '2', '3', 'ÖVRIGT']

export const SHARE_HOUSES: Indicator = Indicator.parse({
  id: 'share-houses',
  name: { sv: 'Andel småhus', en: 'Share of homes that are houses' },
  description: {
    sv: 'Andel av kommunens bostäder som är småhus, av samtliga bostäder — småhus, flerbostadshus, övriga hus och specialbostäder.',
    en: 'Share of the municipality’s dwellings that are detached or semi-detached houses, out of all dwellings — houses, blocks of flats, other buildings and special housing.',
  },
  unit: 'percent',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: STOCK_YEARS[0]!, to: STOCK_YEARS[STOCK_YEARS.length - 1]! },
  caveat: {
    sv: 'Nämnaren är alla bostäder, inklusive specialbostäder (student- och äldreboenden) och övriga hus. Andelen räknar bostäder, inte människor: ett flerbostadshus rymmer många bostäder på samma yta, så en kommun kan vara till synes dominerad av småhus i landskapet och ändå ha en låg andel här.',
    en: 'The denominator is every dwelling, special housing (student and elderly accommodation) and other buildings included. The share counts homes, not people: a block of flats holds many homes on the same ground, so a municipality can look like a landscape of houses and still show a low share here.',
  },
  sensitivity: 'none',
  sources: [{ table: STOCK_TABLE, contentCode: 'BO0104AH', note: '1990–2025, efter hustyp' }],
  derivation:
    'Dwellings of house type "småhus" over dwellings of all four house types, times 100, from ' +
    'one fetch of TAB824 partitioned by house type. Tenure is summed away within each type, so ' +
    'every dwelling is counted once whatever it is owned as. The denominator lists all four ' +
    'types rather than reading whatever the table happens to publish: "every type SCB offers" ' +
    'and "every type this share is defined over" are different claims.',
})

export const SHARE_RENTALS: Indicator = Indicator.parse({
  id: 'share-rentals',
  name: { sv: 'Andel hyresrätter', en: 'Share of homes that are rented' },
  description: {
    sv: 'Andel av kommunens bostäder som är hyresrätter, av samtliga bostäder — hyresrätt, bostadsrätt, äganderätt och bostäder där upplåtelseformen saknas.',
    en: 'Share of the municipality’s dwellings that are rented, out of all dwellings — rented, tenant-owned, owner-occupied, and those whose tenure is not recorded.',
  },
  unit: 'percent',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: STOCK_YEARS[0]!, to: STOCK_YEARS[STOCK_YEARS.length - 1]! },
  caveat: {
    sv: 'Nämnaren innehåller en fjärde kategori, "uppgift saknas", som räknas med. Att utesluta den skulle höja varje andel, och hur mycket beror på hur väl registret är ifyllt i just den kommunen — vilket inte är något läsaren kan se. Andra hand räknas som den upplåtelseform bostaden har, inte som hyresrätt.',
    en: 'The denominator includes a fourth category, "tenure not recorded", and it is counted. Leaving it out would raise every share, by an amount that depends on how completely the register is filled in for that particular municipality — which is not something a reader can see. A sublet counts as whatever the home’s own tenure is, not as a rental.',
  },
  sensitivity: 'none',
  sources: [
    { table: STOCK_TABLE, contentCode: 'BO0104AH', note: '1990–2025, efter upplåtelseform' },
  ],
  derivation:
    'Dwellings held as "hyresrätt" over dwellings of all four tenures, times 100, from one fetch ' +
    'of TAB824 partitioned by tenure. House type is summed away within each tenure. The ' +
    'denominator lists all four tenures explicitly, the one meaning "not recorded" included.',
})

export function shareHousesDefined(): Definition {
  return {
    indicator: SHARE_HOUSES,
    sources: [stockShare('Hustyp')],
    spec: { kind: 'share', over: 'Hustyp', numerator: ['SMÅHUS'], times: 100 },
    shareOver: HOUSE_TYPES,
  }
}

export function shareRentalsDefined(): Definition {
  return {
    indicator: SHARE_RENTALS,
    sources: [stockShare('Upplatelseform')],
    spec: { kind: 'share', over: 'Upplatelseform', numerator: ['1'], times: 100 },
    shareOver: TENURES,
  }
}

export const shareHousesDefinition: IndicatorDefinition = {
  indicator: SHARE_HOUSES,
  build: (ctx) => buildDefined(shareHousesDefined(), ctx),
}

export const shareRentalsDefinition: IndicatorDefinition = {
  indicator: SHARE_RENTALS,
  build: (ctx) => buildDefined(shareRentalsDefined(), ctx),
}

export const HOLIDAY_TABLE = 'TAB4198'

/** `TAB4198` publishes two points, five years apart. Plan 19's sparse machinery carries them. */
export const HOLIDAY_YEARS = [2015, 2020] as const

const HOLIDAY_CONTENT_LABEL = 'Antal fritidshus'

export const HOLIDAY_HOMES: Indicator = Indicator.parse({
  id: 'holiday-homes-per-1000',
  name: { sv: 'Fritidshus per 1 000 invånare', en: 'Holiday homes per 1,000 residents' },
  description: {
    sv: 'Antal fritidshus i fritidshusområden per 1 000 invånare.',
    en: 'Holiday homes inside holiday-home areas, per 1,000 residents.',
  },
  unit: 'per-thousand',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: {
    from: HOLIDAY_YEARS[0],
    to: HOLIDAY_YEARS[HOLIDAY_YEARS.length - 1]!,
    years: [...HOLIDAY_YEARS],
  },
  caveat: {
    sv: 'SCB räknar bara fritidshus som ligger i ett fritidshusOMRÅDE — minst femtio hus tillsammans — så enstaka stugor saknas helt. Ungefär en tredjedel av kommunerna har inget sådant område alls och saknar därför värde: kartan visar dem som "det som mäts finns inte här", inte som noll och inte som opublicerat. Nämnaren är kommunens egna invånare, inte dess hushåll eller dess yta, så talet blir mycket stort i en liten kommun med mycket sommarstugor — det mäter hur präglad kommunen är av fritidsboende, inte hur många av invånarna som äger ett fritidshus. Två mätpunkter, 2015 och 2020.',
    en: 'SCB counts only holiday homes inside a holiday-home AREA — at least fifty houses together — so isolated cabins are missing entirely. About a third of municipalities have no such area at all and therefore have no figure: the map shows them as "what this measures does not exist here", not as zero and not as unpublished. The denominator is the municipality’s own residents, not its households or its area, so the figure becomes very large in a small municipality full of summer houses — it measures how much the place is shaped by holiday living, not how many residents own one. Two survey points, 2015 and 2020.',
  },
  sensitivity: 'none',
  sources: [{ table: HOLIDAY_TABLE, contentCode: '0000000E', note: '2015, 2020' }],
  derivation:
    'Holiday homes over the population of the same year, times 1,000. The denominator is this ' +
    'pantry’s own published population. Where SCB publishes nothing — a municipality with no ' +
    'holiday-home area — the cell is `nothing-to-count` rather than `not-yet-published`: there ' +
    'is no figure coming, because there is nothing of this kind there to count.',
})

export function holidayHomesDefined(): Definition {
  return {
    indicator: HOLIDAY_HOMES,
    sources: [
      {
        table: HOLIDAY_TABLE,
        content: HOLIDAY_CONTENT_LABEL,
        years: [...HOLIDAY_YEARS],
        regions: 'known',
      },
    ],
    spec: { kind: 'ratio', of: POPULATION.id, times: 1000 },
    // The whole reason this indicator waited for plan 21. See the caveat.
    absentMeans: 'nothing-to-count',
  }
}

export const holidayHomesDefinition: IndicatorDefinition = {
  indicator: HOLIDAY_HOMES,
  build: (ctx) => buildDefined(holidayHomesDefined(), ctx),
}
