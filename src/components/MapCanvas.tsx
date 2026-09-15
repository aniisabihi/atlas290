import { useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { MunicipalityTopology } from '../../shared/geometry'
import type { Adjacency, Bubbles } from '../../shared/pantry'
import { observationAt, type Lookup } from '../data/select'
import { formatWithUnit, statusPhrase } from '../i18n/format'
import { t as strings } from '../i18n/strings'
import type { Lang, View } from '../state/url'
import { useMorph } from '../state/useMorph'
import { FOCUS_RING, fillFor } from '../map/colour'
import { FRAME, shapesFor } from '../map/geometry'
import { placeAll, type PlacedCircle } from '../map/frame'
import { circlePath, morphD, pairFor, type MorphPair } from '../map/morph'
import {
  CARTOGRAM_CONE_COS,
  MAP_CONE_COS,
  step,
  type Direction,
  type NavContext,
} from '../map/navigate'

const ARROWS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

/**
 * The map and the cartogram as one thing, with the 290 municipalities travelling between them.
 *
 * Before this they were two components that replaced each other, and switching views cut. The
 * cut is what made the cartogram a separate picture rather than the same country rearranged —
 * which is the whole point of showing it: a geographic map of Sweden gives most of its ink to
 * the emptiest places, and watching the shapes move is what says so.
 *
 * Everything the two components did separately is here once: the roving tabindex over 290
 * shapes, the two-tone selection ring and the dashed focus ring, the arrow-key cones, the fills
 * and status patterns, the accessible names. None of it is new, and none of it may change.
 */

/**
 * Lets the page put focus back on a municipality without reaching into this component's DOM.
 * Used when the profile panel closes: focus has to return to the shape that opened it, or a
 * keyboard visitor is dropped at the top of the document.
 */
export type MapHandle = { focusMunicipality: (code: string) => void }

/** Space left around the bubbles at the cartogram end, in frame units. */
const CARTOGRAM_PADDING = 24

type Box = { x: number; y: number; width: number; height: number }

function boxAround(circles: readonly PlacedCircle[], padding: number): Box {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const c of circles) {
    minX = Math.min(minX, c.x - c.r)
    minY = Math.min(minY, c.y - c.r)
    maxX = Math.max(maxX, c.x + c.r)
    maxY = Math.max(maxY, c.y + c.r)
  }
  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function MapCanvas({
  lk,
  topology,
  adjacency,
  bubbles,
  view,
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
  bubbles: Bubbles
  view: View
  indicatorId: string
  year: number
  selected: string | null
  lang: Lang
  onSelect: (code: string) => void
  onNoMove?: (direction: Direction) => void
  onMoved?: (code: string) => void
  /** False when the visitor has asked for less movement: colours snap, and so does the morph. */
  animate?: boolean
  ref?: React.Ref<MapHandle>
}) {
  const indicator = lk.indicator(indicatorId)
  const shapes = shapesFor(topology)
  const paths = useRef(new Map<string, SVGPathElement>())
  const [focused, setFocused] = useState<string | null>(null)

  const t = useMorph(view === 'cartogram' ? 1 : 0, !animate)

  /** The bubbles, in the map's own coordinates, so a shape can travel between the two. */
  const circles = useMemo(() => placeAll(bubbles.circles), [bubbles])
  const circleByCode = useMemo(() => new Map(circles.map((c) => [c.code, c])), [circles])

  /**
   * The 32-point proxies, built once on first use.
   *
   * **Absent is a supported state, not a failure.** Sampling needs `getTotalLength`, which jsdom
   * does not implement and an old browser may not either. Without it the views still switch —
   * they simply cut, exactly as they did before this component existed. The morph is the
   * enhancement; being able to see the cartogram is not.
   */
  const pairs = useMemo((): Map<string, MorphPair> | null => {
    if (typeof document === 'undefined') return null
    const probe = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    if (typeof probe.getTotalLength !== 'function') return null
    try {
      const built = new Map<string, MorphPair>()
      for (const shape of shapes) {
        const circle = circleByCode.get(shape.code)
        if (!circle) continue
        built.set(shape.code, pairFor(probe, shape.code, shape.d, circle))
      }
      return built.size === shapes.length ? built : null
    } catch {
      return null
    }
  }, [shapes, circleByCode])

  /** What to draw for one municipality at the current `t`. */
  const pathFor = useCallback(
    (code: string, mapD: string): string => {
      const pair = pairs?.get(code)
      if (!pair) {
        // No proxies: cut at the halfway point rather than drawing nothing.
        const circle = circleByCode.get(code)
        return t < 0.5 || !circle ? mapD : circlePath(circle)
      }
      return morphD(pair, t)
    },
    [pairs, circleByCode, t],
  )

  /**
   * The view the arrow keys answer to.
   *
   * The cones were each measured against their own layout — 45° on the map, 50° on the
   * cartogram, both swept until every municipality was reachable — so mid-flight the keys use
   * the cone of the end being travelled to. A press at t = 0.4 on the way to the bubbles lands
   * where the bubbles would send it, which is where the visitor is about to be looking.
   */
  const atCartogram = view === 'cartogram'

  const nav: NavContext = useMemo(
    () =>
      atCartogram
        ? {
            neighbours: adjacency.neighbours,
            centroids: new Map(circles.map((c) => [c.code, [c.x, c.y] as const])),
            coneCos: CARTOGRAM_CONE_COS,
          }
        : {
            neighbours: adjacency.neighbours,
            centroids: new Map(shapes.map((s) => [s.code, s.centroid])),
            coneCos: MAP_CONE_COS,
          },
    [atCartogram, adjacency, circles, shapes],
  )

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

  /** The viewBox travels too, so the bubbles fill the panel at rest exactly as they did. */
  const cartogramBox = useMemo(() => boxAround(circles, CARTOGRAM_PADDING), [circles])
  const mapBox: Box = { x: 0, y: 0, width: FRAME[0], height: FRAME[1] }
  const box: Box = {
    x: lerp(mapBox.x, cartogramBox.x, t),
    y: lerp(mapBox.y, cartogramBox.y, t),
    width: lerp(mapBox.width, cartogramBox.width, t),
    height: lerp(mapBox.height, cartogramBox.height, t),
  }

  const selectedD = selected ? pathFor(selected, shapeD(shapes, selected)) : undefined
  const focusedD =
    focused && focused !== selected ? pathFor(focused, shapeD(shapes, focused)) : undefined

  return (
    <svg
      viewBox={`${box.x.toFixed(1)} ${box.y.toFixed(1)} ${box.width.toFixed(1)} ${box.height.toFixed(1)}`}
      role="group"
      aria-label={atCartogram ? strings(lang).cartogramLabel : strings(lang).mapLabel}
      aria-describedby="map-hint"
      className="map"
      data-animate={animate ? 'true' : 'false'}
      data-view={atCartogram ? 'cartogram' : 'map'}
      data-morphing={t > 0 && t < 1 ? 'true' : undefined}
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
            d={pathFor(shape.code, shape.d)}
            role="button"
            aria-label={`${name}, ${reading}`}
            aria-current={shape.code === selected ? 'true' : undefined}
            tabIndex={shape.code === focusCode ? 0 : -1}
            fill={fillFor(indicator, value, status)}
            stroke="#ffffff"
            strokeWidth={0.75}
            vectorEffect="non-scaling-stroke"
            onClick={() => {
              move(shape.code)
              onSelect(shape.code)
            }}
          />
        )
      })}
      {selectedD && (
        <g data-selection-ring="" pointerEvents="none">
          <path
            d={selectedD}
            fill="none"
            stroke={FOCUS_RING.halo}
            strokeWidth={6}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={selectedD}
            fill="none"
            stroke={FOCUS_RING.core}
            strokeWidth={3}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}
      {focusedD && (
        <g data-focus-ring="" pointerEvents="none">
          <path
            d={focusedD}
            fill="none"
            stroke={FOCUS_RING.halo}
            strokeWidth={6}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={focusedD}
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

function shapeD(shapes: ReturnType<typeof shapesFor>, code: string): string {
  return shapes.find((s) => s.code === code)?.d ?? ''
}
