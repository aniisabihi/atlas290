import { Indicator } from '../../../shared/pantry'
import { buildDefined, type Definition } from './define'
import { type IndicatorDefinition } from './registry'
import type { Source } from './source'
// Read only inside the definition functions' bodies, never at this module's own top level — the
// same reasoning every other module that divides by population documents for this import.
import { POPULATION } from './population'
import { neutral } from './prose'

export const COMMUTE_TABLE_OLD = 'TAB3267'
export const COMMUTE_TABLE_MID = 'TAB3266'
export const COMMUTE_TABLE_NEW = 'TAB5839'

/**
 * Commuting runs 1993–2021 and stops, which DESIGN §8 already records.
 *
 * Three tables, split where SCB restarted the series: 1993–2003, 2004–2018, and 2019–2021 on a
 * new definition. Written out rather than derived from population's range, for the reason
 * decision 0014 D4 gives — a module-level read of another indicator's constant races the import
 * cycle.
 */
export const COMMUTE_YEARS = Array.from({ length: 2021 - 1993 + 1 }, (_, i) => 1993 + i)

/**
 * The three tables use three different codes for each measure and the SAME labels.
 *
 * `AM0207H9`, `AM0207C8` and `00000548` are all "Utpendlare över kommungräns". That is why the
 * out-commuter share is grouped by content label rather than code: a share keyed by code could
 * not span the stitch.
 */
const IN_COMMUTERS = 'Inpendlare över kommungräns'
const OUT_COMMUTERS = 'Utpendlare över kommungräns'
const STAY = 'Bor och arbetar i kommunen'

/** The sex total, selected by label: these tables call it `4`, which no `TOTAL_CODES` entry knows. */
const BOTH_SEXES = 'män och kvinnor'

function commuteSource(
  table: string,
  years: readonly number[],
  content: string | string[],
): Source {
  return {
    table,
    content,
    years,
    dims: { Kon: { label: BOTH_SEXES } },
    regions: 'known',
  }
}

/** Each table's own slice of the range, so the three never overlap and nothing is double counted. */
function slices(content: string | string[]): Source[] {
  return [
    commuteSource(
      COMMUTE_TABLE_OLD,
      COMMUTE_YEARS.filter((y) => y <= 2003),
      content,
    ),
    commuteSource(
      COMMUTE_TABLE_MID,
      COMMUTE_YEARS.filter((y) => y >= 2004 && y <= 2018),
      content,
    ),
    commuteSource(
      COMMUTE_TABLE_NEW,
      COMMUTE_YEARS.filter((y) => y >= 2019),
      content,
    ),
  ]
}

const BREAK_SV =
  'SCB bytte definition 2019: fram till 2018 räknas förvärvsarbetande från 16 år och uppåt, från 2019 endast 16–74 år. Serien är därför inte helt jämförbar över det året. Pendling redovisas dessutom bara till och med 2021.'
const BREAK_EN =
  'SCB changed the definition in 2019: up to 2018 the employed are counted from age 16 upwards, from 2019 only ages 16–74. The series is therefore not fully comparable across that year. Commuting is also only published through 2021.'

export const IN_COMMUTING: Indicator = Indicator.parse({
  id: 'in-commuters-per-1000',
  name: { sv: 'Inpendlare per 1 000 invånare', en: 'In-commuters per 1,000 residents' },
  description: {
    sv: 'Antal personer som arbetar i kommunen men bor i en annan, per 1 000 invånare.',
    en: 'People who work in the municipality but live in another, per 1,000 residents.',
  },
  unit: 'per-thousand',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: COMMUTE_YEARS[0]!, to: COMMUTE_YEARS[COMMUTE_YEARS.length - 1]! },
  caveat: {
    sv: `Nämnaren är kommunens egna invånare, inte dess arbetsplatser, så talet kan bli stort i en liten kommun med en stor arbetsgivare. Det mäter arbetsplatser som drar folk utifrån, inte hur många som arbetar i kommunen totalt. ${BREAK_SV}`,
    en: `The denominator is the municipality’s own residents, not its workplaces, so the figure can be large in a small municipality with one big employer. It measures workplaces that draw people in, not how many work there in total. ${BREAK_EN}`,
  },
  sensitivity: 'none',
  sources: [
    { table: COMMUTE_TABLE_OLD, contentCode: 'AM0207H8', note: neutral('1993–2003') },
    { table: COMMUTE_TABLE_MID, contentCode: 'AM0207C6', note: neutral('2004–2018') },
    { table: COMMUTE_TABLE_NEW, contentCode: '00000547', note: neutral('2019–2021') },
  ],
  derivation: {
    sv:
      'Inpendlare delat med folkmängden samma år, gånger 1 000. Tre tabeller skarvas vid de år ' +
      'då SCB startade om serien, och var och en bidrar bara med sina egna år. Könstotalen ' +
      'väljs efter sin etikett, eftersom de här tabellerna kallar den `4`. Nämnaren är den här ' +
      'datamängdens egen publicerade folkmängd.',
    en:
      'In-commuters over the population of the same year, times 1,000. Three tables stitched at ' +
      'the years SCB restarted the series, each contributing only its own years. The sex total ' +
      'is selected by its label because these tables call it `4`. The denominator is this ' +
      'pantry’s own published population.',
  },
})

export const OUT_COMMUTING: Indicator = Indicator.parse({
  id: 'out-commuter-share',
  name: { sv: 'Andel utpendlare', en: 'Share who commute out' },
  description: {
    sv: 'Andel av kommunens förvärvsarbetande invånare som arbetar i en annan kommun.',
    en: 'Share of the municipality’s employed residents who work in another municipality.',
  },
  unit: 'percent',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: COMMUTE_YEARS[0]!, to: COMMUTE_YEARS[COMMUTE_YEARS.length - 1]! },
  caveat: {
    sv: `Nämnaren är de förvärvsarbetande som bor i kommunen — utpendlarna plus de som både bor och arbetar där — inte hela befolkningen. Måttet säger ingenting om hur långt någon pendlar: ett byte av kommungräns i en sammanvuxen storstad räknas lika mycket som tjugo mil. ${BREAK_SV}`,
    en: `The denominator is the employed people who live in the municipality — those who commute out plus those who both live and work there — not the whole population. The measure says nothing about how far anyone travels: crossing a boundary inside a continuous city counts the same as two hundred kilometres. ${BREAK_EN}`,
  },
  sensitivity: 'none',
  sources: [
    { table: COMMUTE_TABLE_OLD, contentCode: 'AM0207H9', note: neutral('1993–2003') },
    { table: COMMUTE_TABLE_MID, contentCode: 'AM0207C8', note: neutral('2004–2018') },
    { table: COMMUTE_TABLE_NEW, contentCode: '00000548', note: neutral('2019–2021') },
  ],
  derivation: {
    sv:
      'Utpendlare delat med utpendlare plus de som både bor och arbetar i kommunen, gånger 100 ' +
      '— de två innehållskoderna hämtas tillsammans och delas upp efter innehållets ETIKETT, ' +
      'eftersom de tre skarvade tabellerna använder olika koder för samma mått och bara ' +
      'etiketten är stabil mellan dem.',
    en:
      'Out-commuters over out-commuters plus those who live and work in the municipality, times ' +
      '100 — the two content codes fetched together and partitioned by content LABEL, because ' +
      'the three stitched tables use different codes for the same measure and only the label is ' +
      'stable across them.',
  },
})

export function inCommutingDefined(): Definition {
  return {
    indicator: IN_COMMUTING,
    sources: slices(IN_COMMUTERS),
    spec: { kind: 'ratio', of: POPULATION.id, times: 1000 },
  }
}

export function outCommutingDefined(): Definition {
  return {
    indicator: OUT_COMMUTING,
    sources: slices([OUT_COMMUTERS, STAY]),
    spec: { kind: 'share', over: 'ContentsCode', numerator: [OUT_COMMUTERS], times: 100 },
    shareOver: [OUT_COMMUTERS, STAY],
  }
}

export const inCommutingDefinition: IndicatorDefinition = {
  indicator: IN_COMMUTING,
  build: (ctx) => buildDefined(inCommutingDefined(), ctx),
}

export const outCommutingDefinition: IndicatorDefinition = {
  indicator: OUT_COMMUTING,
  build: (ctx) => buildDefined(outCommutingDefined(), ctx),
}
