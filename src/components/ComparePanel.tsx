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
        {nameOf(selected)}: {strings.higherOn(summary.aHigher, summary.comparable)}
        {summary.notComparable > 0 && <> · {strings.notComparable(summary.notComparable)}</>}
      </p>

      <p className="no-winner">{strings.noWinner}</p>

      {/* A table may scroll in its own box; the page may not. WCAG 2.2 SC 1.4.10. */}
      <div className="table-scroll">
        <table className="compare-table">
          {/*
           * A caption rather than relying on the section heading: a screen reader listing the
           * page's tables should be able to tell this one from the map's twin without leaving it.
           */}
          <caption className="visually-hidden">
            {strings.tableCaption(`${nameOf(selected)} ${strings.and} ${nameOf(compare)}`, year)}
          </caption>
          <thead>
            <tr>
              <th scope="col">{strings.indicatorLegend}</th>
              <th scope="col">{nameOf(selected)}</th>
              <th scope="col">{nameOf(compare)}</th>
              <th scope="col">{strings.bothOverTime}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.indicator.id}>
                <th scope="row">{row.indicator.name[lang]}</th>
                <td data-higher={row.higher === 'a' ? 'true' : undefined}>
                  {row.a === null
                    ? statusPhrase(
                        lk.series(row.indicator.id).years.includes(year)
                          ? 'not-yet-published'
                          : 'outside-coverage',
                        lang,
                      )
                    : formatWithUnit(row.a, row.indicator, lang)}
                </td>
                <td data-higher={row.higher === 'b' ? 'true' : undefined}>
                  {row.b === null
                    ? statusPhrase(
                        lk.series(row.indicator.id).years.includes(year)
                          ? 'not-yet-published'
                          : 'outside-coverage',
                        lang,
                      )
                    : formatWithUnit(row.b, row.indicator, lang)}
                </td>
                <td className="compare-trend">
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
