import { nearestCoveredYear, type Lookup } from '../data/select'
import { notPublishedSentence } from '../i18n/format'
import { t } from '../i18n/strings'
import type { Lang } from '../state/url'

/**
 * What the map says when the chosen indicator publishes nothing for the chosen year.
 *
 * The URL is honoured rather than clamped, because clamping would silently rewrite a link someone
 * shared and would hide the fact that the indicators do not cover the same span. So the state
 * is legal and this explains it, with one click to the nearest year that does have data — which
 * may be forward or back: median income stops in 2024 while the axis runs to 2026.
 *
 * Plan 19: "this year" now means a year the indicator does not HAVE, which for a sparse measure
 * is usually inside its range rather than outside it — turnout's 1974 sits between two elections.
 */
export function EmptyYear({
  lk,
  indicatorId,
  year,
  lang,
  onYear,
}: {
  lk: Lookup
  indicatorId: string
  year: number
  lang: Lang
  onYear: (year: number) => void
}) {
  const indicator = lk.indicator(indicatorId)
  const strings = t(lang)
  const nearest = nearestCoveredYear(indicator, year)
  return (
    <div className="empty-year">
      <p>{notPublishedSentence(indicator, lang)}</p>
      <button type="button" onClick={() => onYear(nearest)}>
        {strings.jumpToYear(nearest)}
      </button>
    </div>
  )
}
