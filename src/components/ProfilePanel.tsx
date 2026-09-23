import { useEffect, useRef, type ReactNode } from 'react'
import { observationAt, rankOf, type Lookup } from '../data/select'
import { nominalOf } from '../data/nominal'
import { formatWithUnit, statusPhrase } from '../i18n/format'
import { t } from '../i18n/strings'
import type { Lang } from '../state/url'
import { Sparkline } from './Sparkline'

/** A panel asked for in isolation was opened by somebody; only `App` knows otherwise. */
const ALWAYS = () => true

/**
 * Everything the pantry knows about one municipality, in one place.
 *
 * **Not a dialog.** No `role="dialog"`, no focus trap, and the map stays reachable behind it —
 * DESIGN section 5 asks for a non-modal panel, and trapping focus in a panel that sits beside the
 * thing it describes would stop a visitor comparing the two.
 *
 * Focus moves to the heading when a visitor OPENS a profile, so a screen reader lands on
 * "Stockholm" rather than being left wherever it was on a page that has just changed underneath
 * it. It does not move when a link merely arrives already showing one — see `openedByVisitor`.
 */
export function ProfilePanel({
  lk,
  code,
  year,
  lang,
  onClose,
  asSheet = false,
  story,
  similar,
  compare,
  openedByVisitor = ALWAYS,
}: {
  lk: Lookup
  code: string
  year: number
  lang: Lang
  onClose: () => void
  /** On a narrow screen the panel arrives as a bottom sheet rather than a column. */
  asSheet?: boolean
  /**
   * Two slots rather than two more data props.
   *
   * Both of these depend on the whole `AppState` — the story on the selected year, the similar
   * list on the indicator and year it has to carry into its links — and passing the state down
   * here would duplicate `code`, `year` and `lang`, which are already three of its fields. So
   * the panel stays what it has always been, a layout for everything known about one
   * municipality, and App composes what goes in it.
   */
  story?: ReactNode
  similar?: ReactNode
  /**
   * The "compare with…" search, which belongs beside the name it will put a second name next to.
   * It used to sit in a panel of its own above the profile, where it read as a stray text field
   * and was styled like nothing else on the site.
   */
  compare?: ReactNode
  /**
   * Asked once, at the moment the panel appears or changes municipality: is this a profile the
   * visitor opened, or one the page simply arrived with?
   *
   * A question rather than a value because the answer changes exactly once, between the page's
   * first commit and everything after it, and a prop that flipped would give the effect below a
   * second chance to fire — moving focus long after the visitor started reading, which is the
   * whole defect. Only `App` knows how the page arrived; a panel on its own was opened by
   * somebody, so that is the default.
   */
  openedByVisitor?: () => boolean
}) {
  const strings = t(lang)
  const heading = useRef<HTMLHeadingElement>(null)
  const municipality = lk.municipality(code)

  // Re-runs when the municipality changes, which is the point: opening a different profile has
  // to move focus again, not leave it on a heading that now says something else. It does not run
  // for the profile a deep link arrives with — see `openedByVisitor`.
  useEffect(() => {
    const el = heading.current
    if (el && code && openedByVisitor()) el.focus()
  }, [code, openedByVisitor])

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
        <div className="profile-actions">
          {compare}
          <button type="button" onClick={onClose} aria-label={strings.closeProfile}>
            {strings.close}
          </button>
        </div>
      </div>

      {story}

      <ul className="profile-rows">
        {/*
          Only the indicators whose series has arrived. Plan 13 fetches them when a profile
          opens, so on a cold open the rows fill in; every row that IS shown is real.
        */}
        {lk.data.indicators
          .filter((indicator) => lk.hasSeries(indicator.id))
          .map((indicator) => {
            const { value, status } = observationAt(lk, indicator.id, code, year)
            const rank = value === null ? null : rankOf(lk, indicator.id, year, code)
            const nominal = nominalOf(lk.data, indicator, value, year)
            return (
              <li key={indicator.id} className="profile-row">
                <span className="profile-name">{indicator.name[lang]}</span>
                {/* An absence is styled as one, so a sentence never passes for a figure. */}
                <span className={value === null ? 'profile-value is-absent' : 'profile-value'}>
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

      {similar}
    </section>
  )
}
