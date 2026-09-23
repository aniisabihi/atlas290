import { Indicator } from '../../../shared/pantry'
import { buildDefined, type Definition } from './define'
import { type IndicatorDefinition } from './registry'
import { neutral } from './prose'

export const FARMLAND_TABLE = 'TAB6002'
export const LAND_USE_TABLE = 'TAB5118'

/**
 * Farmland starts in 1981, and 1951 is left on the table deliberately.
 *
 * `TAB6002` reaches back to 1951, seventeen years before this site's axis begins. The axis is
 * the union of every indicator's coverage, so admitting that one point would stretch the slider
 * from 59 positions to 76 **for every indicator on the site** in order to show one more value
 * here. The fifth slice design's D8 refuses it, and the rule worth keeping is that the axis
 * serves the reader rather than the longest table.
 */
export const FARMLAND_YEARS = [1981, 1990, 1995, 2000, 2005, 2010, 2015, 2020] as const

/** `TAB5118` is the newer land-use survey and publishes only three points. */
export const LAND_USE_YEARS = [2010, 2015, 2020] as const

const TOTAL_FARMLAND = 'total jordbruksmark'

/**
 * The share is keyed by CODE, not by label, and deliberately.
 *
 * `resolveSources` keys a group by its label only for `ContentsCode`, where the label is the
 * one identity stable across a stitch of tables (decision 0021 D4). Every other dimension keys
 * by code — and here that is the safer half anyway: `TAB5118` publishes class 3 as
 * `'bebyggd och anlagd mark '`, with a trailing space, which a label-keyed share would have to
 * carry verbatim in this file for ever.
 */
const BUILT_LAND = '3'
const TOTAL_LAND = '911'

export const FARMLAND: Indicator = Indicator.parse({
  id: 'farmland-hectares',
  name: { sv: 'Jordbruksmark', en: 'Farmland' },
  description: {
    sv: 'Areal åkermark och betesmark i kommunen, i hektar.',
    en: 'Area of arable land and pasture in the municipality, in hectares.',
  },
  unit: 'hectares',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: {
    from: FARMLAND_YEARS[0],
    to: FARMLAND_YEARS[FARMLAND_YEARS.length - 1]!,
    years: [...FARMLAND_YEARS],
  },
  caveat: {
    sv: 'En areal, inte en andel: en stor kommun har mer jordbruksmark än en liten även om åkern upptar en mindre del av den. Mätningen görs vart femte år och SCB har bytt metod under perioden, så en förändring mellan två mätpunkter kan delvis vara en mätförändring. Tabellen når tillbaka till 1951, men den punkten visas inte här – den skulle förlänga årsaxeln med sjutton år för varje mått på sajten för att visa ett enda värde till.',
    en: 'An area, not a share: a large municipality has more farmland than a small one even where the fields take up less of it. The survey is made every five years and SCB has changed method during the period, so a change between two points can partly be a change in measurement. The table reaches back to 1951, but that point is not shown here – it would stretch the year axis by seventeen years, for every measure on the site, to show one more value.',
  },
  sensitivity: 'none',
  sources: [
    {
      table: FARMLAND_TABLE,
      contentCode: '000006O6',
      note: { sv: '1981–2020, total jordbruksmark', en: '1981–2020, total farmland' },
    },
  ],
  derivation: {
    sv:
      'En SCB-cell per kommun och undersökningsår: TAB6002 vid markanvändningsklassen med ' +
      'etiketten ”total jordbruksmark”, som är åkermark plus betesmark och som SCB själv ' +
      'summerar. Ingenting summeras här.',
    en:
      'One SCB cell per municipality and survey year: TAB6002 at the land-use class labelled ' +
      '"total jordbruksmark", which is arable land plus pasture and which SCB totals itself. ' +
      'Nothing is summed here.',
  },
})

export const SHARE_BUILT: Indicator = Indicator.parse({
  id: 'share-land-built',
  name: { sv: 'Andel bebyggd mark', en: 'Share of land built on' },
  description: {
    sv: 'Andel av kommunens landareal som är bebyggd och anlagd mark – bostäder, verksamheter, vägar och annan anlagd yta.',
    en: 'Share of the municipality’s land area that is built on – housing, business, roads and other constructed surface.',
  },
  unit: 'percent',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: {
    from: LAND_USE_YEARS[0],
    to: LAND_USE_YEARS[LAND_USE_YEARS.length - 1]!,
    years: [...LAND_USE_YEARS],
  },
  caveat: {
    sv: 'Nämnaren är landarealen, så vatten räknas inte. Talet är litet nästan överallt: medianen är omkring 5 procent, den mest bebyggda kommunen ligger på 36 och trettiosex av 870 mätpunkter ligger under en procent. Det säger hur stor del av ytan som är bebyggd, inte hur många som bor där. Tre mätpunkter på elva år.',
    en: 'The denominator is land area, so water is not counted. The figure is small nearly everywhere: the median is about 5 percent, the most built-up municipality reaches 36, and thirty-six of 870 points fall below one percent. It says how much of the surface is built on, not how many people live there. Three survey points across eleven years.',
  },
  sensitivity: 'none',
  sources: [{ table: LAND_USE_TABLE, contentCode: '000002UN', note: neutral('2010, 2015, 2020') }],
  derivation: {
    sv:
      'Bebyggd och anlagd mark delat med total landareal, gånger 100 – två ' +
      'markanvändningsklasser i samma tabell, hämtade tillsammans och uppdelade efter klasskod – ' +
      'här kod snarare än etikett, eftersom bara ContentsCode pekas ut genom etikett och ' +
      'eftersom tabellen publicerar klass 3 med ett avslutande mellanslag i namnet.',
    en:
      'Built and constructed land over total land area, times 100 – two land-use classes of the ' +
      'same table, fetched together and partitioned by class code – code rather than label ' +
      'here, because only ContentsCode is keyed by label and because this table publishes class ' +
      '3 with a trailing space in its name.',
  },
})

export function farmlandDefined(): Definition {
  return {
    indicator: FARMLAND,
    sources: [
      {
        table: FARMLAND_TABLE,
        content: 'Jordbruksmark och skogsmark, hektar',
        years: [...FARMLAND_YEARS],
        dims: { Markanvandningsklass: { label: TOTAL_FARMLAND } },
        regions: 'known',
      },
    ],
    spec: { kind: 'direct' },
  }
}

export function shareBuiltDefined(): Definition {
  return {
    indicator: SHARE_BUILT,
    sources: [
      {
        table: LAND_USE_TABLE,
        content: 'Markanvändningen, hektar',
        years: [...LAND_USE_YEARS],
        dims: { Markanvandningsklass: { values: ['3', '911'] } },
        regions: 'known',
      },
    ],
    spec: {
      kind: 'share',
      over: 'Markanvandningsklass',
      numerator: [BUILT_LAND],
      times: 100,
    },
    shareOver: [BUILT_LAND, TOTAL_LAND],
  }
}

export const farmlandDefinition: IndicatorDefinition = {
  indicator: FARMLAND,
  build: (ctx) => buildDefined(farmlandDefined(), ctx),
}

export const shareBuiltDefinition: IndicatorDefinition = {
  indicator: SHARE_BUILT,
  build: (ctx) => buildDefined(shareBuiltDefined(), ctx),
}
