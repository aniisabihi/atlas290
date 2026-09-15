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
  siteName: 'Sveriges kommuner i data',
  tagline: 'Tio mått, 290 kommuner, 1968–2026. Allt från SCB.',
  skipToMap: 'Hoppa till kartan',
  skipToTable: 'Hoppa till tabellen',

  otherLanguage: 'English',
  switchLanguage: 'English — byt språk till engelska',

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
  notPublishedFor: (indicator: string, from: number, to: number) =>
    `${indicator} publiceras för ${from}–${to}. Det finns inget att visa för det här året.`,
  jumpToYear: (year: number) => `Gå till ${year}`,

  rank: (rank: number, outOf: number) => `plats ${rank} av ${outOf}`,
  selectionCleared: 'Ingen kommun vald.',
  and: 'och',
  noticesHeading: 'Källor och licenser',
  noticesData: 'Data',
  noticesBoundaries: 'Kommungränser',
  noticesLibraries: 'Programbibliotek',
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
  siteName: "Sweden's municipalities in data",
  tagline: 'Ten measures, 290 municipalities, 1968–2026. All from Statistics Sweden.',
  skipToMap: 'Skip to the map',
  skipToTable: 'Skip to the table',

  otherLanguage: 'Svenska',
  switchLanguage: 'Svenska — switch language to Swedish',

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
  notPublishedFor: (indicator: string, from: number, to: number) =>
    `${indicator} is published for ${from}–${to}. There is nothing to show for this year.`,
  jumpToYear: (year: number) => `Go to ${year}`,

  rank: (rank: number, outOf: number) => `rank ${rank} of ${outOf}`,
  selectionCleared: 'No municipality selected.',
  and: 'and',
  noticesHeading: 'Sources and licences',
  noticesData: 'Data',
  noticesBoundaries: 'Municipal boundaries',
  noticesLibraries: 'Libraries',
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
