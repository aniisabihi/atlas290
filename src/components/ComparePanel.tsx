import { compareOf, summarise } from '../data/compare'
import type { Lookup } from '../data/select'
import { formatWithUnit, statusPhrase } from '../i18n/format'
import { t } from '../i18n/strings'
import { Sparkline } from './Sparkline'
import type { Lang } from '../state/url'
import { SearchBox } from './SearchBox'

/**
 * Choosing the second municipality.
 *
 * Its own export because it belongs in the profile's header, beside the name it will put a
 * second name next to — not in a panel above the profile, which is where it was and where it
 * read as a stray text field. It is the same `SearchBox` the bar carries, so it looks like the
 * bar's: one control, two placements.
 */
export function CompareSearch({
  lk,
  selected,
  lang,
  onCompare,
}: {
  lk: Lookup
  selected: string
  lang: Lang
  onCompare: (code: string | null) => void
}) {
  const strings = t(lang)
  return (
    <SearchBox
      // The same list, minus the municipality already chosen: offering it would produce a
      // panel of identical columns, and the URL parser drops it anyway.
      municipalities={lk.data.municipalities.filter((m) => m.code !== selected)}
      lang={lang}
      onSelect={onCompare}
      label={strings.compareWith}
      placeholder={strings.comparePlaceholder}
    />
  )
}

/**
 * Two municipalities side by side. No verdict, by design — see `src/data/compare.ts`.
 *
 * Rendered only once a partner has been chosen; picking one is `CompareSearch`'s job.
 */
export function ComparePanel({
  lk,
  selected,
  compare,
  year,
  lang,
  onCompare,
}: {
  lk: Lookup
  selected: string
  compare: string
  year: number
  lang: Lang
  onCompare: (code: string | null) => void
}) {
  const strings = t(lang)
  const nameOf = (code: string) => lk.municipality(code)?.name[lang] ?? code

  const rows = compareOf(lk, selected, compare, year)
  const summary = summarise(rows)

  /** A figure, or which absence it is — styled as an absence, so it never reads as a value. */
  const cell = (value: number | null, row: (typeof rows)[number], label: string) => (
    <td role="cell" className={value === null ? 'is-absent' : undefined}>
      {/*
       * The column's name, repeated inside the cell for the phone layout, where the header row is
       * not on screen and two bare figures side by side would not say whose each one is. Hidden
       * from assistive technology, which already has the column header for exactly this.
       */}
      <span className="compare-cell-label" aria-hidden="true">
        {label}
      </span>
      <span className="compare-cell-value">
        {value === null
          ? statusPhrase(
              lk.series(row.indicator.id).years.includes(year)
                ? 'not-yet-published'
                : 'outside-coverage',
              lang,
            )
          : formatWithUnit(value, row.indicator, lang)}
      </span>
    </td>
  )

  return (
    <section className="compare panel" aria-labelledby="compare-heading">
      <div className="profile-header">
        <h2 id="compare-heading">
          {nameOf(selected)} {strings.and} {nameOf(compare)}
        </h2>
        <button type="button" onClick={() => onCompare(null)}>
          {strings.stopComparing}
        </button>
      </div>

      <p className="compare-summary">
        {strings.higherOn(nameOf(selected), summary.aHigher, summary.comparable)}
        {summary.notComparable > 0 && <> · {strings.notComparable(summary.notComparable)}</>}
      </p>

      <p className="no-winner">{strings.noWinner}</p>

      {/* A table may scroll in its own box; the page may not. WCAG 2.2 SC 1.4.10. */}
      <div className="table-scroll">
        {/*
         * Explicit roles on a native table, which would ordinarily be redundant. On a phone the
         * stylesheet sets each row as a small grid so both municipalities fit on screen at once —
         * the four-column table scrolled the second one out of sight — and WebKit drops a table's
         * semantics as soon as its display changes. Stating the roles keeps it a table for a
         * screen reader whatever the stylesheet does with it.
         */}
        <table className="compare-table" role="table">
          {/*
           * A caption rather than relying on the section heading: a screen reader listing the
           * page's tables should be able to tell this one from the map's twin without leaving it.
           */}
          <caption className="visually-hidden">
            {strings.tableCaption(`${nameOf(selected)} ${strings.and} ${nameOf(compare)}`, year)}
          </caption>
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">
                {strings.indicatorLegend}
              </th>
              <th scope="col" role="columnheader">
                {nameOf(selected)}
              </th>
              <th scope="col" role="columnheader">
                {nameOf(compare)}
              </th>
              <th scope="col" role="columnheader">
                {strings.bothOverTime}
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {rows.map((row) => (
              <tr key={row.indicator.id} role="row">
                <th scope="row" role="rowheader">
                  {row.indicator.name[lang]}
                </th>
                {cell(row.a, row, nameOf(selected))}
                {cell(row.b, row, nameOf(compare))}
                <td className="compare-trend" role="cell">
                  <Sparkline
                    lk={lk}
                    indicatorId={row.indicator.id}
                    code={selected}
                    compare={compare}
                    year={year}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
