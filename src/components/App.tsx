import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  ViewTransition,
} from 'react'
import { coversYear } from '../../shared/pantry'
import { fetchIndicatorPart, withPart, type LoadedPantry } from '../data/pantry'
import { classOf, lookup, observationAt, observationSentence } from '../data/select'
import { coveragePhrase } from '../i18n/format'
import { t } from '../i18n/strings'
import { titleFor } from '../state/title'
import { metaFrom } from '../state/url'
import { useAppState } from '../state/useAppState'
import { useMediaQuery } from '../state/useMediaQuery'
import { useReducedMotion } from '../state/useReducedMotion'
import { AboutIndicator } from './AboutIndicator'
import { EmptyYear } from './EmptyYear'
import { IndicatorPicker } from './IndicatorPicker'
import { LanguageSwitch } from './LanguageSwitch'
import { Legend } from './Legend'
import { LiveRegion } from './LiveRegion'
import { MapCanvas, type MapHandle } from './MapCanvas'
import { ComparePanel, CompareSearch } from './ComparePanel'
import { DataTable } from './DataTable'
import { FactsStrip } from './FactsStrip'
import { ProfilePanel } from './ProfilePanel'
import { ProfileStory } from './ProfileStory'
import { SimilarPlaces } from './SimilarPlaces'
import { NoDataPatterns } from './NoDataPatterns'
import { Notices } from './Notices'
import { SearchBox } from './SearchBox'
import { ThemeToggle } from './ThemeToggle'
import { YearSlider } from './YearSlider'

/**
 * The shell. Everything it renders is a function of the URL; the only state that lives outside
 * the address bar is whether the year is playing and where the keyboard happens to be, neither of
 * which anyone would want in a shared link.
 */
/** Matches the layout breakpoint in app.css, so CSS and behaviour cannot disagree. */
export const NARROW = '(max-width: 60rem)'

export function App({ loaded: opened }: { loaded: LoadedPantry }) {
  // The pantry GROWS after load: Plan 13 fetches the index plus the one series the URL asks for,
  // and the rest as they are needed. Every arrival replaces this with a new object rather than
  // mutating it, which is what keeps the two memos below honest.
  const [loaded, setLoaded] = useState(opened)
  const { view: pantry, parts, topology, adjacency, similar, facts } = loaded

  // Memoised on the INDEX, which genuinely never changes after load — so `meta` keeps one
  // identity for the life of the page even as series arrive, and `useAppState` is not rebuilt
  // underneath the history listener.
  const meta = useMemo(() => metaFrom(loaded.index), [loaded.index])
  // Memoised on the view, which changes only when a series arrives, because `lookup` promises in
  // its own docstring to be "built once per load" and rebuilding it per render was quietly
  // breaking that. The cost of the rebuild itself is small; the cost that mattered is that
  // `ranksFor` caches into a WeakMap keyed on the Lookup OBJECT, so a fresh one every render
  // threw the rank cache away every render and re-sorted all 290 municipalities each time.
  const lk = useMemo(() => lookup(pantry), [pantry])
  const [state, update] = useAppState(meta)

  /**
   * Which indicators this view needs on disk right now. The map needs one; the profile and the
   * comparison show a row per indicator and so need all of them.
   */
  const wanted = useMemo(() => {
    const ids = [state.indicator]
    if (state.selected !== null || state.compare !== null) ids.push(...meta.indicators)
    return ids
  }, [state.indicator, state.selected, state.compare, meta])

  /**
   * Fetches what is missing, once each.
   *
   * Out-of-order responses need no guard, and that is a property of the design rather than luck:
   * an arriving series is ADDED under its own id and never replaces the one being drawn, and what
   * is drawn is chosen by the URL. So A→B→A settles on A the moment A is in hand — it already is —
   * and B landing late adds data nobody is looking at.
   */
  const requested = useRef(new Set<string>())
  useEffect(() => {
    for (const id of wanted) {
      if (loaded.parts.has(id) || requested.current.has(id)) continue
      requested.current.add(id)
      fetchIndicatorPart(id)
        .then((part) => setLoaded((previous) => withPart(previous, part)))
        .catch((error: unknown) => {
          // Let it be retried rather than leaving the indicator permanently unfetchable.
          requested.current.delete(id)
          throw error
        })
    }
  }, [wanted, loaded.parts])

  /**
   * The indicator actually drawn. While a newly chosen one is in flight the map keeps showing the
   * last one that arrived, rather than blanking: there is no visual language on this site for "a
   * map that is loading", and inventing one is not this change's job.
   */
  const [drawn, setDrawn] = useState(state.indicator)
  if (drawn !== state.indicator && parts.has(state.indicator)) setDrawn(state.indicator)
  const strings = t(state.lang)
  const [playing, setPlaying] = useState(false)
  /**
   * The municipality the page is currently pointing at — from a shape under the pointer, a
   * neighbour chip, or a fact that names one.
   *
   * **Deliberately not in the URL**, which is otherwise this application's whole memory. A
   * highlight is where the pointer happens to be for as long as it happens to be there; writing
   * it down would put a history entry behind every mouse movement and make a shared link carry
   * something nobody chose. Playback and morph progress are out for the same reason, and
   * DESIGN section 3 names all three.
   */
  const [highlight, setHighlight] = useState<string | null>(null)
  const reducedMotion = useReducedMotion()
  const indicator = lk.indicator(drawn)
  const covered = coversYear(indicator, state.year)
  /**
   * Which class on the ramp the highlighted municipality sits in, so the legend can tick it.
   * Null where it has no value this year: a tick on an absence would claim a place on a scale
   * the figure is not on.
   */
  const highlightClass = highlight
    ? classOf(indicator, observationAt(lk, drawn, highlight, state.year).value)
    : null

  // The tab, and what a screen reader announces on arrival. Set from the state rather than
  // written once in the HTML, so a shared link says where it goes.
  useEffect(() => {
    document.title = titleFor(lk, state)
  }, [lk, state])

  /** Any deliberate interaction stops the playback rather than fighting it. */
  const interrupt = () => setPlaying(false)

  /**
   * Whether a profile appearing right now is one the visitor opened.
   *
   * A profile that is on screen because the LINK named a municipality was opened by nobody, so
   * `ProfilePanel` does not move focus into it. That used to be the other way round — DESIGN
   * section 5 asked for a declared focus target on a deep link too — and it was wrong twice over.
   *
   * It is wrong for a visitor: this application mounts asynchronously, because the pantry has to
   * arrive before there is anything to draw, so the focus landed at an unpredictable moment after
   * the page was already readable and yanked anyone who had started tabbing. And the heading it
   * landed on sits BELOW the map in the document, so a keyboard visitor arriving on
   * `/en/malmo-1280/` could not reach the search, the year or the map at all without tabbing
   * backwards past everything. Nothing is lost by staying put: the page title says where the link
   * went, the skip link is still the first stop, and the panel is still in the tab order.
   *
   * It was also wrong for the browser suite, which is where it was found — see
   * docs/decisions/0018-the-focus-a-link-never-asked-for.md.
   *
   * A ref cleared in a mount effect rather than a value computed while rendering: React flushes a
   * child's effects before its parent's, so the panel below asks this question and gets `false`
   * while the page is still arriving, and `true` from the next commit onwards — including when
   * the visitor comes back to the very municipality the link named.
   */
  const arriving = useRef(true)
  useEffect(() => {
    arriving.current = false
  }, [])
  const openedByVisitor = useCallback(() => !arriving.current, [])

  /**
   * A one-off message that takes precedence over the usual sentence — currently only "no
   * neighbour that way", which has to be said at the moment the key is pressed rather than
   * inferred from the state, because nothing about the state changed.
   */
  const [notice, setNotice] = useState('')
  const mapRef = useRef<MapHandle>(null)
  /**
   * Below this width the bubbles are the default: every municipality is at least a visible,
   * tappable dot, and the layout wastes no width on a country three times taller than it is
   * wide; the panel becomes a sheet.
   *
   * It is a default, not an override. `?v=map` on a phone shows the map — whatever is in the URL
   * always wins, because the URL is the memory and a screen size is not a decision the visitor
   * made.
   */
  const narrow = useMediaQuery(NARROW)
  const view = state.view ?? (narrow ? 'cartogram' : 'map')
  const announcement =
    notice ||
    (state.selected
      ? observationSentence(lk, drawn, state.selected, state.year, state.lang)
      : strings.selectionCleared)

  return (
    <div className="page">
      <NoDataPatterns />

      {/*
       * One bar carrying the site's name and everything that drives it. Before this, the controls
       * lived in a left-hand column that read as a settings form and meant a keyboard visitor
       * passed ten of them before reaching the map. Plan 10, D5 and D6.
       */}
      <header className="bar">
        {/*
         * Inside the header so that no content sits outside a landmark, and pointing at #view
         * rather than #map because #map does not exist in the table view — where the skip link
         * was therefore broken. Found by widening the axe rule set after Lighthouse caught the
         * missing <main>.
         */}
        <a className="skip-link" href="#view">
          {state.table ? strings.skipToTable : strings.skipToMap}
        </a>

        <h1 className="wordmark">{strings.siteName}</h1>

        <IndicatorPicker
          lk={lk}
          selected={state.indicator}
          lang={state.lang}
          onChange={(chosen) => {
            interrupt()
            setNotice('')
            // The year is deliberately kept. If the new indicator does not cover it, EmptyYear
            // explains and offers a jump; moving the year silently would hide the fact that
            // the ten indicators do not cover the same span.
            update({ indicator: chosen })
          }}
        />

        <SearchBox
          municipalities={pantry.municipalities}
          lang={state.lang}
          onSelect={(code) => {
            interrupt()
            setNotice('')
            update({ selected: code })
          }}
        />

        <div className="view-switch" role="group" aria-label={strings.viewGroup}>
          <button
            type="button"
            aria-pressed={!state.table && view === 'map'}
            onClick={() => {
              interrupt()
              // The shapes are about to move, so whatever the pointer was on is no longer under
              // it. Cleared here, by the event that makes it untrue, rather than by an effect.
              setHighlight(null)
              if (state.table) startTransition(() => update({ view: 'map', table: false }))
              else update({ view: 'map', table: false })
            }}
          >
            {strings.showMap}
          </button>
          <button
            type="button"
            aria-pressed={!state.table && view === 'cartogram'}
            onClick={() => {
              interrupt()
              // The shapes are about to move, so whatever the pointer was on is no longer under
              // it. Cleared here, by the event that makes it untrue, rather than by an effect.
              setHighlight(null)
              if (state.table) startTransition(() => update({ view: 'cartogram', table: false }))
              else update({ view: 'cartogram', table: false })
            }}
          >
            {strings.showCartogram}
          </button>
          <button
            type="button"
            aria-pressed={state.table}
            onClick={() => {
              interrupt()
              setHighlight(null)
              // A Transition, so the `ViewTransition` around the stage animates the swap. The
              // map↔bubbles switch deliberately is NOT one: the morph is that journey.
              startTransition(() => update({ table: !state.table }))
            }}
          >
            {strings.tableToggle}
          </button>
        </div>

        <div className="bar-end">
          <ThemeToggle lang={state.lang} />
          <LanguageSwitch state={state} meta={meta} />
        </div>
      </header>

      <main id="content">
        <div className="layout">
          {/*
           * The map comes FIRST in the main region, which is the whole point of moving the
           * controls into the bar: it used to be the last tab stop on the page. The grid below
           * places the reading column to its left, so what a visitor sees is unchanged and what
           * a keyboard reaches first is the thing they came for.
           */}
          <div id="view" tabIndex={-1} className="view-column">
            {/*
             * One plate for every view, the same size in every view. The table used to render
             * in a bordered box of its own beside a plate it did not match; now it sits where the
             * map sits, with a caption line of its own, so switching views changes the picture
             * and nothing around it. Plan 21.
             *
             * The `ViewTransition` animates the swap between the picture and the table — the one
             * change of view the morph does not carry — and only when the swap is made inside a
             * Transition, which the table button does. Under reduced motion the stylesheet turns
             * the animation off, so the views simply replace each other.
             */}
            <figure className="map-frame" data-view={state.table ? 'table' : view}>
              <ViewTransition
                key={state.table ? 'table' : 'picture'}
                enter="stage-enter"
                exit="stage-exit"
                default="none"
              >
                <div className="stage-body">
                  {state.table ? (
                    <DataTable
                      lk={lk}
                      indicatorId={drawn}
                      year={state.year}
                      selected={state.selected}
                      lang={state.lang}
                      onSelect={(code) => {
                        interrupt()
                        setNotice('')
                        update({ selected: code })
                      }}
                    />
                  ) : (
                    <MapCanvas
                      ref={mapRef}
                      lk={lk}
                      topology={topology}
                      adjacency={adjacency}
                      // The drawn indicator's file has arrived by definition, and since Plan 21
                      // it carries the bubble layout sized for that indicator.
                      layout={parts.get(drawn)!.layout}
                      view={view}
                      indicatorId={drawn}
                      year={state.year}
                      selected={state.selected}
                      lang={state.lang}
                      animate={!reducedMotion}
                      onNoMove={() => setNotice(strings.noNeighbour)}
                      onMoved={() => setNotice('')}
                      highlight={highlight}
                      onHover={setHighlight}
                      onSelect={(code) => {
                        interrupt()
                        setNotice('')
                        update({ selected: code === state.selected ? null : code })
                      }}
                    />
                  )}
                </div>
              </ViewTransition>
              {/*
               * What the picture means, under it. The map's caption is the keyboard hint the
               * SVG is described by; the bubbles add what their size says, because "sized by the
               * measure" is a claim a visitor should not have to infer; the table gets its own
               * line, which is also what keeps the plate the same height in every view.
               */}
              {/*
               * The arrow-key sentence is wrapped so a touch screen can set it aside: on a phone
               * it was two of the caption's five lines, describing keys the visitor does not
               * have. A device with a fine pointer keeps it; see `.keyboard-hint`.
               */}
              <figcaption id="map-hint" className="stage-hint">
                {state.table ? (
                  strings.tableHint
                ) : (
                  <>
                    {view === 'cartogram' && `${strings.cartogramHint} `}
                    <span className="keyboard-hint">{strings.mapHint}</span>
                  </>
                )}
              </figcaption>
            </figure>
          </div>

          <div className="reading-column">
            {/*
             * The measure's own span, not the axis's. Plan 19: this read
             * "Green space within 200 m · 1968–2026" for a measure with two values in it,
             * because it paired the indicator's NAME with the axis's range. It was already
             * wrong for every ragged indicator — mean age starts in 1998 — and a sparse one
             * made it absurd.
             */}
            <p className="kicker">
              {lk.indicator(drawn).name[state.lang]} ·{' '}
              {coveragePhrase(lk.indicator(drawn), state.lang)}
            </p>
            <p className="tagline">{strings.tagline}</p>

            {!covered && (
              <EmptyYear
                lk={lk}
                indicatorId={drawn}
                year={state.year}
                lang={state.lang}
                onYear={(year) => {
                  interrupt()
                  setNotice('')
                  update({ year })
                }}
              />
            )}

            <div className="instrument">
              <YearSlider
                lk={lk}
                meta={meta}
                indicatorId={drawn}
                year={state.year}
                lang={state.lang}
                playing={playing}
                onYear={(year, stepping) => {
                  setNotice('')
                  update({ year }, { replace: stepping })
                }}
                onPlayingChange={setPlaying}
              />
            </div>

            <Legend
              lk={lk}
              indicatorId={drawn}
              year={state.year}
              lang={state.lang}
              highlightClass={highlightClass}
            />

            {/* The drawn indicator is always one whose file has arrived, so its prose is here. */}
            <AboutIndicator indicator={parts.get(drawn)!.indicator} lang={state.lang} />
          </div>
          {/*
           * The place, in a row of its own under the map.
           *
           * It used to render after the facts strip, so clicking a municipality changed nothing
           * a visitor could see without scrolling past five facts first. Being under the map was
           * never the problem; being under the facts was. The measures are a table of figures
           * and want the page rather than half of it.
           */}
          {state.selected && (
            <ProfilePanel
              asSheet={narrow}
              openedByVisitor={openedByVisitor}
              lk={lk}
              code={state.selected}
              year={state.year}
              lang={state.lang}
              compare={
                state.compare === null ? (
                  <CompareSearch
                    lk={lk}
                    selected={state.selected}
                    lang={state.lang}
                    onCompare={(compare) => {
                      interrupt()
                      setNotice('')
                      update({ compare })
                    }}
                  />
                ) : null
              }
              story={
                <ProfileStory lk={lk} code={state.selected} year={state.year} lang={state.lang} />
              }
              similar={
                <SimilarPlaces
                  lk={lk}
                  similar={similar}
                  meta={meta}
                  state={state}
                  lang={state.lang}
                  onHighlight={setHighlight}
                />
              }
              onClose={() => {
                const closing = state.selected
                setNotice('')
                update({ selected: null, compare: null })
                // Focus goes back to the shape that opened the panel, rather than being
                // dropped at the top of the document.
                if (closing) mapRef.current?.focusMunicipality(closing)
              }}
            />
          )}

          {state.selected && state.compare !== null && (
            <ComparePanel
              lk={lk}
              selected={state.selected}
              compare={state.compare}
              year={state.year}
              lang={state.lang}
              onCompare={(compare) => {
                interrupt()
                setNotice('')
                update({ compare })
              }}
            />
          )}
        </div>

        {/*
         * Below the views rather than among the controls. They are somewhere to go next, not a
         * control, and putting them in the left column meant a keyboard visitor passed five
         * links before reaching the map.
         */}
        <FactsStrip lang={state.lang} facts={facts} onHighlight={setHighlight} />
      </main>

      <Notices lang={state.lang} />

      <LiveRegion message={announcement} silent={playing} />
    </div>
  )
}
