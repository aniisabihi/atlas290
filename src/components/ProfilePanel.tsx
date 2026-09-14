import { useEffect, useRef } from 'react'
import { observationAt, rankOf, type Lookup } from '../data/select'
import { nominalOf } from '../data/nominal'
import { formatWithUnit, statusPhrase } from '../i18n/format'
import { t } from '../i18n/strings'
import type { Lang } from '../state/url'
import { Sparkline } from './Sparkline'

/**
 * Everything the pantry knows about one municipality, in one place.
 *
 * **Not a dialog.** No `role="dialog"`, no focus trap, and the map stays reachable behind it —
 * DESIGN section 5 asks for a non-modal panel, and trapping focus in a panel that sits beside the
 * thing it describes would stop a visitor comparing the two.
 *
 * Focus moves to the heading when it opens, so a screen reader lands on "Stockholm" rather than
 * being left wherever it was on a page that has just changed underneath it.
 */
export function ProfilePanel({
  lk,
  code,
  year,
  lang,
  onClose,
  asSheet = false,
}: {
  lk: Lookup
  code: string
  year: number
  lang: Lang
  onClose: () => void
  /** On a narrow screen the panel arrives as a bottom sheet rather than a column. */
  asSheet?: boolean
}) {
  const strings = t(lang)
  const heading = useRef<HTMLHeadingElement>(null)
  const municipality = lk.municipality(code)

  // Re-runs when the municipality changes, which is the point: opening a different profile has
  // to move focus again, not leave it on a heading that now says something else.
  useEffect(() => {
    const el = heading.current
    if (el && code) el.focus()
  }, [code])

  if (!municipality) return null

  return (
    <section
      className={asSheet ? 'profile panel profile--sheet' : 'profile panel'}
      aria-labelledby="profile-heading"
      // Escape closes it, like any dismissible surface. It is still not modal: focus is not
      // trapped, and the view behind stays reachable with Tab.
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <div className="profile-header">
        {/*
         * tabIndex -1 so focus can be moved here programmatically without adding a tab stop that
         * a keyboard visitor would then have to pass through on every pass down the page.
         */}
        <h2 id="profile-heading" ref={heading} tabIndex={-1}>
          {municipality.name[lang]}
        </h2>
        <button type="button" onClick={onClose} aria-label={strings.closeProfile}>
          {strings.close}
        </button>
      </div>

      <ul className="profile-rows">
        {lk.data.indicators.map((indicator) => {
          const { value, status } = observationAt(lk, indicator.id, code, year)
          const rank = value === null ? null : rankOf(lk, indicator.id, year, code)
          const nominal = nominalOf(lk.data, indicator, value, year)
          return (
            <li key={indicator.id} className="profile-row">
              <span className="profile-name">{indicator.name[lang]}</span>
              <span className="profile-value">
                {value === null
                  ? statusPhrase(status, lang)
                  : formatWithUnit(value, indicator, lang)}
              </span>
              {nominal !== null && nominal !== value && (
                <span className="profile-nominal">
                  {strings.atTheTime(
                    formatWithUnit(nominal, { ...indicator, priceBasis: 'none' }, lang),
                    year,
                  )}
                </span>
              )}
              <span className="profile-rank">
                {rank ? strings.rank(rank.rank, rank.outOf) : ''}
              </span>
              <Sparkline lk={lk} indicatorId={indicator.id} code={code} year={year} />
            </li>
          )
        })}
      </ul>
    </section>
  )
}
