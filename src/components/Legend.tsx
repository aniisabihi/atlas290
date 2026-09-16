import { statusesIn, type Lookup } from '../data/select'
import {
  formatValue,
  priceBasisYear,
  statusPhrase,
  unitSuffix,
  type CellStatus,
} from '../i18n/format'
import { t } from '../i18n/strings'
import { NO_VALUE_FILLS, paletteFor, zeroClassOf, type NoValueStatus } from '../map/colour'
import type { Lang } from '../state/url'

/**
 * Where the honesty lives.
 *
 * The classes carry their real break values, and the absence keys list only what actually occurs
 * in the year on screen — a "too few sales" key on the population map would be noise, and a
 * legend that never changes teaches the reader to stop reading it.
 */

const SWATCH = 18

function PatternSwatch({ status }: { status: NoValueStatus }) {
  const fill = NO_VALUE_FILLS[status]
  return (
    <svg width={SWATCH} height={SWATCH} aria-hidden="true" className="legend-swatch">
      <rect width={SWATCH} height={SWATCH} fill={`url(#${fill.patternId})`} stroke="#bbb" />
    </svg>
  )
}

export function Legend({
  lk,
  indicatorId,
  year,
  lang,
  highlightClass = null,
}: {
  lk: Lookup
  indicatorId: string
  year: number
  lang: Lang
  /**
   * The class the municipality under the pointer falls in, marked so the ramp answers "how big
   * is that, then" without the visitor reading seven break values. Visual only: the class is
   * already in the shape's accessible name and in the live region.
   */
  highlightClass?: number | null
}) {
  const indicator = lk.indicator(indicatorId)
  const strings = t(lang)
  const statuses = statusesIn(lk, indicatorId, year)

  // Nothing at all is published this year, so there are no classes to explain. The map shows its
  // empty state instead and a legend of seven unused colours would only be in the way.
  if (statuses.size === 1 && statuses.has('outside-coverage')) return null

  const breaks = indicator.scale.breaks
  const fills = paletteFor(indicator)
  const zeroClass = zeroClassOf(indicator)
  const basis = priceBasisYear(indicator)
  const label = (value: number) => formatValue(value, indicator, lang)

  const absences = [...statuses].filter(
    (s): s is NoValueStatus => s !== 'present' && s !== 'perturbed',
  )

  return (
    <section className="legend" aria-labelledby="legend-heading">
      <h2 id="legend-heading">{strings.legendHeading}</h2>
      <p className="legend-unit">
        {unitSuffix(indicator, lang)}
        {basis !== null && (lang === 'sv' ? `, ${basis} års penningvärde` : `, in ${basis} kronor`)}
      </p>
      <ul aria-label={strings.legendClasses}>
        {fills.map((fill, klass) => {
          const from = klass === 0 ? null : breaks[klass - 1]!
          const to = klass === breaks.length ? null : breaks[klass]!
          const text =
            from === null
              ? strings.legendUnder(label(to!))
              : to === null
                ? strings.legendOver(label(from))
                : strings.legendRange(label(from), label(to))
          return (
            <li key={fill} data-highlight={klass === highlightClass ? 'true' : undefined}>
              <span className="legend-swatch" style={{ background: fill }} aria-hidden="true" />
              {text}
              {klass === zeroClass && <em className="legend-zero"> — {strings.legendZero}</em>}
            </li>
          )
        })}
      </ul>
      {absences.length > 0 && (
        <ul className="legend-absences" aria-label={strings.legendAbsences}>
          {absences.map((status) => (
            <li key={status}>
              <PatternSwatch status={status} />
              {statusPhrase(status as CellStatus, lang)}
            </li>
          ))}
        </ul>
      )}
      {statuses.has('perturbed') && <p className="legend-note">{strings.legendPerturbedNote}</p>}
    </section>
  )
}
