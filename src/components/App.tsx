import type { MunicipalityTopology } from '../../shared/geometry'
import type { Adjacency, PantryData } from '../../shared/pantry'
import { lookup } from '../data/select'
import { t } from '../i18n/strings'
import { metaFrom } from '../state/url'
import { useAppState } from '../state/useAppState'
import { useReducedMotion } from '../state/useReducedMotion'
import { useState } from 'react'
import { AboutIndicator } from './AboutIndicator'
import { EmptyYear } from './EmptyYear'
import { IndicatorPicker } from './IndicatorPicker'
import { Legend } from './Legend'
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
        onChange={(indicator) => {
          interrupt()
          // The year is deliberately kept. If the new indicator does not cover it, EmptyYear
          // explains and offers a jump; silently moving the year would hide the fact that the
          // ten indicators do not cover the same span.
          update({ indicator })
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
        onYear={(year, stepping) => update({ year }, { replace: stepping })}
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
        onSelect={(code) => {
          interrupt()
          update({ selected: code === state.selected ? null : code })
        }}
      />
      <Legend lk={lk} indicatorId={state.indicator} year={state.year} lang={state.lang} />
      <AboutIndicator lk={lk} indicatorId={state.indicator} lang={state.lang} />
    </main>
  )
}
