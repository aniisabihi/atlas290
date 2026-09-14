import type { PantryData } from '../../shared/pantry'

/**
 * The URL is the application's memory. Everything the site renders is a function of the path and
 * the query string, which is what makes every view shareable, the back button correct, and the
 * whole of the state logic testable as text in and a plain object out.
 *
 * Nothing here imports the pantry data itself: the parser is handed the small `PantryMeta`
 * summary it needs to validate against, so its tests need no fixture and cannot drift out of
 * step with a 1 MB JSON file.
 */

export const LANGS = ['sv', 'en'] as const
export type Lang = (typeof LANGS)[number]

/**
 * Swedish is the fallback for a path that names no language we publish. The dataset is Swedish,
 * the municipality names are Swedish in both editions, and the Swedish page is the canonical one.
 * This should never actually be reached — the root page redirects — but `parseState` must return
 * a usable state for any string rather than throw.
 */
export const DEFAULT_LANG: Lang = 'sv'

/** Query keys, in the order `toUrl` writes them, so one state is always one string. */
const KEYS = {
  indicator: 'i',
  year: 'y',
  selected: 'm',
  compare: 'c',
  view: 'v',
  table: 't',
} as const

export const VIEWS = ['map', 'cartogram'] as const
export type View = (typeof VIEWS)[number]

export type AppState = {
  lang: Lang
  indicator: string
  year: number
  /** Four-digit municipality code, or nothing selected. */
  selected: string | null
  /** The municipality being compared against `selected`, if any. */
  compare: string | null
  /**
   * `null` means "whatever suits this screen" — bubbles on a phone, the map on a desktop.
   *
   * Deliberately nullable rather than defaulting to 'map' in the parser, which is what the plan
   * first wrote. A concrete default would make `/sv/` mean "the geographic map" and a phone
   * would then be overriding the URL rather than filling a gap in it. Absent means unstated, and
   * anything the visitor actually chooses is written down.
   */
  view: View | null
  /** The plain sortable table, the twin of whichever view is showing. */
  table: boolean
}

/** The minimum a URL can be validated against. Plan 4 adds `compare` and `view` alongside. */
export type PantryMeta = {
  indicators: readonly string[]
  codes: readonly string[]
  /** The full year axis, always shown whatever indicator is chosen. */
  years: { min: number; max: number }
  /** The year a visitor arrives on: the latest the default indicator actually covers. */
  defaultYear: number
}

export function metaFrom(data: PantryData): PantryMeta {
  const years = data.series.flatMap((s) => s.years)
  const first = data.indicators[0]
  if (!first) throw new Error('pantry has no indicators')
  const defaultSeries = data.series.find((s) => s.indicator === first.id)
  if (!defaultSeries) throw new Error(`pantry has no series for its first indicator "${first.id}"`)
  return {
    indicators: data.indicators.map((i) => i.id),
    codes: data.municipalities.map((m) => m.code),
    years: { min: Math.min(...years), max: Math.max(...years) },
    // Deliberately the default indicator's last year, not the axis end. The axis reaches 2026
    // because municipal tax rates are set a year ahead; opening on 2026 would show every
    // visitor an empty population map.
    defaultYear: Math.max(...defaultSeries.years),
  }
}

export function defaultsFor(meta: PantryMeta): AppState {
  const indicator = meta.indicators[0]
  if (!indicator) throw new Error('pantry meta lists no indicators')
  return {
    lang: DEFAULT_LANG,
    indicator,
    year: meta.defaultYear,
    selected: null,
    compare: null,
    view: null,
    table: false,
  }
}

function langFrom(pathname: string): Lang {
  const segment = pathname.split('/')[1]
  return LANGS.find((l) => l === segment) ?? DEFAULT_LANG
}

export function parseState(pathname: string, search: string, meta: PantryMeta): AppState {
  const q = new URLSearchParams(search)
  const fallback = defaultsFor(meta)

  const indicator = q.get(KEYS.indicator)
  const year = Number.parseInt(q.get(KEYS.year) ?? '', 10)
  const known = (code: string | null) => (code && meta.codes.includes(code) ? code : null)
  const selected = known(q.get(KEYS.selected))
  const candidate = known(q.get(KEYS.compare))
  // A comparison needs something to compare against, and comparing a municipality with itself is
  // not a view — it would render a panel of identical columns and a summary of ten ties.
  const compare = selected && candidate !== selected ? candidate : null
  const view = VIEWS.find((v) => v === q.get(KEYS.view)) ?? null

  return {
    lang: langFrom(pathname),
    indicator: indicator && meta.indicators.includes(indicator) ? indicator : fallback.indicator,
    // Clamped to the axis and nothing narrower. A year outside the chosen indicator's own
    // coverage is legal and preserved: the map shows its empty state and offers a jump, rather
    // than quietly rewriting a link somebody shared.
    year: Number.isFinite(year)
      ? Math.min(meta.years.max, Math.max(meta.years.min, year))
      : fallback.year,
    selected,
    compare,
    view,
    table: q.get(KEYS.table) === '1',
  }
}

export function parseHref(href: string, meta: PantryMeta): AppState {
  const q = href.indexOf('?')
  return q === -1 ? parseState(href, '', meta) : parseState(href.slice(0, q), href.slice(q), meta)
}

export function toUrl(state: AppState, meta: PantryMeta): string {
  const fallback = defaultsFor(meta)
  const q = new URLSearchParams()
  // Written in a fixed order, and only where the value differs from the default, so a shared
  // link stays short and never pins a value the visitor did not actually choose.
  if (state.indicator !== fallback.indicator) q.set(KEYS.indicator, state.indicator)
  if (state.year !== fallback.year) q.set(KEYS.year, String(state.year))
  if (state.selected !== null) q.set(KEYS.selected, state.selected)
  if (state.compare !== null && state.selected !== null) q.set(KEYS.compare, state.compare)
  if (state.view !== null) q.set(KEYS.view, state.view)
  if (state.table) q.set(KEYS.table, '1')
  const search = q.toString()
  return `/${state.lang}/${search ? `?${search}` : ''}`
}
