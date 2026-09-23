import { useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { radiusFor, sizeNorms } from '../../shared/bubbles'
import type { MunicipalityTopology } from '../../shared/geometry'
import type { Adjacency, BubbleLayout } from '../../shared/pantry'
import { observationAt, rankOf, type Lookup } from '../data/select'
import { MapTooltip } from './MapTooltip'
import { formatWithUnit, statusPhrase } from '../i18n/format'
import { t as strings } from '../i18n/strings'
import type { Lang, View } from '../state/url'
import { useMorph } from '../state/useMorph'
import { useTween } from '../state/useTween'
import { FOCUS_RING, fillFor } from '../map/colour'
import { FRAME, shapesFor } from '../map/geometry'
import { place, placementFor, type PlacedCircle } from '../map/frame'
import { circlePath, morphD, pairFor, type MorphPair } from '../map/morph'
import { MAP_CONE_COS, step, type Direction, type NavContext } from '../map/navigate'

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
 *
 * **Since Plan 21 the bubbles are the measure's, not the population's.** Each indicator brings
 * its own layout — positions solved for the slots that measure needs — and a bubble's radius
 * follows the drawn year's value inside its slot. Two more movements follow from that, both
 * driven by `useTween` and written to the DOM the way the morph is: a change of year resizes
 * every bubble in place, and a change of indicator carries every bubble to its new position.
 * See docs/decisions/0024-bubbles-sized-by-the-measure.md.
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

/** Where the circles are at some moment: what is drawn, what was drawn, or where they belong. */
type Circles = { byCode: ReadonlyMap<string, PlacedCircle>; box: Box }

function boxAround(circles: Iterable<PlacedCircle>, padding: number): Box {
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

const lerpBox = (a: Box, b: Box, t: number): Box => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  width: lerp(a.width, b.width, t),
  height: lerp(a.height, b.height, t),
})

/** The circles part-way from one arrangement to another, code by code. */
function lerpCircles(from: Circles, to: Circles, t: number): Circles {
  if (t >= 1) return to
  if (t <= 0) return from
  const byCode = new Map<string, PlacedCircle>()
  for (const [code, target] of to.byCode) {
    const start = from.byCode.get(code) ?? target
    byCode.set(code, {
      code,
      x: lerp(start.x, target.x, t),
      y: lerp(start.y, target.y, t),
      r: lerp(start.r, target.r, t),
    })
  }
  return { byCode, box: lerpBox(from.box, to.box, t) }
}

const viewBoxOf = (b: Box) =>
  `${b.x.toFixed(1)} ${b.y.toFixed(1)} ${b.width.toFixed(1)} ${b.height.toFixed(1)}`

const MAP_BOX: Box = { x: 0, y: 0, width: FRAME[0], height: FRAME[1] }

export function MapCanvas({
  lk,
  topology,
  adjacency,
  layout,
  view,
  indicatorId,
  year,
  selected,
  lang,
  onSelect,
  onNoMove,
  onMoved,
  highlight = null,
  onHover,
  animate = true,
  ref,
}: {
  lk: Lookup
  topology: MunicipalityTopology
  adjacency: Adjacency
  /** The drawn indicator's own bubble layout, from its pantry file. */
  layout: BubbleLayout
  view: View
  indicatorId: string
  year: number
  selected: string | null
  lang: Lang
  onSelect: (code: string) => void
  /**
   * A municipality the page is pointing at from somewhere else — a neighbour chip, a fact — so
   * the shape it names can be found on the map without the visitor hunting for it. Transient
   * pointer feedback, deliberately not URL state.
   */
  highlight?: string | null
  /** Reports what the pointer or keyboard is on, so the legend can mark the class it falls in. */
  onHover?: (code: string | null) => void
  onNoMove?: (direction: Direction) => void
  onMoved?: (code: string) => void
  /** False when the visitor has asked for less movement: colours snap, and so do the bubbles. */
  animate?: boolean
  ref?: React.Ref<MapHandle>
}) {
  const indicator = lk.indicator(indicatorId)
  const shapes = shapesFor(topology)
  const paths = useRef(new Map<string, SVGPathElement>())
  const [focused, setFocused] = useState<string | null>(null)
  /**
   * What the pointer or the keyboard is on, and where to draw the tooltip.
   *
   * Local to this component rather than lifted: the position changes with every pointer move,
   * and putting it in the page's state would re-render 290 shapes to move one small box.
   */
  const [hover, setHover] = useState<{
    code: string
    x: number
    y: number
    view: View
  } | null>(null)
  /**
   * Whether the shapes are in flight, written by the frame loop rather than held in state.
   *
   * `useMorph` pushes frames straight to the DOM and returns nothing, so this is the only place
   * that knows. A ref because a boolean in state would re-render the map sixty times a second to
   * answer a question only an event handler ever asks.
   */
  const morphing = useRef(false)
  /** The view the shapes were last known to be resting in, so a change to it is a departure. */
  const restingIn = useRef(view)
  /**
   * The input behind the most recent press.
   *
   * Clicking a shape calls `focus()` on it, and a focus event says nothing about what caused it.
   * Without this, a tap on a phone would flash a tooltip under the finger before the profile
   * took focus away again — the one case the tooltip is supposed to stay out of.
   */
  const lastPointerType = useRef('')

  /**
   * The layout, placed in the map's frame. The slots — each municipality's largest bubble in any
   * year — decide the placement and the box the cartogram rests in, so neither moves with the
   * year; only the radii inside them do.
   */
  const placement = useMemo(() => placementFor(layout.circles), [layout])
  const slots = useMemo(() => layout.circles.map((c) => place(c, placement)), [layout, placement])

  /**
   * Each municipality's position between the year's lowest and highest value, or null where it
   * has none. Computed from the same published cells the kitchen sized the slots from, with the
   * same shared rule, which is what guarantees no year's bubble outgrows its slot.
   *
   * Keyed on the SERIES object and the municipality list, not on `lk`. The lookup is rebuilt
   * every time another indicator's file arrives — a profile opening fetches forty-one of them —
   * while the drawn indicator's series object is the same one throughout. Keyed on `lk`, this
   * recomputed identical norms forty-one times, each a new `targets` object, each a fresh tween
   * that repainted all 290 paths for 450 ms: nothing visible, and enough main-thread work that
   * WebKit began missing clicks on the profile's links while the files were landing.
   */
  const series = lk.series(indicatorId)
  const municipalities = lk.data.municipalities
  const kind = indicator.scale.kind
  const norms = useMemo(() => {
    const col = series.years.indexOf(year)
    // Rows are in municipality order, which `checkPantryCrossReferences` holds the series to.
    const column = municipalities.map((_, row) =>
      col === -1 ? null : (series.values[row]?.[col] ?? null),
    )
    const norm = sizeNorms(column, kind)
    return new Map(municipalities.map((m, i) => [m.code, norm[i] ?? null]))
  }, [series, municipalities, year, kind])

  /** Where every bubble belongs right now: its slot's position, the year's radius. */
  const targets = useMemo((): Circles => {
    const sizing = { minR: layout.minR, maxR: layout.maxR }
    const byCode = new Map<string, PlacedCircle>()
    for (const slot of slots) {
      byCode.set(slot.code, {
        ...slot,
        r: radiusFor(norms.get(slot.code) ?? null, sizing) * placement.scale,
      })
    }
    return { byCode, box: boxAround(slots, CARTOGRAM_PADDING) }
  }, [slots, norms, layout, placement])

  /**
   * The 32-point proxies, built once on first use — and only for the outlines, since Plan 21:
   * the circle a shape travels to changes with the year and the indicator, so it is supplied per
   * frame rather than sampled in advance.
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
      for (const shape of shapes) built.set(shape.code, pairFor(probe, shape.code, shape.d))
      return built
    } catch {
      return null
    }
  }, [shapes])

  /** What to draw for one municipality at `t`, travelling to `circle`. */
  const pathFor = useCallback(
    (code: string, mapD: string, t: number, circle: PlacedCircle | undefined): string => {
      if (!circle) return mapD
      const pair = pairs?.get(code)
      // No proxies: cut at the halfway point rather than drawing nothing.
      if (!pair) return t < 0.5 ? mapD : circlePath(circle)
      return morphD(pair, t, circle)
    },
    [pairs],
  )

  const svgRef = useRef<SVGSVGElement>(null)
  const rings = useRef<SVGPathElement[]>([])

  /**
   * The two clocks' current readings, and what the circles look like at this instant.
   *
   * Refs, not state, for the same reason as `morphing`: both clocks write these sixty times a
   * second and only the frame painter reads them.
   */
  const morphT = useRef(view === 'cartogram' ? 1 : 0)
  const drawn = useRef<Circles>(targets)
  const departed = useRef<Circles>(targets)

  /**
   * One frame, written straight to the DOM.
   *
   * This is the whole reason `useMorph` and `useTween` push frames rather than holding progress
   * in state. Only `d` and the viewBox change while the shapes are moving; every fill, every
   * accessible name and every observation lookup stays exactly as it was, and asking React to
   * prove that sixty times a second dropped 13 to 16 frames of every 67 at 4x and 6x throttling.
   */
  const paint = useCallback(() => {
    const t = morphT.current
    const now = drawn.current
    for (const shape of shapes) {
      paths.current
        .get(shape.code)
        ?.setAttribute('d', pathFor(shape.code, shape.d, t, now.byCode.get(shape.code)))
    }
    for (const ring of rings.current) {
      const code = ring.dataset['ringFor']
      if (!code) continue
      ring.setAttribute('d', pathFor(code, shapeD(shapes, code), t, now.byCode.get(code)))
    }
    svgRef.current?.setAttribute('viewBox', viewBoxOf(lerpBox(MAP_BOX, now.box, t)))
  }, [shapes, pathFor])

  /*
   * In flight from the moment the view changes, not from the first frame.
   *
   * `useMorph` starts the animation in an effect and its first frame is a `requestAnimationFrame`
   * after that, so between the button being pressed and the first frame there is a window where
   * the view has already flipped and nothing has said the shapes are moving. A pointer moved in
   * that window took a fresh hover and drew a reading beside a shape about to leave. Rare enough
   * to pass locally every time; WebKit on slower CI hardware found it.
   *
   * A layout effect rather than a line in the render body, because a ref written while rendering
   * is a value React is free to discard — the same reason `useMorph` gives for its own. This runs
   * synchronously with the commit, so no event can be dispatched between the two.
   *
   * Unconditional, including under reduced motion: `useMorph` has no animation to run there and
   * calls the frame straight away, in an effect that follows this one in the same flush, so the
   * flag is corrected to false before anything can be pointed at.
   */
  useLayoutEffect(() => {
    morphing.current = restingIn.current !== view
    restingIn.current = view
  }, [view])

  useMorph(view === 'cartogram' ? 1 : 0, !animate, (t) => {
    /*
     * "Not where it is going", rather than "strictly between the two ends".
     *
     * Firefox hands a `requestAnimationFrame` callback the timestamp the frame began, which can
     * precede the moment the animation was started — so the first frame arrives with a slightly
     * negative `t`, which is not greater than zero, and a flag written as `t > 0 && t < 1` read
     * as "at rest" for exactly one frame at the start of every morph. Long enough for a pointer
     * to find it under load.
     */
    morphing.current = t !== (view === 'cartogram' ? 1 : 0)
    morphT.current = t
    paint()
  })

  /**
   * The bubbles' own movement: from wherever they are drawn to where they now belong, whenever
   * that changes — a new year resizes them in place, a new indicator carries them to its layout.
   *
   * The first frame of a run snapshots what is on screen as the departure point, so a change
   * that lands mid-flight turns the bubbles round from where they are rather than from where
   * they were going. At the map end nothing is visible, so the frame is not painted — but the
   * snapshot is still kept, so a morph that starts later leaves from the right circles.
   */
  useTween(targets, !animate, (progress) => {
    if (progress <= 0) departed.current = drawn.current
    drawn.current = lerpCircles(departed.current, targets, progress)
    if (morphT.current > 0 || morphing.current) paint()
  })

  /**
   * The view the arrow keys answer to.
   *
   * The cones were each measured against their own layout — 45° on the map, and whatever the
   * kitchen proved for this indicator's layout on the bubbles — so mid-flight the keys use the
   * cone of the end being travelled to. A press at t = 0.4 on the way to the bubbles lands where
   * the bubbles would send it, which is where the visitor is about to be looking.
   */
  const atCartogram = view === 'cartogram'
  /**
   * What React renders: the RESTING state of whichever view is current, with every bubble where
   * it belongs. Every frame in between is written by `paint` over the top, and the last one lands
   * exactly here — so the markup a screen reader or a test sees is always one of the two real
   * ends, never a proxy.
   */
  const resting = atCartogram ? 1 : 0

  const nav: NavContext = useMemo(
    () =>
      atCartogram
        ? {
            neighbours: adjacency.neighbours,
            centroids: new Map(slots.map((c) => [c.code, [c.x, c.y] as const])),
            coneCos: Math.cos((layout.cone * Math.PI) / 180),
          }
        : {
            neighbours: adjacency.neighbours,
            centroids: new Map(shapes.map((s) => [s.code, s.centroid])),
            coneCos: MAP_CONE_COS,
          },
    [atCartogram, adjacency, slots, layout, shapes],
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
  const box = lerpBox(MAP_BOX, targets.box, resting)

  /**
   * One municipality's name and reading, in one place.
   *
   * The same two strings are the shape's accessible name and the tooltip's text, and they must
   * be the same two strings: a tooltip that rounded differently from the label it duplicates
   * would be a second, quieter version of the truth.
   */
  const readingOf = useCallback(
    (code: string) => {
      const name = lk.municipality(code)?.name[lang] ?? code
      const { value, status } = observationAt(lk, indicatorId, code, year)
      const reading =
        value === null
          ? statusPhrase(status, lang)
          : status === 'present'
            ? formatWithUnit(value, indicator, lang)
            : `${formatWithUnit(value, indicator, lang)} – ${statusPhrase(status, lang)}`
      return { name, reading, value }
    },
    [lk, lang, indicatorId, year, indicator],
  )

  const showHover = (code: string | null, x: number, y: number) => {
    // Nothing is where it looks like it is until the shapes have finished moving, so a reading
    // drawn beside one mid-flight would be pointing at the wrong place by the time it is read.
    const target = code !== null && !morphing.current ? { code, x, y, view } : null
    setHover(target)
    onHover?.(target?.code ?? null)
  }

  /** The code a pointer or focus event landed on, or null if it landed on the plate. */
  const codeAt = (target: EventTarget | null): string | null => {
    const el = target instanceof Element ? target.closest('path[data-code]') : null
    return el?.getAttribute('data-code') ?? null
  }

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    // Touch already selects on tap, and a tooltip under a finger covers the thing it names.
    if (event.pointerType === 'touch') return
    showHover(codeAt(event.target), event.clientX, event.clientY)
  }

  const onFocusShape = (event: React.FocusEvent<SVGSVGElement>) => {
    // A tap selects, and the selection focuses the shape. That focus is not somebody asking to
    // read it, and a box under a finger covers the thing it names.
    if (lastPointerType.current === 'touch') return
    const code = codeAt(event.target)
    if (!code) return
    // Anchored to the shape rather than to a pointer that is not there: keyboard navigation is
    // how most of this map is read, and the reading should follow the ring.
    const rect = paths.current.get(code)?.getBoundingClientRect()
    showHover(code, rect ? rect.right : 0, rect ? rect.top : 0)
  }

  /**
   * The 290 shapes, rebuilt only when something about them changes.
   *
   * A pointer moving across the map sets a new position on every native `pointermove`, and
   * without this each one of those rebuilt all 290 paths — 290 observation lookups and 290
   * `Intl.NumberFormat` instances, to move a small box a few pixels. The elements are the same
   * objects between hovers, so React skips them entirely.
   *
   * This is the same argument `paint` makes for writing frames straight to the DOM, applied to
   * the other thing that happens at pointer rate.
   */
  const shapeNodes = useMemo(
    () =>
      shapes.map((shape) => {
        const { name, reading } = readingOf(shape.code)
        const { value, status } = observationAt(lk, indicatorId, shape.code, year)
        return (
          <path
            key={shape.code}
            data-code={shape.code}
            data-highlight={shape.code === highlight ? 'true' : undefined}
            ref={(el) => {
              if (el) paths.current.set(shape.code, el)
              else paths.current.delete(shape.code)
            }}
            d={pathFor(shape.code, shape.d, resting, targets.byCode.get(shape.code))}
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
      }),
    [
      shapes,
      readingOf,
      lk,
      indicatorId,
      year,
      indicator,
      pathFor,
      resting,
      targets,
      selected,
      focusCode,
      highlight,
      move,
      onSelect,
    ],
  )

  const live = hover && hover.view === view ? hover : null
  const hovered = live ? readingOf(live.code) : null
  const hoveredRank =
    live && hovered?.value !== null ? rankOf(lk, indicatorId, year, live.code) : null

  const ringD = (code: string) =>
    pathFor(code, shapeD(shapes, code), resting, targets.byCode.get(code))
  const selectedD = selected ? ringD(selected) : undefined
  const highlightD = highlight && highlight !== selected ? ringD(highlight) : undefined
  const focusedD = focused && focused !== selected ? ringD(focused) : undefined

  return (
    <>
      <svg
        viewBox={viewBoxOf(box)}
        role="group"
        aria-label={
          atCartogram ? strings(lang).cartogramLabel(indicator.name[lang]) : strings(lang).mapLabel
        }
        aria-describedby="map-hint"
        className="map"
        data-animate={animate ? 'true' : 'false'}
        data-view={atCartogram ? 'cartogram' : 'map'}
        ref={svgRef}
        onKeyDown={onKeyDown}
        // One listener on the SVG rather than 290 on the shapes: the morph holds 60fps because
        // nothing per-shape happens on a frame, and 290 handler pairs would be the first thing to
        // spend that margin on.
        onPointerDown={(event) => {
          lastPointerType.current = event.pointerType
        }}
        onPointerMove={onPointerMove}
        onPointerLeave={() => showHover(null, 0, 0)}
        onFocus={onFocusShape}
        onBlur={() => showHover(null, 0, 0)}
      >
        {shapeNodes}
        {selectedD && (
          <g data-selection-ring="" pointerEvents="none" ref={collectRings(rings)}>
            <path
              data-ring-for={selected ?? undefined}
              d={selectedD}
              fill="none"
              stroke={FOCUS_RING.halo}
              strokeWidth={6}
              vectorEffect="non-scaling-stroke"
            />
            <path
              data-ring-for={selected ?? undefined}
              d={selectedD}
              fill="none"
              stroke={FOCUS_RING.core}
              strokeWidth={3}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}
        {focusedD && (
          <g data-focus-ring="" pointerEvents="none" ref={collectRings(rings)}>
            <path
              data-ring-for={focused ?? undefined}
              d={focusedD}
              fill="none"
              stroke={FOCUS_RING.halo}
              strokeWidth={6}
              vectorEffect="non-scaling-stroke"
            />
            <path
              data-ring-for={focused ?? undefined}
              d={focusedD}
              fill="none"
              stroke={FOCUS_RING.core}
              strokeWidth={3}
              strokeDasharray="5 4"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}
        {/*
         * A ring rather than a thicker stroke on the shape itself: a stroke is drawn half inside
         * its own path and the neighbours painted after it cover the outer half, so the mark a
         * visitor is following from a chip would fade into whatever happens to be beside it.
         */}
        {highlightD && (
          <g data-highlight-ring="" pointerEvents="none" ref={collectRings(rings)}>
            <path
              data-ring-for={highlight ?? undefined}
              d={highlightD}
              fill="none"
              stroke={FOCUS_RING.halo}
              strokeWidth={6}
              vectorEffect="non-scaling-stroke"
            />
            <path
              data-ring-for={highlight ?? undefined}
              d={highlightD}
              fill="none"
              stroke={FOCUS_RING.core}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}
      </svg>
      {live && hovered && (
        <MapTooltip
          name={hovered.name}
          reading={hovered.reading}
          rank={hoveredRank ? strings(lang).rank(hoveredRank.rank, hoveredRank.outOf) : null}
          x={live.x}
          y={live.y}
        />
      )}
    </>
  )
}

/**
 * Gathers the two paths of a ring group so `paint` can move them with their shape. Each carries
 * the code it follows, because the selection and the keyboard can be on two different
 * municipalities at once.
 */
function collectRings(store: React.RefObject<SVGPathElement[]>) {
  return (group: SVGGElement | null) => {
    if (!group) return
    store.current = [
      ...store.current.filter((p) => p.isConnected && !group.contains(p)),
      ...group.querySelectorAll('path'),
    ]
  }
}

function shapeD(shapes: ReturnType<typeof shapesFor>, code: string): string {
  return shapes.find((s) => s.code === code)?.d ?? ''
}
