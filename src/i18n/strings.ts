import type { Lang } from '../state/url'

/**
 * Every string the site's own chrome needs, in both languages.
 *
 * The Swedish table is the source of the type: `Strings` is `typeof sv`, so the English table
 * must carry exactly the same keys with exactly the same shapes, and a string added to one
 * language and not the other fails `yarn typecheck` rather than shipping as a blank label.
 *
 * Indicator names, descriptions and caveats are NOT here — they come from the pantry, in both
 * languages, written by the kitchen alongside the numbers they describe.
 */

const sv = {
  // The one string that is deliberately identical in both languages. A site that is equally
  // Swedish and English cannot have a name that reads as foreign in half of it, and the number
  // says the same thing in both. See docs/decisions/0006-the-name.md.
  siteName: 'Atlas 290',
  // No end year. "1968–2026" was written by hand and would have gone stale at the first
  // refresh that added a year, and at column width it broke across lines after the dash.
  tagline: 'Sveriges 290 kommuner, mått för mått, från 1968 till i dag. Allt från SCB.',
  skipToMap: 'Hoppa till kartan',
  skipToTable: 'Hoppa till tabellen',

  otherLanguage: 'English',
  switchLanguage: 'English — byt språk till engelska',

  // The label says what pressing it DOES, not what the page currently is.
  viewGroup: 'Vy',
  tableToggle: 'Tabell',
  // Said out loud, not merely left undone: refusing to rank was a decision, and a design that
  // only omits the arrows looks like one that forgot them.
  noWinner:
    'Ingen dom fälls här, och ingen kommer att fällas. Om en lägre skattesats passar dig framför en högre, eller en yngre befolkning framför en äldre, beror på vad du är ute efter. Båda siffrorna visas; bedömningen är din.',
  bothOverTime: 'Båda, över tid',

  // What each fact family looks for. Shown above the sentence it produced, because the five
  // facts are not a sequence and numbering them would be decoration pretending to be structure.
  familyCountry: 'hela landet',
  familyRun: 'en obruten serie',
  familyReversal: 'en vändning',
  familyUnusual: 'mot sina likar',
  familyExtreme: 'ytterkanterna',
  themeToDark: 'Mörkt',
  themeToLight: 'Ljust',
  switchToDark: 'Byt till mörkt utseende',
  switchToLight: 'Byt till ljust utseende',

  mapLabel: 'Karta över Sveriges kommuner',
  // The measure's name goes in, because the bubbles are sized by whatever measure is drawn —
  // the label has to say which, or "sized by" would be a claim with nothing behind it.
  cartogramLabel: (measure: string) =>
    `Bubbeldiagram över Sveriges kommuner, storlek efter ${measure.toLocaleLowerCase('sv')}`,
  mapHint: 'Använd piltangenterna för att gå mellan grannkommuner. Enter väljer, Escape rensar.',
  // What the bubbles' sizes mean. Said beside the picture rather than left to be inferred: the
  // size follows the value within the year on screen, and a municipality with no value that
  // year gets the smallest bubble rather than none at all.
  cartogramHint:
    'Varje bubblas yta följer måttets värde det här året, från årets lägsta till dess högsta. En kommun utan värde får den minsta bubblan.',
  // Not "klicka": the table is the phone's view as often as the desktop's, and a tap is not a
  // click. The heading and the name are both buttons, so "välj" is true of every input.
  tableHint: 'Sortera med kolumnrubrikerna. Välj en kommun för att öppna den.',
  noNeighbour: 'Ingen grannkommun åt det hållet.',

  indicatorLegend: 'Mått',
  legendHeading: 'Teckenförklaring',
  legendZero: 'noll ligger här',
  legendClasses: 'Färgklasser',
  legendAbsences: 'Varför värden saknas',
  legendUnder: (value: string) => `under ${value}`,
  legendRange: (from: string, to: string) => `${from}–${to}`,
  legendOver: (value: string) => `${value} och över`,
  legendPerturbedNote:
    'Från 2025 lägger SCB till slumpmässigt brus i folkmängden. Värdena visas ändå, med sin egen färg.',

  yearLabel: 'År',
  play: 'Spela',
  pause: 'Pausa',

  searchLabel: 'Sök kommun',
  // Short, because on a phone the label is visually hidden and this is what shows — and at
  // 320 px "Skriv ett kommunnamn" was cut to "Skriv ett kommun".
  searchPlaceholder: 'Skriv ett namn',
  searchNoResults: 'Ingen kommun matchar.',
  searchResults: (n: number) => `${n} träffar`,
  searchOne: 'En träff',

  aboutHeading: 'Om det här måttet',
  coverageHeading: 'Publiceras för',
  sourcesHeading: 'Källor hos SCB',
  derivationHeading: 'Så är värdet beräknat',
  caveatHeading: 'Att tänka på',

  coverage: (from: number, to: number) => `${from}–${to}`,
  /**
   * What a SPARSE indicator publishes for. Plan 19: "1973–2022" is true of turnout and tells
   * the reader nothing about the fourteen empty years between each pair of values.
   *
   * Two forms, because few enough years read better listed outright — "2 enskilda år mellan
   * 2015 och 2020" is a worse sentence than "2015 och 2020". Which form is used is decided in
   * `coveragePhrase`; this table holds the copy and the conjunction, not the rule.
   */
  coverageYearsMany: (count: number, from: number, to: number) =>
    `${count} enskilda år mellan ${from} och ${to}`,
  notPublishedFor: (indicator: string, from: number, to: number) =>
    `${indicator} publiceras för ${from}–${to}. Det finns inget att visa för det här året.`,
  notPublishedForYears: (indicator: string, coverage: string) =>
    `${indicator} publiceras för ${coverage}. Det finns inget att visa för det här året.`,
  jumpToYear: (year: number) => `Gå till ${year}`,

  rank: (rank: number, outOf: number) => `plats ${rank} av ${outOf}`,
  // In the table, under a column already headed "Plats": saying "plats" again in every one of
  // 290 cells wrapped the column onto three lines on a phone.
  rankCell: (rank: number, outOf: number) => `${rank} av ${outOf}`,
  selectionCleared: 'Ingen kommun vald.',
  and: 'och',
  noticesHeading: 'Källor och licenser',
  noticesData: 'Data',
  noticesBoundaries: 'Kommungränser',
  noticesLibraries: 'Programbibliotek',
  noticesFonts: 'Typsnitt',
  noticesCode: 'Koden',
  factsHeading: 'Sådant du inte tänkt fråga om',
  tableCaption: (indicator: string, year: number) => `${indicator}, ${year}`,
  columnMunicipality: 'Kommun',
  columnValue: 'Värde',
  columnRank: 'Plats',
  sortBy: (column: string) => `Sortera efter ${column}`,
  compareWith: 'Jämför med…',
  // The label beside it already says what the name is for; the placeholder only has to fit.
  comparePlaceholder: 'Skriv ett namn',
  stopComparing: 'Sluta jämföra',
  // The name goes INTO the sentence rather than before a colon: "Malmö: Högre värde i …" set a
  // capital after a colon and read as a label that had lost its sentence.
  higherOn: (name: string, n: number, outOf: number) =>
    `${name} har högre värde i ${n} av ${outOf} jämförbara mått`,
  notComparable: (n: number) =>
    n === 1
      ? '1 mått går inte att jämföra det här året'
      : `${n} mått går inte att jämföra det här året`,
  close: 'Stäng',
  closeProfile: 'Stäng kommunpanelen',
  atTheTime: (value: string, year: number) => `${value} i ${year} års penningvärde`,
  noValueThisYear: 'Inget värde för det här året',
  cartogramView: 'bubbeldiagram',
  tableView: 'tabell',
  showMap: 'Karta',
  showCartogram: 'Bubblor',
  showTable: 'Visa tabell',
  hideTable: 'Visa karta',
  similarHeading: 'Platser som liknar den här',
  similarMethod: (n: number, from: number, to: number) =>
    `Mest lika sett till ${n} mått, ${from}–${to}. Ingen inbördes ordning — skillnaden mellan den femte och den sjätte är för liten för att betyda något.`,
  similarNone: 'Inga jämförbara platser i den här utgåvan.',
  goTo: (name: string) => `Gå till ${name}`,
  storyHeading: 'Kort om kommunen',
  announcement: (name: string, indicator: string, year: number, reading: string) =>
    `${name}, ${indicator} ${year}: ${reading}.`,
} satisfies Record<string, string | ((...args: never[]) => string)>

// Deliberately NOT `as const`: that would make every Swedish value its own string-literal type,
// so no English translation could ever be assignable to it and the module would simply never
// typecheck — while the runtime tests carried on passing, because vitest does not typecheck.

export type Strings = typeof sv

const en: Strings = {
  siteName: 'Atlas 290',
  tagline:
    'Sweden’s 290 municipalities, measure by measure, from 1968 to today. All from Statistics Sweden.',
  skipToMap: 'Skip to the map',
  skipToTable: 'Skip to the table',

  otherLanguage: 'Svenska',
  switchLanguage: 'Svenska — switch language to Swedish',

  viewGroup: 'View',
  tableToggle: 'Table',
  noWinner:
    'No verdict is offered here, and none will be. Whether a lower tax rate suits you more than a higher one, or a younger population more than an older one, depends on what you are after. Both figures are shown; the judgement is yours.',
  bothOverTime: 'Both, over time',

  familyCountry: 'the whole country',
  familyRun: 'an unbroken run',
  familyReversal: 'a turn',
  familyUnusual: 'against its peers',
  familyExtreme: 'the far ends',
  themeToDark: 'Dark',
  themeToLight: 'Light',
  switchToDark: 'Switch to the dark theme',
  switchToLight: 'Switch to the light theme',

  mapLabel: 'Map of Sweden by municipality',
  cartogramLabel: (measure: string) =>
    `Bubble chart of Sweden by municipality, sized by ${measure.toLocaleLowerCase('en')}`,
  mapHint:
    'Use the arrow keys to move between neighbouring municipalities. Enter selects, Escape clears.',
  cartogramHint:
    'The area of each bubble follows the measure’s value this year, from the year’s lowest to its highest. A municipality with no value gets the smallest bubble.',
  tableHint: 'Sort with the column headings. Choose a municipality to open it.',
  noNeighbour: 'No neighbouring municipality that way.',

  indicatorLegend: 'Measure',
  legendHeading: 'Legend',
  legendZero: 'zero falls here',
  legendClasses: 'Colour classes',
  legendAbsences: 'Why values are missing',
  legendUnder: (value: string) => `under ${value}`,
  legendRange: (from: string, to: string) => `${from}–${to}`,
  legendOver: (value: string) => `${value} and over`,
  legendPerturbedNote:
    'From 2025 Statistics Sweden adds random noise to population figures. The values are still shown, in their own colour.',

  yearLabel: 'Year',
  play: 'Play',
  pause: 'Pause',

  // As short as the Swedish "Sök kommun": it is set in capitals in the bar, where the longer
  // form took more room than the field it labelled.
  searchLabel: 'Search municipalities',
  searchPlaceholder: 'Type a name',
  searchNoResults: 'No municipality matches.',
  searchResults: (n: number) => `${n} matches`,
  searchOne: 'One match',

  aboutHeading: 'About this measure',
  coverageHeading: 'Published for',
  sourcesHeading: 'Sources at Statistics Sweden',
  derivationHeading: 'How the value is calculated',
  caveatHeading: 'Worth knowing',

  coverage: (from: number, to: number) => `${from}–${to}`,
  coverageYearsMany: (count: number, from: number, to: number) =>
    `${count} separate years between ${from} and ${to}`,
  notPublishedFor: (indicator: string, from: number, to: number) =>
    `${indicator} is published for ${from}–${to}. There is nothing to show for this year.`,
  notPublishedForYears: (indicator: string, coverage: string) =>
    `${indicator} is published for ${coverage}. There is nothing to show for this year.`,
  jumpToYear: (year: number) => `Go to ${year}`,

  rank: (rank: number, outOf: number) => `rank ${rank} of ${outOf}`,
  rankCell: (rank: number, outOf: number) => `${rank} of ${outOf}`,
  selectionCleared: 'No municipality selected.',
  and: 'and',
  noticesHeading: 'Sources and licences',
  noticesData: 'Data',
  noticesBoundaries: 'Municipal boundaries',
  noticesLibraries: 'Libraries',
  noticesFonts: 'Typefaces',
  noticesCode: 'The code',
  factsHeading: 'Things you did not think to ask',
  tableCaption: (indicator: string, year: number) => `${indicator}, ${year}`,
  columnMunicipality: 'Municipality',
  columnValue: 'Value',
  columnRank: 'Rank',
  sortBy: (column: string) => `Sort by ${column}`,
  compareWith: 'Compare with…',
  comparePlaceholder: 'Type a name',
  stopComparing: 'Stop comparing',
  higherOn: (name: string, n: number, outOf: number) =>
    `${name} is higher on ${n} of ${outOf} comparable measures`,
  notComparable: (n: number) =>
    n === 1
      ? '1 measure cannot be compared this year'
      : `${n} measures cannot be compared this year`,
  close: 'Close',
  closeProfile: 'Close the municipality panel',
  atTheTime: (value: string, year: number) => `${value} in ${year} kronor`,
  noValueThisYear: 'No value for this year',
  cartogramView: 'bubble chart',
  tableView: 'table',
  showMap: 'Map',
  showCartogram: 'Bubbles',
  showTable: 'Show table',
  hideTable: 'Show map',
  similarHeading: 'Places like this one',
  similarMethod: (n: number, from: number, to: number) =>
    `Most alike across ${n} measures, ${from}–${to}. In no particular order — the gap between the fifth and the sixth is too small to mean anything.`,
  similarNone: 'No comparable places in this release.',
  goTo: (name: string) => `Go to ${name}`,
  storyHeading: 'In short',
  announcement: (name: string, indicator: string, year: number, reading: string) =>
    `${name}, ${indicator} ${year}: ${reading}.`,
}

const TABLES: Record<Lang, Strings> = { sv, en }

export function t(lang: Lang): Strings {
  return TABLES[lang]
}
