import type { Lookup } from '../data/select'
import { t } from '../i18n/strings'
import type { AppState } from './url'

/**
 * What the browser tab says, and what a screen reader announces on arrival.
 *
 * A link that says "Sweden's municipalities in data" in every tab tells the person you sent it to
 * nothing at all. The municipality comes first where one is selected, because that is what the
 * visitor came for; the site's own name comes last, where a truncated tab drops it harmlessly.
 */
export function titleFor(lk: Lookup, state: AppState): string {
  const strings = t(state.lang)
  const nameOf = (code: string) => lk.municipality(code)?.name[state.lang] ?? code

  const parts: string[] = []

  if (state.selected) {
    parts.push(
      state.compare
        ? `${nameOf(state.selected)} ${strings.and} ${nameOf(state.compare)}`
        : nameOf(state.selected),
    )
  }

  const indicator = lk.indicator(state.indicator).name[state.lang]
  const qualifier = state.table
    ? ` (${strings.tableView})`
    : state.view === 'cartogram'
      ? ` (${strings.cartogramView})`
      : ''
  parts.push(`${indicator} ${state.year}${qualifier}`)
  parts.push(strings.siteName)

  return parts.join(' · ')
}
