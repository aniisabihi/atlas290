import { Indicator } from '../../../shared/pantry'
import { buildDefined, type Definition } from './define'
import { type IndicatorDefinition } from './registry'

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
  sources: [{ table: FERTILITY_TABLE, contentCode: '000001J4', note: '2000–2025, Kon=2' }],
  derivation:
    'One SCB cell per municipality and year: TAB4805’s single content code, resolved by its ' +
    'stable Swedish label, at Kon=2 (women). Nothing is summed — the sex dimension is selected, ' +
    'not totalled, because this table has no total code for it and a summed fertility rate ' +
    'would not be a fertility rate.',
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
  sources: [{ table: DEPENDENCY_TABLE, contentCode: '00000708', note: '2000–2025' }],
  derivation:
    'One SCB cell per municipality and year: TAB4642’s "Försörjningskvot totalt" content code, ' +
    'resolved by its stable Swedish label and never by position — the same table also publishes ' +
    'the old-age and young-age halves separately, and taking the wrong one would publish a ' +
    'plausible number for a different question. The table has no dimension beyond Region and ' +
    'Tid, so there is nothing to total and nothing to sum.',
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
