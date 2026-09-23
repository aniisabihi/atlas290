import { UNIT_DECIMALS, type IndicatorMeta, type ObservationStatus } from '../../shared/pantry'
import { UNIT_WORDS, withUnit } from '../../shared/units'
import type { Lang } from '../state/url'
import { t } from './strings'

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
export function priceBasisYear(indicator: IndicatorMeta): number | null {
  return indicator.priceBasis === 'fixed-latest-year' ? (indicator.priceBasisYear ?? null) : null
}

export function formatValue(value: number | null, indicator: IndicatorMeta, lang: Lang): string {
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

export function unitSuffix(indicator: IndicatorMeta, lang: Lang): string {
  return UNIT_WORDS[indicator.unit][lang]
}

export function formatWithUnit(value: number | null, indicator: IndicatorMeta, lang: Lang): string {
  const number = formatValue(value, indicator, lang)
  if (value === null) return number
  // How a unit joins its number is shared with the kitchen, which writes figures into the facts.
  const base = withUnit(number, indicator.unit, lang)
  const year = priceBasisYear(indicator)
  if (year === null) return base
  // Money is adjusted for inflation, so the figure is meaningless without saying to when.
  return lang === 'sv' ? `${base} (${year} års penningvärde)` : `${base} (in ${year} kronor)`
}

/**
 * A site-only seventh state, deliberately not in the pantry's own status enum.
 *
 * The pantry stores a status byte per published cell. A year an indicator never covered has no
 * cell at all — mean age has no 1970 column, not a 1970 column marked missing — so the site has
 * to name that case itself. Calling it 'not-yet-published' would imply SCB intends to publish
 * 1970 mean age one day, which it does not.
 */
export const OUTSIDE_COVERAGE = 'outside-coverage'
export type CellStatus = ObservationStatus | typeof OUTSIDE_COVERAGE

const STATUS: Record<CellStatus, Record<Lang, string>> = {
  [OUTSIDE_COVERAGE]: {
    sv: 'måttet publiceras inte för det här året',
    en: 'this measure is not published for this year',
  },
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
  // Deliberately about the THING rather than about the publishing. "Not published" would say
  // a figure exists somewhere; this says there is nothing here to count.
  'nothing-to-count': {
    sv: 'det som mäts finns inte i den här kommunen',
    en: 'what this measures does not exist in this municipality',
  },
}

export function statusPhrase(status: CellStatus, lang: Lang): string {
  return STATUS[status][lang]
}

/**
 * What this indicator publishes for, as one phrase — "1968–2025", or for a sparse one
 * "2015 and 2020" or "15 separate years between 1973 and 2022".
 *
 * Plan 19. One function rather than three, because `AboutIndicator`, `EmptyYear` and the
 * slider's `aria-valuetext` all make this claim and a reader who hears two of them should not
 * hear two different things.
 */
export function coveragePhrase(indicator: IndicatorMeta, lang: Lang): string {
  const strings = t(lang)
  const { from, to, years } = indicator.coverage
  if (!years) return strings.coverage(from, to)
  // Four is where a list stops reading as a list. Below it the years themselves are the most
  // useful thing to say; above it a count and a span are, and the slider shows the rest.
  return years.length <= 4
    ? `${years.slice(0, -1).join(', ')} ${strings.and} ${years[years.length - 1]}`
    : strings.coverageYearsMany(years.length, from, to)
}

/** The sentence `EmptyYear` and the slider both say when the chosen year has nothing in it. */
export function notPublishedSentence(indicator: IndicatorMeta, lang: Lang): string {
  const strings = t(lang)
  const { from, to, years } = indicator.coverage
  return years
    ? strings.notPublishedForYears(indicator.name[lang], coveragePhrase(indicator, lang))
    : strings.notPublishedFor(indicator.name[lang], from, to)
}
