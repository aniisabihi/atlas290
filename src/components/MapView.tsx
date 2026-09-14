import { useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { MunicipalityTopology } from '../../shared/geometry'
import type { Adjacency } from '../../shared/pantry'
import { observationAt, type Lookup } from '../data/select'
import { formatWithUnit, statusPhrase } from '../i18n/format'
import { t } from '../i18n/strings'
import type { Lang } from '../state/url'
import { FOCUS_RING, fillFor } from '../map/colour'
import { FRAME, shapesFor } from '../map/geometry'
import { step, type Direction, type NavContext } from '../map/navigate'

const ARROWS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

/**
 * The map of Sweden as 290 SVG paths.
 *
 * They are content, not a picture: each one carries its own accessible name with the value and,
 * where there is no value, the reason. A screen reader can read the map the way a sighted
 * visitor scans it.
 *
 * One tab stop, with a roving tabindex inside — 290 stops between the map and the next control
 * would be hostile with a keyboard and worse with a screen reader. The arrow keys move within,
 * which Task 8 wires to the adjacency graph.
 */

/**
 * Lets the page put focus back on a municipality without reaching into the map's DOM. Used when
 * the profile panel closes: focus has to return to the shape that opened it, or a keyboard
 * visitor is dropped at the top of the document.
 */
export type MapHandle = { focusMunicipality: (code: string) => void }

export function MapView({
  lk,
  topology,
  adjacency,
  indicatorId,
  year,
  selected,
  lang,
  onSelect,
  onNoMove,
  onMoved,
  animate = true,
  ref,
}: {
  lk: Lookup
  topology: MunicipalityTopology
  adjacency: Adjacency
  indicatorId: string
  year: number
  selected: string | null
  lang: Lang
  onSelect: (code: string) => void
  /** Called when a key points somewhere there is nothing, so the live region can say so. */
  onNoMove?: (direction: Direction) => void
  /**
   * Called when a key does move. The caller needs this to clear a stale "nothing that way"
   * message: without it, one failed press leaves the live region saying there is no neighbour
   * long after the visitor has walked somewhere else.
   */
  onMoved?: (code: string) => void
  /** False when the visitor has asked for less movement: colours change instantly. */
  animate?: boolean
  ref?: React.Ref<MapHandle>
}) {
  const indicator = lk.indicator(indicatorId)
  const shapes = shapesFor(topology)
  const paths = useRef(new Map<string, SVGPathElement>())

  /**
   * Which shape currently holds the roving tabindex. This is the one piece of state the URL
   * deliberately does not carry: where the keyboard happens to be is not something anyone wants
   * to share in a link, and restoring it on load would move focus without being asked.
   */
  const [focused, setFocused] = useState<string | null>(null)

  const nav: NavContext = useMemo(
    () => ({
      neighbours: adjacency.neighbours,
      centroids: new Map(shapes.map((s) => [s.code, s.centroid])),
    }),
    [adjacency, shapes],
  )

  // The tab stop follows the keyboard, then the selection, and otherwise sits on the first
  // municipality in pantry order, so entering the map with a keyboard always lands somewhere.
  const focusCode = focused ?? selected ?? shapes[0]?.code

  const move = useCallback((to: string) => {
    setFocused(to)
    paths.current.get(to)?.focus()
  }, [])

  useImperativeHandle(ref, () => ({ focusMunicipality: move }), [move])

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<SVGSVGElement>) => {
      const from = focused ?? selected ?? shapes[0]?.code
      if (!from) return
      const direction = ARROWS[event.key]
      if (direction) {
        event.preventDefault() // or the page scrolls out from under the map
        const to = step(from, direction, nav)
        if (to) {
          move(to)
          onMoved?.(to)
        } else {
          onNoMove?.(direction)
        }
        return
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onSelect(from)
        return
      }
      if (event.key === 'Escape' && selected) {
        onSelect(selected) // the caller treats reselecting the selection as clearing it
        return
      }
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault()
        const byName = [...lk.data.municipalities].sort((a, b) =>
          a.name[lang].localeCompare(b.name[lang], 'sv'),
        )
        const target = event.key === 'Home' ? byName[0] : byName[byName.length - 1]
        if (target) move(target.code)
      }
    },
    [focused, selected, shapes, nav, move, onSelect, onNoMove, onMoved, lk, lang],
  )

  const selectedShape = selected ? shapes.find((s) => s.code === selected) : undefined
  // The keyboard's position, drawn separately from the selection. Without this the arrow keys
  // move focus invisibly — which is indistinguishable from them not working at all.
  const focusedShape =
    focused && focused !== selected ? shapes.find((s) => s.code === focused) : undefined

  return (
    <svg
      viewBox={`0 0 ${FRAME[0]} ${FRAME[1]}`}
      role="group"
      aria-label={t(lang).mapLabel}
      aria-describedby="map-hint"
      className="map"
      data-animate={animate ? 'true' : 'false'}
      onKeyDown={onKeyDown}
    >
      {shapes.map((shape) => {
        const municipality = lk.municipality(shape.code)
        const name = municipality?.name[lang] ?? shape.code
        const { value, status } = observationAt(lk, indicatorId, shape.code, year)
        const reading =
          value === null
            ? statusPhrase(status, lang)
            : status === 'present'
              ? formatWithUnit(value, indicator, lang)
              : `${formatWithUnit(value, indicator, lang)} — ${statusPhrase(status, lang)}`
        return (
          <path
            key={shape.code}
            ref={(el) => {
              if (el) paths.current.set(shape.code, el)
              else paths.current.delete(shape.code)
            }}
            d={shape.d}
            role="button"
            aria-label={`${name}, ${reading}`}
            aria-current={shape.code === selected ? 'true' : undefined}
            tabIndex={shape.code === focusCode ? 0 : -1}
            fill={fillFor(indicator, value, status)}
            stroke="#ffffff"
            strokeWidth={0.75}
            vectorEffect="non-scaling-stroke"

            onClick={() => {
              setFocused(shape.code)
              onSelect(shape.code)
            }}
          />
        )
      })}
      {selectedShape && (
        // Drawn last and outside the loop: a neighbour rendered after the selection would paint
        // over its ring. Two tones, so one of them always clears 3:1 against whatever class
        // colour sits underneath (see src/map/colour.ts).
        <g data-selection-ring="" pointerEvents="none" vectorEffect="non-scaling-stroke">
          <path
            d={selectedShape.d}
            fill="none"
            stroke={FOCUS_RING.halo}
            strokeWidth={6}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={selectedShape.d}
            fill="none"
            stroke={FOCUS_RING.core}
            strokeWidth={3}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}
      {focusedShape && (
        // Where the keyboard is, as opposed to what is selected. Dashed, so the two rings are
        // told apart without relying on colour, and drawn after the selection ring so walking
        // past the selected municipality never hides the cursor.
        <g data-focus-ring="" pointerEvents="none">
          <path
            d={focusedShape.d}
            fill="none"
            stroke={FOCUS_RING.halo}
            strokeWidth={6}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={focusedShape.d}
            fill="none"
            stroke={FOCUS_RING.core}
            strokeWidth={3}
            strokeDasharray="5 4"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}
    </svg>
  )
}
