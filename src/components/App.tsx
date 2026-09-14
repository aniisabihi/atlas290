import type { MunicipalityTopology } from '../../shared/geometry'
import type { Adjacency, PantryData } from '../../shared/pantry'
import { lookup } from '../data/select'
import { t } from '../i18n/strings'
import { metaFrom } from '../state/url'
import { useAppState } from '../state/useAppState'
import { Legend } from './Legend'
import { MapView } from './MapView'
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

  return (
    <main>
      <NoDataPatterns />
      <h1>{strings.siteName}</h1>
      <p>{strings.tagline}</p>
      <p id="map-hint">{strings.mapHint}</p>
      <MapView
        lk={lk}
        topology={topology}
        adjacency={adjacency}
        indicatorId={state.indicator}
        year={state.year}
        selected={state.selected}
        lang={state.lang}
        onSelect={(code) => update({ selected: code === state.selected ? null : code })}
      />
      <Legend lk={lk} indicatorId={state.indicator} year={state.year} lang={state.lang} />
    </main>
  )
}
