import { Indicator } from '../../../shared/pantry'
import { buildDefined, type Definition } from './define'
import { type IndicatorDefinition } from './registry'

export const LIFE_TABLE = 'TAB4394'

/**
 * Life expectancy is published for overlapping five-year windows, and this pins each to its last.
 *
 * `TAB4394.Tid` carries `1998-2002` through `2021-2025` — twenty-four windows, not years, which
 * `IndicatorSeries.years` cannot hold. The fifth slice design's D6 pins each period to one
 * representative year rather than widening the contract, and for a window the representative
 * year is its last: `1998-2002` is published under 2002.
 *
 * Because the windows overlap by four years, the twenty-four land on twenty-four CONSECUTIVE
 * years, 2002–2025. That is what makes this a dense series and keeps it out of the sparse work.
 * It is also what D7 warns about, and why the caveat says so: consecutive values are built from
 * four-fifths of the same deaths.
 */
export const LIFE_YEARS = Array.from({ length: 2025 - 2002 + 1 }, (_, i) => 2002 + i)

/** The `Tid` code the year stands for: 2002 asks for `1998-2002`. */
const windowEndingIn = (year: number) => `${year - 4}-${year}`

const LIFE_CONTENT_LABEL = 'Medellivslängd'

const SHARED_CAVEAT_SV =
  'Varje värde avser ett femårsfönster och redovisas här under fönstrets sista år: 2002 är alltså 1998–2002. Fönstren överlappar med fyra år, så två intilliggande värden bygger på fyra femtedelar av samma dödsfall — förändringen mellan två år säger därför nästan ingenting, och kurvan är jämnare än verkligheten. Måttet är ett syntetiskt kohortmått: det beskriver dödligheten under perioden, inte hur länge någon som föddes då faktiskt kommer att leva.'
const SHARED_CAVEAT_EN =
  'Each value covers a five-year window and is published here under that window’s last year: 2002 is 1998–2002. The windows overlap by four years, so two adjacent values are built from four-fifths of the same deaths — the change between two years therefore says almost nothing, and the line is smoother than reality. It is a synthetic cohort measure: it describes mortality during the period, not how long anyone born then will actually live.'

function lifeExpectancy(id: string, sv: string, en: string, who: string, whoEn: string): Indicator {
  return Indicator.parse({
    id,
    name: { sv, en },
    description: {
      sv: `Återstående medellivslängd vid födseln för ${who}, i år.`,
      en: `Life expectancy at birth for ${whoEn}, in years.`,
    },
    unit: 'years',
    priceBasis: 'none',
    scale: { kind: 'sequential', breaks: [] },
    coverage: { from: LIFE_YEARS[0]!, to: LIFE_YEARS[LIFE_YEARS.length - 1]! },
    caveat: {
      sv: `Avser ${who}. ${SHARED_CAVEAT_SV} I en liten kommun vilar femårsfönstret ändå på få dödsfall, och talet rör sig mer av slump än av hälsa.`,
      en: `${whoEn.charAt(0).toUpperCase()}${whoEn.slice(1)}. ${SHARED_CAVEAT_EN} In a small municipality the five-year window still rests on few deaths, and the figure moves more from chance than from health.`,
    },
    sensitivity: 'none',
    sources: [{ table: LIFE_TABLE, contentCode: '000000NH', note: '1998-2002 … 2021-2025' }],
    derivation:
      'One SCB cell per municipality and five-year window, published under the window’s last ' +
      'year. The sex is selected rather than totalled: TAB4394 has no sex total, and a men’s ' +
      'and a women’s life expectancy can be neither summed nor averaged without a sex-split ' +
      'population to weight by, which this pantry does not publish.',
  })
}

export const LIFE_WOMEN = lifeExpectancy(
  'life-expectancy-women',
  'Medellivslängd, kvinnor',
  'Life expectancy, women',
  'kvinnor',
  'women',
)

export const LIFE_MEN = lifeExpectancy(
  'life-expectancy-men',
  'Medellivslängd, män',
  'Life expectancy, men',
  'män',
  'men',
)

export const LIFE_GAP: Indicator = Indicator.parse({
  id: 'life-expectancy-gap',
  name: { sv: 'Livslängdsgap mellan kvinnor och män', en: 'Life expectancy gap, women and men' },
  description: {
    sv: 'Kvinnors medellivslängd minus mäns, i år. Positivt tal betyder att kvinnor lever längre.',
    en: 'Women’s life expectancy minus men’s, in years. A positive figure means women live longer.',
  },
  unit: 'years',
  priceBasis: 'none',
  scale: { kind: 'diverging', breaks: [] },
  coverage: { from: LIFE_YEARS[0]!, to: LIFE_YEARS[LIFE_YEARS.length - 1]! },
  caveat: {
    sv: `Skillnaden i år mellan de två publicerade delserierna, så varje tal här går att kontrollera mot dem. ${SHARED_CAVEAT_SV} Gapet har minskat i riket under lång tid, men i en enskild liten kommun rör det sig kraftigt av slumpskäl.`,
    en: `The difference in years between the two published split series, so every figure here can be checked against them. ${SHARED_CAVEAT_EN} The gap has narrowed nationally over decades, but in a single small municipality it moves sharply for reasons that are chance.`,
  },
  sensitivity: 'none',
  sources: [{ table: LIFE_TABLE, contentCode: '000000NH', note: '1998-2002 … 2021-2025' }],
  derivation:
    'life-expectancy-women minus life-expectancy-men, cell by cell, from this pantry’s own two ' +
    'published series rather than from a third fetch. Where either side is absent, so is the gap.',
})

function forSex(indicator: Indicator, kon: string): Definition {
  return {
    indicator,
    sources: [
      {
        table: LIFE_TABLE,
        content: LIFE_CONTENT_LABEL,
        years: LIFE_YEARS,
        period: windowEndingIn,
        dims: { Kon: { values: [kon] } },
        regions: 'known',
      },
    ],
    spec: { kind: 'direct' },
  }
}

export function lifeWomenDefined(): Definition {
  return forSex(LIFE_WOMEN, '2')
}

export function lifeMenDefined(): Definition {
  return forSex(LIFE_MEN, '1')
}

export function lifeGapDefined(): Definition {
  return {
    indicator: LIFE_GAP,
    sources: [],
    spec: { kind: 'difference', of: LIFE_WOMEN.id, minus: LIFE_MEN.id },
  }
}

export const lifeWomenDefinition: IndicatorDefinition = {
  indicator: LIFE_WOMEN,
  build: (ctx) => buildDefined(lifeWomenDefined(), ctx),
}

export const lifeMenDefinition: IndicatorDefinition = {
  indicator: LIFE_MEN,
  build: (ctx) => buildDefined(lifeMenDefined(), ctx),
}

export const lifeGapDefinition: IndicatorDefinition = {
  indicator: LIFE_GAP,
  build: (ctx) => buildDefined(lifeGapDefined(), ctx),
}
