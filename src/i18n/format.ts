import { UNIT_DECIMALS, type Indicator, type ObservationStatus } from '../../shared/pantry'
import type { Lang } from '../state/url'

/**
 * Every number and unit the site shows, in both languages.
 *
 * Decimal places come from the shared `UNIT_DECIMALS`, the same table the kitchen rounds with,
 * so what is displayed is exactly what is stored — never a digit the pantry does not contain,
 * and never one it does.
 */

const LOCALE: Record<Lang, string> = { sv: 'sv-SE', en: 'en-GB' }

/** Absence is a dash, never a zero and never a blank that could pass for one. */
export const ABSENT = '–'

/** Which year's kronor a money value is expressed in, or null if it is not money. */
export function priceBasisYear(indicator: Indicator): number | null {
  return indicator.priceBasis === 'fixed-latest-year' ? (indicator.priceBasisYear ?? null) : null
}

export function formatValue(value: number | null, indicator: Indicator, lang: Lang): string {
  if (value === null) return ABSENT
  const decimals = UNIT_DECIMALS[indicator.unit]
  return new Intl.NumberFormat(LOCALE[lang], {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    // A diverging indicator is about direction as much as magnitude: "+6.15" and "6.15" say
    // different things to someone scanning a map of net migration. Zero takes no sign, because
    // it has no direction to state.
    signDisplay: indicator.scale.kind === 'diverging' ? 'exceptZero' : 'auto',
  }).format(value)
}

const UNITS: Record<Indicator['unit'], Record<Lang, string>> = {
  count: { sv: 'invånare', en: 'residents' },
  percent: { sv: '%', en: '%' },
  years: { sv: 'år', en: 'years' },
  sek: { sv: 'kr', en: 'SEK' },
  'per-thousand': { sv: 'per 1 000 invånare', en: 'per 1,000 residents' },
  'per-km2': { sv: 'inv/km²', en: 'people/km²' },
}

export function unitSuffix(indicator: Indicator, lang: Lang): string {
  return UNITS[indicator.unit][lang]
}

/** A percent sign hugs its number; a word does not. */
const TIGHT: ReadonlySet<Indicator['unit']> = new Set(['percent'])

export function formatWithUnit(value: number | null, indicator: Indicator, lang: Lang): string {
  const number = formatValue(value, indicator, lang)
  if (value === null) return number
  const unit = unitSuffix(indicator, lang)
  const base = TIGHT.has(indicator.unit) ? `${number}${unit}` : `${number} ${unit}`
  const year = priceBasisYear(indicator)
  if (year === null) return base
  // Money is adjusted for inflation, so the figure is meaningless without saying to when.
  return lang === 'sv' ? `${base} (${year} års penningvärde)` : `${base} (in ${year} kronor)`
}

const STATUS: Record<ObservationStatus, Record<Lang, string>> = {
  present: { sv: 'publicerat värde', en: 'published value' },
  'not-yet-published': {
    sv: 'inte publicerat för det här året',
    en: 'not published for this year',
  },
  'did-not-exist': { sv: 'kommunen fanns inte då', en: 'the municipality did not exist then' },
  perturbed: {
    sv: 'SCB har lagt till slumpmässigt brus i värdet',
    en: 'Statistics Sweden has added random noise to this value',
  },
  'too-few-cases': {
    sv: 'för få försäljningar för att redovisas',
    en: 'too few sales to report',
  },
  'structural-break': {
    sv: 'förändringen beror på en ändrad kommungräns, inte på att någon flyttat',
    en: 'the change comes from a redrawn boundary, not from anyone moving',
  },
}

export function statusPhrase(status: ObservationStatus, lang: Lang): string {
  return STATUS[status][lang]
}
