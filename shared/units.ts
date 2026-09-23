import type { Bilingual, Indicator } from './pantry'

/**
 * What every unit is called, in both languages, and how a figure and its unit are joined.
 *
 * Shared because two programs write figures for visitors to read: the site, beside every value
 * it shows, and the kitchen, inside the five published facts. Until the editorial pass the table
 * lived in the site alone, so the facts quoted bare numbers — "6 529,2 mot 0,2" for population
 * density — while the profile beside them said "inv/km²". One table is the only way the two
 * cannot disagree about what a unit is called.
 */
export const UNIT_WORDS: Record<Indicator['unit'], Bilingual> = {
  count: { sv: 'invånare', en: 'residents' },
  percent: { sv: '%', en: '%' },
  years: { sv: 'år', en: 'years' },
  sek: { sv: 'kr', en: 'SEK' },
  'per-thousand': { sv: 'per 1 000 invånare', en: 'per 1,000 residents' },
  'per-km2': { sv: 'inv/km²', en: 'people/km²' },
  'children-per-woman': { sv: 'barn per kvinna', en: 'children per woman' },
  'tonnes-per-resident': { sv: 'ton per invånare', en: 'tonnes per resident' },
  'persons-per-household': { sv: 'personer per hushåll', en: 'persons per household' },
  metres: { sv: 'm', en: 'm' },
  hectares: { sv: 'hektar', en: 'hectares' },
  'percentage-points': { sv: 'procentenheter', en: 'percentage points' },
}

/**
 * A formatted number and its unit.
 *
 * The percent sign is the one unit the two languages set differently. English hugs it — "32.42%".
 * Swedish separates it with a space, as Språkrådet and SCB's own publications do — "32,42 %" —
 * and the facts the kitchen writes always had it that way while the profile beside them did not.
 * The space is non-breaking, so the sign can never start a line of its own.
 */
export function withUnit(number: string, unit: Indicator['unit'], lang: keyof Bilingual): string {
  const word = UNIT_WORDS[unit][lang]
  if (unit === 'percent') return lang === 'sv' ? `${number} ${word}` : `${number}${word}`
  return `${number} ${word}`
}
