import { Indicator } from '../../../shared/pantry'
import { buildDefined, type Definition } from './define'
import { type IndicatorDefinition } from './registry'
// Read only inside naturalChangeDefined's body, never at this module's own top level, so the
// binding is safe despite the population<->registry cycle — the same reasoning migration.ts and
// derived.ts each document for their own imports of these three.
import { CKM_FROM, POPULATION } from './population'
import { neutral } from './prose'

export const FERTILITY_TABLE = 'TAB4805'
export const DEPENDENCY_TABLE = 'TAB4642'

/** TAB4805's own range, read off its frozen metadata: Tid runs 2000..2025, 26 values. */
export const FERTILITY_YEARS = Array.from({ length: 2025 - 2000 + 1 }, (_, i) => 2000 + i)
/** TAB4642's own range, likewise: 2000..2025. */
export const DEPENDENCY_YEARS = Array.from({ length: 2025 - 2000 + 1 }, (_, i) => 2000 + i)

/** TAB4805 carries a single ContentsCode, labelled `Antal`. Resolved by label, per trap 2. */
const FERTILITY_CONTENT_LABEL = 'Antal'
/** TAB4642 carries three; this is the one that counts both ends against the middle. */
const DEPENDENCY_CONTENT_LABEL = 'Försörjningskvot totalt'

/**
 * TAB4805 publishes summerad fruktsamhet BY SEX, and its `Kon` dimension has no total code —
 * only `1=män` and `2=kvinnor`.
 *
 * That absence is the whole reason this is an explicit value rather than `'total'`. A men's and a
 * women's total fertility rate added together is not a fertility rate of anything; it is two
 * different measures of the same births, summed. The conventional measure — and the one every
 * comparison a reader will make assumes — is the women's.
 */
const WOMEN = '2'

export const FERTILITY: Indicator = Indicator.parse({
  id: 'fertility-rate',
  name: { sv: 'Summerad fruktsamhet', en: 'Total fertility rate' },
  description: {
    sv: 'Summerad fruktsamhet för kvinnor: det antal barn en kvinna skulle föda under sitt liv om årets fruktsamhetstal för varje ålder gällde hela livet.',
    en: 'Total fertility rate for women: the number of children a woman would bear over her lifetime if the year’s age-specific fertility rates applied throughout it.',
  },
  unit: 'children-per-woman',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: FERTILITY_YEARS[0]!, to: FERTILITY_YEARS[FERTILITY_YEARS.length - 1]! },
  caveat: {
    sv: 'Avser kvinnor. TAB4805 redovisar summerad fruktsamhet uppdelad på kön och saknar totalkod; männens tal är ett annat mått på samma födslar och summeras därför aldrig med kvinnornas. Talet är ett syntetiskt kohortmått: det beskriver ett år, inte någon verklig kvinnas barnafödande. I en liten kommun rör sig talet kraftigt mellan år av rena slumpskäl.',
    en: 'Women. TAB4805 publishes the rate split by sex and carries no total code; the men’s figure is a different measure of the same births and is never summed with the women’s. The rate is a synthetic cohort measure: it describes a year, not any real woman’s childbearing. In a small municipality it moves sharply between years for reasons that are pure chance.',
  },
  sensitivity: 'none',
  sources: [{ table: FERTILITY_TABLE, contentCode: '000001J4', note: neutral('2000–2025, Kon=2') }],
  derivation: {
    sv:
      'En SCB-cell per kommun och år: TAB4805:s enda innehållskod, utpekad genom sin stabila ' +
      'svenska etikett, vid Kon=2 (kvinnor). Ingenting summeras — könsdimensionen väljs i ' +
      'stället för att summeras, eftersom tabellen saknar totalkod för den och en summerad ' +
      'fruktsamhet inte vore en fruktsamhet.',
    en:
      'One SCB cell per municipality and year: TAB4805’s single content code, resolved by its ' +
      'stable Swedish label, at Kon=2 (women). Nothing is summed — the sex dimension is ' +
      'selected, not totalled, because this table has no total code for it and a summed ' +
      'fertility rate would not be a fertility rate.',
  },
})

export const DEPENDENCY: Indicator = Indicator.parse({
  id: 'dependency-ratio',
  name: { sv: 'Demografisk försörjningskvot', en: 'Demographic dependency ratio' },
  description: {
    sv: 'Antal personer 0–19 år och 65 år och äldre per 100 personer i åldern 20–64 år.',
    en: 'People aged 0–19 and 65 and over, per 100 people aged 20–64.',
  },
  unit: 'percent',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: DEPENDENCY_YEARS[0]!, to: DEPENDENCY_YEARS[DEPENDENCY_YEARS.length - 1]! },
  caveat: {
    sv: 'Måttet är en kvot per 100 personer i yrkesaktiv ålder och kan därför passera 100: i Borgholm 2024 är den 123,8, i Stockholm 59,5. Det säger ingenting om vem som faktiskt arbetar eller försörjer vem — bara hur åldrarna fördelar sig. SCB beräknar kvoten själv; den härleds inte här.',
    en: 'A ratio per 100 people of working age, so it can pass 100: Borgholm 2024 is 123.8, Stockholm 59.5. It says nothing about who actually works or supports whom — only how the ages fall. SCB computes the ratio itself; it is not derived here.',
  },
  sensitivity: 'none',
  sources: [{ table: DEPENDENCY_TABLE, contentCode: '00000708', note: neutral('2000–2025') }],
  derivation: {
    sv:
      'En SCB-cell per kommun och år: TAB4642:s innehållskod ”Försörjningskvot totalt”, utpekad ' +
      'genom sin stabila svenska etikett och aldrig efter position — samma tabell publicerar ' +
      'också de äldres och de ungas delar var för sig, och att ta fel kod skulle publicera en ' +
      'rimlig siffra för en annan fråga. Tabellen har ingen dimension utöver Region och Tid, så ' +
      'det finns inget att välja en total ur och inget att summera.',
    en:
      'One SCB cell per municipality and year: TAB4642’s "Försörjningskvot totalt" content ' +
      'code, resolved by its stable Swedish label and never by position — the same table also ' +
      'publishes the old-age and young-age halves separately, and taking the wrong one would ' +
      'publish a plausible number for a different question. The table has no dimension beyond ' +
      'Region and Tid, so there is nothing to total and nothing to sum.',
  },
})

export function fertilityDefined(): Definition {
  return {
    indicator: FERTILITY,
    sources: [
      {
        table: FERTILITY_TABLE,
        content: FERTILITY_CONTENT_LABEL,
        years: FERTILITY_YEARS,
        dims: { Kon: { values: [WOMEN] } },
      },
    ],
    spec: { kind: 'direct' },
  }
}

export function dependencyDefined(): Definition {
  return {
    indicator: DEPENDENCY,
    sources: [
      { table: DEPENDENCY_TABLE, content: DEPENDENCY_CONTENT_LABEL, years: DEPENDENCY_YEARS },
    ],
    spec: { kind: 'direct' },
  }
}

export const fertilityDefinition: IndicatorDefinition = {
  indicator: FERTILITY,
  build: (ctx) => buildDefined(fertilityDefined(), ctx),
}

export const dependencyDefinition: IndicatorDefinition = {
  indicator: DEPENDENCY,
  build: (ctx) => buildDefined(dependencyDefined(), ctx),
}

export const BIRTHS_TABLE_OLD = 'TAB1264'
export const BIRTHS_TABLE_NEW = 'TAB6401'
export const DEATHS_TABLE_OLD = 'TAB960'
export const DEATHS_TABLE_NEW = 'TAB6757'

/**
 * Natural change runs the whole of population's own range, because it is divided by population.
 *
 * Both event tables reach back to 1968 and both stop at 2024, continued for 2025 by a Cell Key
 * Method table of their own — the same cutover population, density and net migration already
 * make, and the reason `perturbedFrom` is set below.
 *
 * Written out rather than `= YEARS`, which is what this said first. `coverage` is read when
 * `Indicator.parse` runs at module load, and population.ts is mid-cycle at that moment, so
 * `YEARS` is still undefined — exactly the hazard decision 0014 D4 records for `CKM_FROM`, and
 * the reason every other indicator defines its own range locally instead of importing one.
 * `CKM_FROM` and `POPULATION` below are read only inside a function body, where the cycle has
 * long since resolved.
 */
const NATURAL_YEARS = Array.from({ length: 2025 - 1968 + 1 }, (_, i) => 1968 + i)

/** Both event tables carry a single ContentsCode, labelled `Antal`. */
const EVENT_CONTENT_LABEL = 'Antal'

/**
 * One event table, as a source.
 *
 * The age dimension is totalled and thrown away: a birth is a birth whatever the mother's age,
 * and a death is a death whatever the age reached. Sex likewise. What is left is one count per
 * municipality and year, which is all a rate needs.
 *
 * The two 1968–2024 tables have no sex total at all, so both are declared in `SUM_SAFE`; the two
 * 2025 tables carry `TotSa` and use it.
 */
function eventSource(table: string, ageDim: string, years: readonly number[], subtract = false) {
  return {
    table,
    content: EVENT_CONTENT_LABEL,
    years,
    dims: { [ageDim]: 'total' as const, Kon: 'total' as const },
    ...(subtract ? { subtract: true } : {}),
  }
}

export const NATURAL_CHANGE: Indicator = Indicator.parse({
  id: 'natural-change-rate',
  name: {
    sv: 'Födelseöverskott per 1 000 invånare',
    en: 'Natural change per 1,000 residents',
  },
  description: {
    sv: 'Antal födda minus antal döda under året, per 1 000 invånare. Positivt tal betyder att fler föds än dör.',
    en: 'Births minus deaths during the year, per 1,000 residents. A positive figure means more people are born than die.',
  },
  unit: 'per-thousand',
  priceBasis: 'none',
  scale: { kind: 'diverging', breaks: [] },
  coverage: { from: NATURAL_YEARS[0]!, to: NATURAL_YEARS[NATURAL_YEARS.length - 1]! },
  caveat: {
    sv: 'Detta är befolkningsförändringen utan flyttningar: en kommun kan ha kraftigt födelseöverskott och ändå krympa, eller tvärtom. Läs den tillsammans med flyttningsöverskottet. Nämnaren är folkmängden vid årets slut, medan födda och döda räknas under året. Från 2025 är både födda och döda hämtade ur SCB:s störningsskyddade tabeller (Cell Key Method), så talet för det året är medvetet något oskarpt — i en liten kommun kan det märkas.',
    en: 'This is population change with migration left out: a municipality can have a strong birth surplus and still shrink, or the reverse. Read it alongside net migration. The denominator is the population at the end of the year, while births and deaths are counted during it. From 2025 both births and deaths come from SCB’s disclosure-protected tables (Cell Key Method), so that year’s figure is deliberately slightly fuzzed — in a small municipality that can show.',
  },
  sensitivity: 'none',
  sources: [
    {
      table: BIRTHS_TABLE_OLD,
      contentCode: 'BE0101E2',
      note: { sv: 'födda 1968–2024', en: 'births 1968–2024' },
    },
    {
      table: BIRTHS_TABLE_NEW,
      contentCode: '00000863',
      note: { sv: 'födda 2025 (CKM)', en: 'births 2025 (CKM)' },
    },
    {
      table: DEATHS_TABLE_OLD,
      contentCode: 'BE0101D9',
      note: { sv: 'döda 1968–2024', en: 'deaths 1968–2024' },
    },
    {
      table: DEATHS_TABLE_NEW,
      contentCode: '000008FO',
      note: { sv: 'döda 2025 (CKM)', en: 'deaths 2025 (CKM)' },
    },
  ],
  derivation: {
    sv:
      'Födda minus döda, delat med folkmängden samma år, gånger 1 000. Fyra tabeller: två för ' +
      'födda och två för döda, där varje par är en tabell för 1968–2024 som fortsätts av en ' +
      'röjandeskyddad tabell för 2025. Ålder och kön summeras bort i varenda en — en född är en ' +
      'född oavsett moderns ålder — så att ett antal per kommun och år återstår. De två ' +
      'dödstabellerna deklareras som subtraherande källor, så täljaren är redan skillnaden ' +
      'innan den delas. Nämnaren läses ur den här datamängdens egen publicerade folkmängd i ' +
      'stället för att hämtas på nytt, så de två kan aldrig vara oense om året.',
    en:
      'Births minus deaths, over the population of the same year, times 1,000. Four tables: two ' +
      'for births and two for deaths, each pair a 1968–2024 table continued by a 2025 ' +
      'disclosure-protected one. Age and sex are totalled away in every one of them — a birth ' +
      'is a birth whatever the mother’s age — leaving one count per municipality and year. The ' +
      'two death tables are declared as subtracting sources, so the numerator is already the ' +
      'difference before it is divided. The denominator is read from this pantry’s own ' +
      'published population rather than refetched, so the two can never disagree about the ' +
      'year.',
  },
})

export function naturalChangeDefined(): Definition {
  const upTo2024 = NATURAL_YEARS.filter((y) => y < CKM_FROM)
  const from2025 = NATURAL_YEARS.filter((y) => y >= CKM_FROM)
  return {
    indicator: NATURAL_CHANGE,
    sources: [
      eventSource(BIRTHS_TABLE_OLD, 'AlderModer', upTo2024),
      eventSource(BIRTHS_TABLE_NEW, 'AlderModer', from2025),
      eventSource(DEATHS_TABLE_OLD, 'Alder', upTo2024, true),
      eventSource(DEATHS_TABLE_NEW, 'Alder', from2025, true),
    ],
    spec: { kind: 'ratio', of: POPULATION.id, times: 1000 },
    perturbedFrom: CKM_FROM,
  }
}

export const naturalChangeDefinition: IndicatorDefinition = {
  indicator: NATURAL_CHANGE,
  build: (ctx) => buildDefined(naturalChangeDefined(), ctx),
}
