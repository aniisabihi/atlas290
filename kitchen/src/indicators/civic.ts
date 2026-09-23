import { Indicator } from '../../../shared/pantry'
import { buildDefined, type Definition } from './define'
import { type IndicatorDefinition } from './registry'
import { neutral } from './prose'

export const COUNCILLORS_TABLE = 'TAB708'

/**
 * A mandate period pinned to the year the council is seated.
 *
 * `TAB708.Tid` carries `2007-2010` through `2023-2026` — five mandate periods, not years, which
 * `IndicatorSeries.years` cannot hold. The fifth slice design's D6 pins each period to a
 * representative year, and for a mandate that is its FIRST: 2023 is when the council elected in
 * 2022 takes its seats. Unlike life expectancy's overlapping windows, these do not overlap, so
 * pinning leaves a genuinely sparse series — five values across seventeen years, which is what
 * the rest of plan 19 exists to render.
 */
export const MANDATE_YEARS = [2007, 2011, 2015, 2019, 2023] as const

/** The `Tid` code a pinned year stands for: 2023 asks for `2023-2026`. */
const mandateFrom = (year: number) => `${year}-${year + 3}`

const WOMEN = '030'

/**
 * Which of `BakgrVar`'s seven totals, settled by reading the data rather than assuming.
 *
 * `BakgrVar` is one dimension holding seven separate cross-tabulations — age, children under 6
 * and under 18, marital status, education, birth country, income quintile — each with its own
 * "samtliga" code, and `TOTAL_CODES` knows none of them. The fifth slice design promised the
 * choice would be made by checking. Six of the seven agree — Stockholm's 2023-2026 council is
 * 287 representatives under all of them — and the seventh, `samutb`, is 262, because education
 * is the one background variable that leaves people unclassified. `samald` is taken: it agrees
 * with the majority and it classifies everybody. `kitchen/spikes/probe-708.ts` reproduces it.
 */
const ALL_AGES = 'samald'

export const COUNCILLORS_WOMEN: Indicator = Indicator.parse({
  id: 'councillors-women-share',
  name: { sv: 'Andel kvinnor bland förtroendevalda', en: 'Share of councillors who are women' },
  description: {
    sv: 'Andel av kommunens förtroendevalda som är kvinnor, per mandatperiod.',
    en: 'Share of the municipality’s elected representatives who are women, per mandate period.',
  },
  unit: 'percent',
  priceBasis: 'none',
  // Sequential, not diverging. Plan 19 declared this diverging and plan 20 found the mistake:
  // the values run 24 to 58 and never approach zero, so the legend was marking a zero class
  // twenty-four points outside the data and the map drew a signed ramp for an unsigned measure.
  // Parity at 50 would be a defensible midpoint, but naming one would be the "higher is better"
  // flag this project does not have — the other shares are sequential and so is this.
  scale: { kind: 'sequential', breaks: [] },
  coverage: {
    from: MANDATE_YEARS[0],
    to: MANDATE_YEARS[MANDATE_YEARS.length - 1]!,
    years: [...MANDATE_YEARS],
  },
  caveat: {
    sv: 'Varje värde avser en hel mandatperiod och redovisas här under periodens första år, alltså det år fullmäktige tillträder: 2023 är mandatperioden 2023–2026. Måttet räknar alla förtroendevalda uppdrag i kommunen, inte bara fullmäktigeledamöter, och säger ingenting om vilka uppdrag de har — ordförandeposter är ojämnare fördelade än ledamotsplatser. Sju kommuner saknar värde för 2023–2026.',
    en: 'Each value covers a whole mandate period and is published here under that period’s first year, the year the council takes its seats: 2023 is the 2023–2026 period. The measure counts every elected position in the municipality, not only council seats, and says nothing about which positions they are — chairs are less evenly divided than ordinary seats. Seven municipalities have no value for 2023–2026.',
  },
  sensitivity: 'none',
  sources: [
    { table: COUNCILLORS_TABLE, contentCode: '0000009U', note: neutral('(2007-2010)–(2023-2026)') },
  ],
  derivation: {
    sv:
      'En SCB-cell per kommun och mandatperiod: TAB708:s egen ”Könsfördelning bland ' +
      'förtroendevalda” för kvinnor, vid bakgrundstotalen som räknar alla åldrar. Andelen är ' +
      'SCB:s och beräknas inte här. Bakgrundstotalen är `samald`, eftersom tabellens sju ' +
      '”samtliga”-koder inte är överens: sex av de sju ger samma siffra och `samutb` ger färre, ' +
      'eftersom utbildning lämnar en del förtroendevalda oklassade.',
    en:
      'One SCB cell per municipality and mandate period: TAB708’s own "Könsfördelning bland ' +
      'förtroendevalda" for women, at the background total that counts all ages. The share is ' +
      'SCB’s, not computed here. The background total is `samald` because the table’s seven ' +
      '"samtliga" codes do not all agree: six of the seven give the same figure and `samutb` ' +
      'gives fewer, because education leaves some representatives unclassified.',
  },
})

export function councillorsWomenDefined(): Definition {
  return {
    indicator: COUNCILLORS_WOMEN,
    sources: [
      {
        table: COUNCILLORS_TABLE,
        content: 'Könsfördelning bland förtroendevalda',
        years: [...MANDATE_YEARS],
        period: mandateFrom,
        dims: { Kon: { values: [WOMEN] }, BakgrVar: { values: [ALL_AGES] } },
        regions: 'known',
      },
    ],
    spec: { kind: 'direct' },
  }
}

export const councillorsWomenDefinition: IndicatorDefinition = {
  indicator: COUNCILLORS_WOMEN,
  build: (ctx) => buildDefined(councillorsWomenDefined(), ctx),
}
