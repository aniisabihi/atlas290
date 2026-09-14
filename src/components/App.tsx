import type { MunicipalityTopology } from '../../shared/geometry'
import type { Adjacency, PantryData } from '../../shared/pantry'
import { lookup, observationSentence } from '../data/select'
import { t } from '../i18n/strings'
import { metaFrom } from '../state/url'
import { useAppState } from '../state/useAppState'
import { useReducedMotion } from '../state/useReducedMotion'
import { useState } from 'react'
import { AboutIndicator } from './AboutIndicator'
import { EmptyYear } from './EmptyYear'
import { IndicatorPicker } from './IndicatorPicker'
import { Legend } from './Legend'
import { LiveRegion } from './LiveRegion'
import { YearSlider } from './YearSlider'
import { MapView } from './MapView'
import { SearchBox } from './SearchBox'
import { NoDataPatterns } from './NoDataPatterns'

/**
 * The shell. Everything it renders is a function of the URL; nothing else holds state.
 *
 * Plan 3's remaining tasks hang their controls here — the indicator picker, the year slider,
 * search, the legend and the live region — each one reading the same state and reporting back
 * through the same `update`.
 */
export function App({
  data,
  topology,
  adjacency,
}: {
  data: PantryData
  topology: MunicipalityTopology
  adjacency: Adjacency
}) {
  const meta = metaFrom(data)
  const lk = lookup(data)
  const [state, update] = useAppState(meta)
  const strings = t(state.lang)
  const [playing, setPlaying] = useState(false)
  const reducedMotion = useReducedMotion()
  const indicator = lk.indicator(state.indicator)
  const covered = state.year >= indicator.coverage.from && state.year <= indicator.coverage.to

  /** Any deliberate interaction stops the playback rather than fighting it. */
  const interrupt = () => setPlaying(false)

  /**
   * A one-off message that takes precedence over the usual sentence — currently only "no
   * neighbour that way", which has to be said at the moment the key is pressed rather than
   * inferred from the state, because nothing about the state changed.
   */
  const [notice, setNotice] = useState('')
  const announcement =
    notice ||
    (state.selected
      ? observationSentence(lk, state.indicator, state.selected, state.year, state.lang)
      : strings.selectionCleared)

  return (
    <main>
      <NoDataPatterns />
      <h1>{strings.siteName}</h1>
      <p>{strings.tagline}</p>
      <p id="map-hint">{strings.mapHint}</p>
      <IndicatorPicker
        lk={lk}
        selected={state.indicator}
        lang={state.lang}
        onChange={(chosen) => {
          interrupt()
          // The year is deliberately kept. If the new indicator does not cover it, EmptyYear
          // explains and offers a jump; silently moving the year would hide the fact that the
          // ten indicators do not cover the same span.
          update({ indicator: chosen })
        }}
      />
      <SearchBox
        municipalities={data.municipalities}
        lang={state.lang}
        onSelect={(code) => {
          interrupt()
          update({ selected: code })
        }}
      />
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
      {!covered && (
        <EmptyYear
          lk={lk}
          indicatorId={state.indicator}
          year={state.year}
          lang={state.lang}
          onYear={(year) => {
            interrupt()
            update({ year })
          }}
        />
      )}
      <MapView
        lk={lk}
        topology={topology}
        adjacency={adjacency}
        indicatorId={state.indicator}
        year={state.year}
        selected={state.selected}
        lang={state.lang}
        animate={!reducedMotion}
        onNoMove={() => setNotice(strings.noNeighbour)}
        onSelect={(code) => {
          interrupt()
          setNotice('')
          update({ selected: code === state.selected ? null : code })
        }}
      />
      <Legend lk={lk} indicatorId={state.indicator} year={state.year} lang={state.lang} />
      <AboutIndicator lk={lk} indicatorId={state.indicator} lang={state.lang} />
      <LiveRegion message={announcement} silent={playing} />
    </main>
  )
}
