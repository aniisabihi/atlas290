import { useState } from 'react'
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

export function DataTable({
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
            <td>
              {row.value === null
                ? statusPhrase(row.status, lang)
                : formatWithUnit(row.value, indicator, lang)}
            </td>
            <td>{row.rank ? strings.rank(row.rank.rank, row.rank.outOf) : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
