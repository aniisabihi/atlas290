import { schemeBlues, schemePuOr } from 'd3-scale-chromatic'
import type { IndicatorMeta } from '../../shared/pantry'
import type { CellStatus } from '../i18n/format'
import { classOf } from '../data/select'

/**
 * Colour, and what absence looks like.
 *
 * DESIGN section 5 used to ask for at least 3:1 contrast between adjacent classes. That is not
 * buildable: contrast ratios telescope along a monotonic lightness sequence, the ceiling is
 * 21:1, and 3^(n-1) <= 21 caps a scale at three classes. Every indicator here has seven. The
 * requirement was replaced with four that can be met, and this module is where they are met.
 */

/** Relative luminance, WCAG 2.x definition. */
export function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

export function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (lighter + 0.05) / (darker + 0.05)
}

/** The ground the map sits on: distinct from every class fill and every no-data ground. */
export const MAP_GROUND = '#ffffff'

/**
 * Two tones, not one, and the tests prove that is necessary rather than decorative. A ring dark
 * enough to reach 3:1 against the lightest class is too dark to reach it against the darkest;
 * one light tone and one dark tone always leave one of them in contrast, whatever it sits on.
 */
export const FOCUS_RING = { core: '#111111', halo: '#ffffff' } as const

/**
 * Sequential: ColorBrewer Blues, monotonic in lightness, so the class order survives greyscale,
 * a monochrome print and any colour vision deficiency.
 *
 * Diverging: ColorBrewer PuOr. Purple against orange, rather than red against green, because
 * red-green is precisely the axis the two commonest deficiencies collapse. Measured against the
 * alternatives, PuOr also keeps the most lightness between its two ends (2.13:1, against 1.16
 * for RdBu and 1.08 for BrBG) — still not enough to read direction by lightness alone, which is
 * why the legend and the announcement say it in words.
 */
export function paletteFor(indicator: IndicatorMeta): string[] {
  const classes = indicator.scale.breaks.length + 1
  const scheme = indicator.scale.kind === 'diverging' ? schemePuOr : schemeBlues
  const ramp = scheme[classes]
  if (!ramp) throw new Error(`${indicator.id}: no ${classes}-class ramp available`)
  // ColorBrewer publishes PuOr purple-first, so class 0 (the most negative) is purple and the
  // last class (the most positive) is orange. Left in that order deliberately — there is no
  // convention that makes either direction "right", so the direction is pinned by a test rather
  // than left to whoever next edits this line.
  return [...ramp]
}

export type NoValueStatus = Exclude<CellStatus, 'present' | 'perturbed'>

/**
 * The four statuses that carry no value, told apart by pattern rather than by colour, so they
 * survive any colour vision deficiency and a monochrome print. Each ground is at least as light
 * as the lightest class, so no absence can be misread as a low value.
 */
export const NO_VALUE_FILLS: Record<NoValueStatus, { patternId: string; ground: string }> = {
  'did-not-exist': { patternId: 'fill-did-not-exist', ground: '#ffffff' },
  'not-yet-published': { patternId: 'fill-not-yet-published', ground: '#f7f7f7' },
  'too-few-cases': { patternId: 'fill-too-few-cases', ground: '#f7f7f7' },
  'structural-break': { patternId: 'fill-structural-break', ground: '#f7f7f7' },
  'outside-coverage': { patternId: 'fill-not-yet-published', ground: '#f7f7f7' },
  // Widely spaced horizontals, told apart from the 45-degree hatch of 'not-yet-published' by
  // direction as well as spacing — the two are the absences most easily confused, and they are
  // the two whose difference matters most: nothing to count, against not published yet.
  'nothing-to-count': { patternId: 'fill-nothing-to-count', ground: '#f7f7f7' },
}

export function fillFor(
  indicator: IndicatorMeta,
  value: number | null,
  status: CellStatus,
): string {
  // 'perturbed' is the one non-present status that carries a number: SCB has added noise to it,
  // which is a caveat to state rather than a value to withhold. It keeps its class colour and is
  // annotated in the legend and the announcement instead.
  const klass = classOf(indicator, value)
  if (klass !== null) {
    const fill = paletteFor(indicator)[klass]
    if (!fill) throw new Error(`${indicator.id}: no fill for class ${klass}`)
    return fill
  }
  const absent = NO_VALUE_FILLS[status as NoValueStatus]
  if (!absent) throw new Error(`${indicator.id}: status "${status}" has no value and no pattern`)
  return `url(#${absent.patternId})`
}

/**
 * Which class contains zero on a diverging scale, or null if the scale has no zero to mark.
 *
 * The breaks are quantiles of the real data, so zero does not land on one: net migration runs
 * [-6.47, -2.32, 0.61, 3.28, 6.15, 10.5] and zero sits inside the third class. The legend marks
 * where it actually falls rather than pretending the ramp is centred on it.
 */
export function zeroClassOf(indicator: IndicatorMeta): number | null {
  if (indicator.scale.kind !== 'diverging') return null
  return classOf(indicator, 0)
}
