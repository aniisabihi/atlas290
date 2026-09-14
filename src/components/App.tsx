import { useEffect, useRef, useState } from 'react'
import type { MunicipalityTopology } from '../../shared/geometry'
import type { Adjacency, Bubbles, PantryData } from '../../shared/pantry'
import { lookup, observationSentence } from '../data/select'
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
import { Cartogram } from './Cartogram'
import { MapView, type MapHandle } from './MapView'
import { ComparePanel } from './ComparePanel'
import { DataTable } from './DataTable'
import { ProfilePanel } from './ProfilePanel'
import { NoDataPatterns } from './NoDataPatterns'
import { SearchBox } from './SearchBox'
import { YearSlider } from './YearSlider'

/**
 * The shell. Everything it renders is a function of the URL; the only state that lives outside
 * the address bar is whether the year is playing and where the keyboard happens to be, neither of
 * which anyone would want in a shared link.
 */
/** Matches the layout breakpoint in app.css, so CSS and behaviour cannot disagree. */
export const NARROW = '(max-width: 60rem)'

export function App({
  data,
  topology,
  adjacency,
  bubbles,
}: {
  data: PantryData
  topology: MunicipalityTopology
  adjacency: Adjacency
  bubbles: Bubbles
}) {
  const meta = metaFrom(data)
  const lk = lookup(data)
  const [state, update] = useAppState(meta)
  const strings = t(state.lang)
  const [playing, setPlaying] = useState(false)
  const reducedMotion = useReducedMotion()
  const indicator = lk.indicator(state.indicator)
  const covered = state.year >= indicator.coverage.from && state.year <= indicator.coverage.to

  // The tab, and what a screen reader announces on arrival. Set from the state rather than
  // written once in the HTML, so a shared link says where it goes.
  useEffect(() => {
    document.title = titleFor(lk, state)
  }, [lk, state])

  /** Any deliberate interaction stops the playback rather than fighting it. */
  const interrupt = () => setPlaying(false)

  /**
   * A one-off message that takes precedence over the usual sentence — currently only "no
   * neighbour that way", which has to be said at the moment the key is pressed rather than
   * inferred from the state, because nothing about the state changed.
   */
  const [notice, setNotice] = useState('')
  const mapRef = useRef<MapHandle>(null)
  /**
   * Below this width the bubbles are the default: they give equal tap targets and waste no width
   * on a country three times taller than it is wide, and the panel becomes a sheet.
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
      ? observationSentence(lk, state.indicator, state.selected, state.year, state.lang)
      : strings.selectionCleared)

  return (
    <div className="page">
      <NoDataPatterns />
      <a className="skip-link" href="#map">
        {strings.skipToMap}
      </a>

      <header className="page-header">
        <div>
          <h1>{strings.siteName}</h1>
          <p className="tagline">{strings.tagline}</p>
        </div>
        <LanguageSwitch state={state} meta={meta} />
      </header>

      <div className="layout">
        <div className="controls">
          <div className="panel">
            <SearchBox
              municipalities={data.municipalities}
              lang={state.lang}
              onSelect={(code) => {
                interrupt()
                setNotice('')
                update({ selected: code })
              }}
            />
          </div>

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

          <div className="panel year-slider-panel">
            <YearSlider
              lk={lk}
              meta={meta}
              indicatorId={state.indicator}
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

          <div className="panel">
            <Legend lk={lk} indicatorId={state.indicator} year={state.year} lang={state.lang} />
          </div>

          <div className="panel">
            <AboutIndicator lk={lk} indicatorId={state.indicator} lang={state.lang} />
          </div>
        </div>

        <div className="map-column">
          <p id="map-hint" className="tagline">
            {strings.mapHint}
          </p>
          {!covered && (
            <EmptyYear
              lk={lk}
              indicatorId={state.indicator}
              year={state.year}
              lang={state.lang}
              onYear={(year) => {
                interrupt()
                setNotice('')
                update({ year })
              }}
            />
          )}
          <div className="view-switch">
            <button
              type="button"
              aria-pressed={state.table}
              onClick={() => {
                interrupt()
                update({ table: !state.table })
              }}
            >
              {state.table ? strings.hideTable : strings.showTable}
            </button>
          </div>

          <div className="view-switch">
            <button
              type="button"
              aria-pressed={view === 'map'}
              onClick={() => {
                interrupt()
                update({ view: 'map' })
              }}
            >
              {strings.showMap}
            </button>
            <button
              type="button"
              aria-pressed={view === 'cartogram'}
              onClick={() => {
                interrupt()
                update({ view: 'cartogram' })
              }}
            >
              {strings.showCartogram}
            </button>
          </div>

          {state.table ? (
            <DataTable
              lk={lk}
              indicatorId={state.indicator}
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
            <div className="map-frame" id="map">
              {view === 'cartogram' ? (
                <Cartogram
                  ref={mapRef}
                  lk={lk}
                  bubbles={bubbles}
                  adjacencyNeighbours={adjacency.neighbours}
                  indicatorId={state.indicator}
                  year={state.year}
                  selected={state.selected}
                  lang={state.lang}
                  onNoMove={() => setNotice(strings.noNeighbour)}
                  onMoved={() => setNotice('')}
                  onSelect={(code) => {
                    interrupt()
                    setNotice('')
                    update({ selected: code === state.selected ? null : code })
                  }}
                />
              ) : (
                <MapView
                  ref={mapRef}
                  lk={lk}
                  topology={topology}
                  adjacency={adjacency}
                  indicatorId={state.indicator}
                  year={state.year}
                  selected={state.selected}
                  lang={state.lang}
                  animate={!reducedMotion}
                  onNoMove={() => setNotice(strings.noNeighbour)}
                  onMoved={() => setNotice('')}
                  onSelect={(code) => {
                    interrupt()
                    setNotice('')
                    update({ selected: code === state.selected ? null : code })
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {state.selected && (
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

      {state.selected && (
        <ProfilePanel
          asSheet={narrow}
          lk={lk}
          code={state.selected}
          year={state.year}
          lang={state.lang}
          onClose={() => {
            const closing = state.selected
            setNotice('')
            update({ selected: null, compare: null })
            // Focus goes back to the shape that opened the panel, rather than being dropped at
            // the top of the document.
            if (closing) mapRef.current?.focusMunicipality(closing)
          }}
        />
      )}

      <LiveRegion message={announcement} silent={playing} />
    </div>
  )
}
