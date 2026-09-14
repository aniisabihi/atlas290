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

  otherLanguage: 'English',
  switchLanguage: 'Byt språk till engelska',

  mapLabel: 'Karta över Sveriges kommuner',
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
  cartogramView: 'bubbeldiagram',
  tableView: 'tabell',
  showMap: 'Karta',
  showCartogram: 'Bubblor',
  showTable: 'Visa tabell',
  hideTable: 'Visa karta',
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

  otherLanguage: 'Svenska',
  switchLanguage: 'Switch language to Swedish',

  mapLabel: 'Map of Sweden by municipality',
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
  cartogramView: 'bubble chart',
  tableView: 'table',
  showMap: 'Map',
  showCartogram: 'Bubbles',
  showTable: 'Show table',
  hideTable: 'Show map',
  announcement: (name: string, indicator: string, year: number, reading: string) =>
    `${name}, ${indicator} ${year}: ${reading}.`,
}

const TABLES: Record<Lang, Strings> = { sv, en }

export function t(lang: Lang): Strings {
  return TABLES[lang]
}
