import type { IndicatorMeta, Municipality } from '../../shared/pantry'
import { parseSegment, segmentFor } from '../../shared/slug'

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
  /**
   * Code to name, for building the readable half of a municipality path.
   *
   * One map rather than one per language: all 290 names are identical in Swedish and English,
   * which `shared/slug.test.ts` asserts rather than assumes. A future translated name would need
   * a decision about which language the slug speaks, and that test is where it would surface.
   */
  names: Readonly<Record<string, string>>
  /** The full year axis, always shown whatever indicator is chosen. */
  years: { min: number; max: number }
  /** The year a visitor arrives on: the latest the default indicator actually covers. */
  defaultYear: number
}

/**
 * Built from the INDEX, never from the series.
 *
 * Plan 13: the site parses the URL before it has fetched any series, because the URL is what says
 * which series to fetch. Reading the axis off whatever happened to be loaded would give the slider
 * a different length depending on which indicator a visitor arrived on. Each indicator's declared
 * `coverage` says the same thing and is always present — verified equal to the series' own first
 * and last year for all ten indicators before this was changed, and asserted in url.test.ts.
 */
export function metaFrom(source: {
  municipalities: readonly Municipality[]
  indicators: readonly IndicatorMeta[]
}): PantryMeta {
  const first = source.indicators[0]
  if (!first) throw new Error('pantry has no indicators')
  return {
    indicators: source.indicators.map((i) => i.id),
    codes: source.municipalities.map((m) => m.code),
    names: Object.fromEntries(source.municipalities.map((m) => [m.code, m.name.sv])),
    years: {
      min: Math.min(...source.indicators.map((i) => i.coverage.from)),
      max: Math.max(...source.indicators.map((i) => i.coverage.to)),
    },
    // Deliberately the default indicator's last year, not the axis end. The axis reaches 2026
    // because municipal tax rates are set a year ahead; opening on 2026 would show every
    // visitor an empty population map.
    defaultYear: first.coverage.to,
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

/**
 * The municipality a path names, if it names one: `/en/malmo-1280/` is Malmö.
 *
 * Plan 9 pre-renders a page per municipality so that a pasted link says what it shows, and those
 * pages live at real paths because static hosting cannot serve different documents for different
 * query strings. The path is therefore a second way to say `?m=`, not a replacement for it —
 * every link already shared keeps working, which is what DESIGN means by calling the URL grammar
 * final.
 */
function municipalityFrom(pathname: string, meta: PantryMeta): string | null {
  const segment = pathname.split('/')[2]
  if (!segment) return null
  const code = parseSegment(segment)
  return code && meta.codes.includes(code) ? code : null
}

export function parseState(pathname: string, search: string, meta: PantryMeta): AppState {
  const q = new URLSearchParams(search)
  const fallback = defaultsFor(meta)

  const indicator = q.get(KEYS.indicator)
  const year = Number.parseInt(q.get(KEYS.year) ?? '', 10)
  const known = (code: string | null) => (code && meta.codes.includes(code) ? code : null)
  // The path wins over `?m`. It is what the server used to choose which document to send, so a
  // page that said Malmö in its title and then rendered Göteborg would be the worse failure —
  // and the only way to get both is to hand-write one.
  const selected = municipalityFrom(pathname, meta) ?? known(q.get(KEYS.selected))
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
  // The selection is the path now, not a query key — so it is never written here.
  if (state.compare !== null && state.selected !== null) q.set(KEYS.compare, state.compare)
  if (state.view !== null) q.set(KEYS.view, state.view)
  if (state.table) q.set(KEYS.table, '1')
  const search = q.toString()
  const name = state.selected ? meta.names[state.selected] : undefined
  const path =
    state.selected && name
      ? `/${state.lang}/${segmentFor(name, state.selected)}/`
      : `/${state.lang}/`
  return `${path}${search ? `?${search}` : ''}`
}
