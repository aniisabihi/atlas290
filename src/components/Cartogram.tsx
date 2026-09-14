import { useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { Bubbles } from '../../shared/pantry'
import { observationAt, type Lookup } from '../data/select'
import { formatWithUnit, statusPhrase } from '../i18n/format'
import { t } from '../i18n/strings'
import { FOCUS_RING, fillFor } from '../map/colour'
import { CARTOGRAM_CONE_COS, step, type Direction, type NavContext } from '../map/navigate'
import type { Lang } from '../state/url'
import type { MapHandle } from './MapView'

/**
 * The same 290 municipalities as circles, sized by population.
 *
 * A geographic map of Sweden tells a visual lie about where people are: Norrbotten is a quarter
 * of the country and holds two and a half per cent of its population, so a choropleth gives most
 * of its ink to the emptiest places. One control fixes that, and this is it.
 *
 * Everything else is the map's: the same fills, the same statuses, the same accessible names, the
 * same roving tabindex, the same two-tone ring, the same arrow keys. Only the positions differ —
 * which is why the arrow keys use a slightly wider cone here, measured against this layout rather
 * than inherited from the other one.
 *
 * The animated morph between the two is deliberately not here; it is an increment beyond the
 * first slice.
 */

const PADDING = 0.04

export function Cartogram({
  lk,
  bubbles,
  adjacencyNeighbours,
  indicatorId,
  year,
  selected,
  lang,
  onSelect,
  onNoMove,
  onMoved,
  ref,
}: {
  lk: Lookup
  bubbles: Bubbles
  adjacencyNeighbours: Readonly<Record<string, readonly string[]>>
  indicatorId: string
  year: number
  selected: string | null
  lang: Lang
  onSelect: (code: string) => void
  onNoMove?: (direction: Direction) => void
  onMoved?: (code: string) => void
  ref?: React.Ref<MapHandle>
}) {
  const indicator = lk.indicator(indicatorId)
  const circles = bubbles.circles
  const nodes = useRef(new Map<string, SVGCircleElement>())
  const [focused, setFocused] = useState<string | null>(null)

  // The layout is published in a unit square that its own radii can spill past, so the viewBox is
  // computed from the circles themselves. Nothing is clipped, whatever the layout does next.
  const bounds = useMemo(() => {
    const xs = circles.flatMap((c) => [c.x - c.r, c.x + c.r])
    const ys = circles.flatMap((c) => [c.y - c.r, c.y + c.r])
    const minX = Math.min(...xs) - PADDING
    const minY = Math.min(...ys) - PADDING
    return {
      minX,
      minY,
      width: Math.max(...xs) - minX + PADDING,
      height: Math.max(...ys) - minY + PADDING,
    }
  }, [circles])

  const nav: NavContext = useMemo(
    () => ({
      neighbours: adjacencyNeighbours,
      centroids: new Map(circles.map((c) => [c.code, [c.x, c.y] as const])),
      coneCos: CARTOGRAM_CONE_COS,
    }),
    [adjacencyNeighbours, circles],
  )

  const focusCode = focused ?? selected ?? circles[0]?.code

  const move = useCallback((to: string) => {
    setFocused(to)
    nodes.current.get(to)?.focus()
  }, [])

  useImperativeHandle(ref, () => ({ focusMunicipality: move }), [move])

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<SVGSVGElement>) => {
      const from = focused ?? selected ?? circles[0]?.code
      if (!from) return
      const direction = (
        { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' } as Record<
          string,
          Direction
        >
      )[event.key]
      if (direction) {
        event.preventDefault()
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
      }
    },
    [focused, selected, circles, nav, move, onSelect, onNoMove, onMoved],
  )

  const selectedCircle = selected ? circles.find((c) => c.code === selected) : undefined
  const focusedCircle =
    focused && focused !== selected ? circles.find((c) => c.code === focused) : undefined

  const ring = (circle: { x: number; y: number; r: number }, dashed: boolean) => (
    <>
      <circle
        cx={circle.x}
        cy={circle.y}
        r={circle.r}
        fill="none"
        stroke={FOCUS_RING.halo}
        strokeWidth={6}
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={circle.x}
        cy={circle.y}
        r={circle.r}
        fill="none"
        stroke={FOCUS_RING.core}
        strokeWidth={3}
        strokeDasharray={dashed ? '5 4' : undefined}
        vectorEffect="non-scaling-stroke"
      />
    </>
  )

  return (
    <svg
      className="cartogram"
      viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
      role="group"
      aria-label={t(lang).cartogramLabel}
      aria-describedby="map-hint"
      onKeyDown={onKeyDown}
    >
      {circles.map((circle) => {
        const municipality = lk.municipality(circle.code)
        const name = municipality?.name[lang] ?? circle.code
        const { value, status } = observationAt(lk, indicatorId, circle.code, year)
        const reading =
          value === null
            ? statusPhrase(status, lang)
            : status === 'present'
              ? formatWithUnit(value, indicator, lang)
              : `${formatWithUnit(value, indicator, lang)} — ${statusPhrase(status, lang)}`
        return (
          <circle
            key={circle.code}
            ref={(el) => {
              if (el) nodes.current.set(circle.code, el)
              else nodes.current.delete(circle.code)
            }}
            cx={circle.x}
            cy={circle.y}
            r={circle.r}
            role="button"
            aria-label={`${name}, ${reading}`}
            aria-current={circle.code === selected ? 'true' : undefined}
            tabIndex={circle.code === focusCode ? 0 : -1}
            fill={fillFor(indicator, value, status)}
            stroke="#ffffff"
            strokeWidth={0.75}
            vectorEffect="non-scaling-stroke"
            onClick={() => {
              // `move` rather than `setFocused`: it also calls .focus(), so the roving tabindex
              // and real DOM focus cannot disagree, whatever a given browser does about focusing
              // an SVG shape on click. Where this opens the profile, the panel then takes focus
              // to its own heading, which is Plan 4's rule and happens after this.
              move(circle.code)
              onSelect(circle.code)
            }}
          />
        )
      })}
      {selectedCircle && (
        <g data-selection-ring="" pointerEvents="none">
          {ring(selectedCircle, false)}
        </g>
      )}
      {focusedCircle && (
        <g data-focus-ring="" pointerEvents="none">
          {ring(focusedCircle, true)}
        </g>
      )}
    </svg>
  )
}
