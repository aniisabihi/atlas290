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
  tagline: 'Sveriges alla kommuner, mått för mått, 1968–2026. Allt från SCB.',
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
  cartogramLabel: 'Bubbeldiagram över Sveriges kommuner, storlek efter folkmängd',
  mapHint: 'Använd piltangenterna för att gå mellan grannkommuner. Enter väljer, Escape rensar.',
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
  searchPlaceholder: 'Skriv ett kommunnamn',
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
  comparePlaceholder: 'Skriv en annan kommun',
  stopComparing: 'Sluta jämföra',
  higherOn: (n: number, outOf: number) => `Högre värde i ${n} av ${outOf} jämförbara mått`,
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
    `Närmast över ${n} mått, ${from}–${to}. Ingen inbördes ordning — skillnaden mellan den femte och den sjätte är för liten för att betyda något.`,
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
    'Every municipality in Sweden, measure by measure, 1968–2026. All from Statistics Sweden.',
  skipToMap: 'Skip to the map',
  skipToTable: 'Skip to the table',

  otherLanguage: 'Svenska',
  switchLanguage: 'Svenska — switch language to Swedish',

  viewGroup: 'View',
  tableToggle: 'Table',
  noWinner:
    'No verdict is offered here, and none will be. Whether a lower tax rate suits you more than a higher one, or a younger population more than an older one, depends on what you are for. Both figures are shown; the judgement is yours.',
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
  cartogramLabel: 'Bubble chart of Sweden by municipality, sized by population',
  mapHint:
    'Use the arrow keys to move between neighbouring municipalities. Enter selects, Escape clears.',
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

  searchLabel: 'Search for a municipality',
  searchPlaceholder: 'Type a municipality name',
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
  comparePlaceholder: 'Type another municipality',
  stopComparing: 'Stop comparing',
  higherOn: (n: number, outOf: number) => `Higher on ${n} of ${outOf} comparable measures`,
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
    `Closest across ${n} measures, ${from}–${to}. In no particular order — the gap between the fifth and the sixth is too small to mean anything.`,
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
