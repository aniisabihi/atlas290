import { memo, useEffect, useRef, useState } from 'react'
import { observationAt, ranksFor, type Lookup } from '../data/select'
import { formatWithUnit, statusPhrase } from '../i18n/format'
import { t } from '../i18n/strings'
import type { Lang } from '../state/url'

/**
 * The plain twin of whatever view is showing.
 *
 * Reached deliberately through the URL rather than offered as a lesser fallback: a screen-reader
 * visitor gets the same choice everyone else does, and the link is shareable. Every municipality
 * appears, including the ones with no value — which say why rather than showing a blank, since a
 * blank cell in a sortable table reads as zero.
 *
 * Sort order is component state rather than URL state. It is a way of reading one view, not a
 * different view, and putting it in the address bar would make two links to the same data look
 * like two different places.
 */
type Column = 'name' | 'value' | 'rank'

/**
 * Memoised, because the page re-renders on every hover.
 *
 * Pointing at a neighbour chip or a fact sets the page's highlight, and the table takes none of
 * it — but it sorts all 290 municipalities and formats every cell on each render, so without
 * this it redid all of that for a state change it has no interest in.
 */
export const DataTable = memo(function DataTable({
  lk,
  indicatorId,
  year,
  selected,
  lang,
  onSelect,
}: {
  lk: Lookup
  indicatorId: string
  year: number
  selected: string | null
  lang: Lang
  onSelect: (code: string) => void
}) {
  const strings = t(lang)
  const indicator = lk.indicator(indicatorId)
  const ranks = ranksFor(lk, indicatorId, year)
  const [sort, setSort] = useState<{ column: Column; descending: boolean }>({
    column: 'name',
    descending: false,
  })

  /**
   * Arrives showing the municipality already chosen, centred in the box.
   *
   * Choosing Malmö and then the table used to open on Ale, Alingsås and Alvesta, with the one
   * row the visitor cared about two hundred rows down. On arrival only: once the table is open,
   * a row chosen in it is already where the visitor is looking, and moving the box under their
   * pointer would be the opposite of help. The box scrolls, never the page — `scrollIntoView`
   * would drag the whole document along with it.
   */
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = scroller.current
    const row = box?.querySelector<HTMLElement>('tr[aria-current="true"]')
    if (!box || !row) return
    const rowBox = row.getBoundingClientRect()
    const offset = rowBox.top - box.getBoundingClientRect().top
    box.scrollTop += offset - box.clientHeight / 2 + rowBox.height / 2
  }, [])

  const rows = lk.data.municipalities.map((municipality) => {
    const { value, status } = observationAt(lk, indicatorId, municipality.code, year)
    return { municipality, value, status, rank: ranks.get(municipality.code) ?? null }
  })

  const sorted = [...rows].sort((a, b) => {
    if (sort.column === 'name') {
      const order = a.municipality.name[lang].localeCompare(b.municipality.name[lang], 'sv')
      return sort.descending ? -order : order
    }
    // Absence is not zero and must not sort like it: rows without a value go to the end whichever
    // way the column is pointing, rather than pretending to be the smallest.
    const av = sort.column === 'rank' ? (a.rank?.rank ?? null) : a.value
    const bv = sort.column === 'rank' ? (b.rank?.rank ?? null) : b.value
    if (av === null && bv === null) {
      return a.municipality.name[lang].localeCompare(b.municipality.name[lang], 'sv')
    }
    if (av === null) return 1
    if (bv === null) return -1
    return sort.descending ? bv - av : av - bv
  })

  const header = (column: Column, label: string) => {
    const active = sort.column === column
    return (
      <th scope="col" aria-sort={active ? (sort.descending ? 'descending' : 'ascending') : 'none'}>
        <button
          type="button"
          onClick={() =>
            setSort((current) =>
              current.column === column
                ? { column, descending: !current.descending }
                : // First click on a new column picks the direction that reads naturally:
                  // largest value first, but rank 1 first, and names from A.
                  { column, descending: column === 'value' },
            )
          }
        >
          {label}
        </button>
      </th>
    )
  }

  return (
    /*
     * A named, focusable scroll region.
     *
     * The table takes the map's box and scrolls inside it, and a box that scrolls has to be
     * reachable with a keyboard — WCAG 2.1.1, and Firefox adds the tab stop by itself whether we
     * ask for it or not. Declaring it is what gives that stop a name instead of leaving a
     * keyboard visitor on an anonymous div.
     */
    <div
      ref={scroller}
      className="table-scroll"
      role="region"
      aria-label={strings.tableCaption(indicator.name[lang], year)}
      tabIndex={0}
    >
      <table className="data-table">
        <caption>{strings.tableCaption(indicator.name[lang], year)}</caption>
        <thead>
          <tr>
            {header('name', strings.columnMunicipality)}
            {header('value', strings.columnValue)}
            {header('rank', strings.columnRank)}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.municipality.code}
              aria-current={row.municipality.code === selected ? 'true' : undefined}
            >
              <th scope="row">
                <button type="button" onClick={() => onSelect(row.municipality.code)}>
                  {row.municipality.name[lang]}
                </button>
              </th>
              <td className={row.value === null ? 'is-absent' : undefined}>
                {row.value === null
                  ? statusPhrase(row.status, lang)
                  : formatWithUnit(row.value, indicator, lang)}
              </td>
              <td>{row.rank ? strings.rankCell(row.rank.rank, row.rank.outOf) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
})
