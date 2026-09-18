import type { IndicatorMeta, IndicatorSeries, Municipality, PantryView } from '../../shared/pantry'
import { OBSERVATION_STATUS } from '../../shared/pantry'
import { formatWithUnit, statusPhrase, OUTSIDE_COVERAGE, type CellStatus } from '../i18n/format'
import { t } from '../i18n/strings'
import type { Lang } from '../state/url'

/**
 * The only place that knows the pantry's columnar layout. Every component reads through these,
 * so a change to the published shape lands in one file rather than in every view.
 */

export type Cell = { value: number | null; status: CellStatus }

export type Lookup = {
  data: PantryView
  indicator(id: string): IndicatorMeta
  series(id: string): IndicatorSeries
  /**
   * Whether this indicator's series has been fetched yet.
   *
   * Plan 13: the site holds every indicator's metadata from the first byte but fetches series one
   * at a time, so anything that walks ALL indicators — the profile, the comparison — has to ask
   * before it reads. `series()` stays strict and throws, because everywhere else the answer is
   * already known.
   */
  hasSeries(id: string): boolean
  municipality(code: string): Municipality | undefined
  rowOf(code: string): number | undefined
  colOf(indicatorId: string, year: number): number | undefined
}

/**
 * Built once per load. The map draws 290 shapes and the slider moves 59 times; doing a linear
 * `find` per shape per year would be 17,000 scans for one drag across the century.
 */
export function lookup(data: PantryView): Lookup {
  const indicators = new Map(data.indicators.map((i) => [i.id, i]))
  const series = new Map(data.series.map((s) => [s.indicator, s]))
  const municipalities = new Map(data.municipalities.map((m) => [m.code, m]))
  const rows = new Map(data.municipalities.map((m, i) => [m.code, i]))
  const cols = new Map(
    data.series.map((s) => [s.indicator, new Map(s.years.map((y, j) => [y, j]))]),
  )
  return {
    data,
    indicator(id) {
      const i = indicators.get(id)
      if (!i) throw new Error(`no indicator "${id}" in the pantry`)
      return i
    },
    series(id) {
      const s = series.get(id)
      if (!s) throw new Error(`no series for indicator "${id}" in the pantry`)
      return s
    },
    hasSeries: (id) => series.has(id),
    municipality: (code) => municipalities.get(code),
    rowOf: (code) => rows.get(code),
    colOf: (indicatorId, year) => cols.get(indicatorId)?.get(year),
  }
}

/** Absent means absent: a missing row, a missing column and an unknown code all read the same. */
export function observationAt(lk: Lookup, indicatorId: string, code: string, year: number): Cell {
  const series = lk.series(indicatorId)
  const row = lk.rowOf(code)
  const col = lk.colOf(indicatorId, year)
  if (row === undefined || col === undefined) {
    return { value: null, status: OUTSIDE_COVERAGE }
  }
  const value = series.values[row]?.[col] ?? null
  const status = OBSERVATION_STATUS[series.status[row]?.[col] ?? 0]
  if (!status) throw new Error(`${indicatorId} ${code} ${year}: status byte out of range`)
  return { value, status }
}

/**
 * Which of the seven colour classes a value falls in, or null when there is nothing to colour.
 * A value sitting exactly on a break belongs to the class above it, matching how a threshold
 * scale reads and how the legend is written.
 */
export function classOf(indicator: IndicatorMeta, value: number | null): number | null {
  if (value === null) return null
  const breaks = indicator.scale.breaks
  let klass = 0
  while (klass < breaks.length && value >= breaks[klass]!) klass += 1
  return klass
}

export function nearestCoveredYear(indicator: IndicatorMeta, year: number): number {
  const { from, to } = indicator.coverage
  return Math.min(to, Math.max(from, year))
}

export type Rank = { rank: number; outOf: number }

const rankCache = new WeakMap<Lookup, Map<string, Map<string, Rank>>>()

/**
 * Competition ranking, highest value first: two municipalities tied for second are both second
 * and nobody is third.
 *
 * `outOf` counts only the municipalities that actually have a value that year. Telling someone
 * they are 180th of 290 when sixty of those 290 published nothing is simply false, and house
 * prices suppress enough cells for the difference to be real rather than theoretical.
 *
 * There is no "higher is better" anywhere in this project, so rank 1 means largest and nothing
 * more. What that is worth is the reader's to decide.
 */
export function ranksFor(lk: Lookup, indicatorId: string, year: number): Map<string, Rank> {
  let perLookup = rankCache.get(lk)
  if (!perLookup) {
    perLookup = new Map()
    rankCache.set(lk, perLookup)
  }
  const key = `${indicatorId}|${year}`
  const cached = perLookup.get(key)
  if (cached) return cached

  const present: Array<{ code: string; value: number }> = []
  for (const m of lk.data.municipalities) {
    const { value } = observationAt(lk, indicatorId, m.code, year)
    if (value !== null) present.push({ code: m.code, value })
  }
  present.sort((a, b) => b.value - a.value || a.code.localeCompare(b.code))

  const outOf = present.length
  const ranks = new Map<string, Rank>()
  let rank = 0
  let previous: number | null = null
  for (const [i, entry] of present.entries()) {
    if (previous === null || entry.value !== previous) rank = i + 1
    previous = entry.value
    ranks.set(entry.code, { rank, outOf })
  }
  perLookup.set(key, ranks)
  return ranks
}

export function rankOf(lk: Lookup, indicatorId: string, year: number, code: string): Rank | null {
  return ranksFor(lk, indicatorId, year).get(code) ?? null
}

export type Extreme = { code: string; value: number }

/** The highest and lowest municipality of a year, for the map's one-sentence summary. */
export function extremesFor(
  lk: Lookup,
  indicatorId: string,
  year: number,
): { low: Extreme; high: Extreme } | null {
  let low: Extreme | null = null
  let high: Extreme | null = null
  for (const m of lk.data.municipalities) {
    const { value } = observationAt(lk, indicatorId, m.code, year)
    if (value === null) continue
    if (!low || value < low.value) low = { code: m.code, value }
    if (!high || value > high.value) high = { code: m.code, value }
  }
  return low && high ? { low, high } : null
}

/**
 * Which statuses actually occur for an indicator in one year.
 *
 * The legend keys off this rather than listing every status the schema allows: a "too few sales"
 * key on the population map would be noise, and a legend that never changes teaches the reader
 * to stop reading it.
 */
export function statusesIn(lk: Lookup, indicatorId: string, year: number): Set<CellStatus> {
  const found = new Set<CellStatus>()
  for (const m of lk.data.municipalities) {
    found.add(observationAt(lk, indicatorId, m.code, year).status)
  }
  return found
}

/**
 * One sentence describing a municipality's reading, used by the live region and by Plan 4's
 * table twin. Written once here so the spoken version and the printed version cannot drift
 * apart, which is the way an accessible alternative usually rots.
 */
export function observationSentence(
  lk: Lookup,
  indicatorId: string,
  code: string,
  year: number,
  lang: Lang,
): string {
  const indicator = lk.indicator(indicatorId)
  const municipality = lk.municipality(code)
  if (!municipality) throw new Error(`no municipality "${code}" in the pantry`)
  const { value, status } = observationAt(lk, indicatorId, code, year)
  const strings = t(lang)

  const reading =
    value === null
      ? statusPhrase(status, lang)
      : status === 'present'
        ? formatWithUnit(value, indicator, lang)
        : `${formatWithUnit(value, indicator, lang)} — ${statusPhrase(status, lang)}`

  const rank = value === null ? null : rankOf(lk, indicatorId, year, code)
  const withRank = rank ? `${reading}, ${strings.rank(rank.rank, rank.outOf)}` : reading
  return strings.announcement(municipality.name[lang], indicator.name[lang], year, withRank)
}
