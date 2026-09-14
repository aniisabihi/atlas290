import { describe, expect, it } from 'vitest'
import rawData from '../../public/pantry/data/indicators.json'
import { PantryData, type Indicator } from '../../shared/pantry'
import {
  FOCUS_RING,
  MAP_GROUND,
  NO_VALUE_FILLS,
  contrast,
  fillFor,
  luminance,
  paletteFor,
  zeroClassOf,
} from './colour'

const data = PantryData.parse(rawData)
const byId = (id: string): Indicator => {
  const i = data.indicators.find((x) => x.id === id)
  if (!i) throw new Error(`no indicator ${id}`)
  return i
}
const sequential = byId('population')
const diverging = byId('net-migration-rate')

describe('contrast, the arithmetic everything below rests on', () => {
  it('gives 21:1 for black on white and 1:1 for a colour on itself', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrast('#4292c6', '#4292c6')).toBeCloseTo(1, 5)
  })

  it('is symmetric', () => {
    expect(contrast('#eff3ff', '#084594')).toBeCloseTo(contrast('#084594', '#eff3ff'), 10)
  })
})

describe('paletteFor', () => {
  it('gives one fill per class, which is one more than the breaks', () => {
    expect(paletteFor(sequential)).toHaveLength(sequential.scale.breaks.length + 1)
    expect(paletteFor(sequential)).toHaveLength(7)
  })

  it('gives a sequential ramp strictly monotonic lightness, so its order survives greyscale', () => {
    const lums = paletteFor(sequential).map(luminance)
    for (const [i, l] of lums.slice(1).entries()) {
      expect(l, `class ${i + 1} must be darker than class ${i}`).toBeLessThan(lums[i]!)
    }
  })

  it('gives a diverging ramp a light middle and two dark arms', () => {
    const lums = paletteFor(diverging).map(luminance)
    const middle = (lums.length - 1) / 2
    expect(lums[middle]).toBeGreaterThan(lums[0]!)
    expect(lums[middle]).toBeGreaterThan(lums[lums.length - 1]!)
  })

  it('separates a diverging ramp by hue, since lightness alone cannot tell its two arms apart', () => {
    // Measured and recorded in DESIGN section 5: the two ends of a diverging ramp are close in
    // lightness by construction. This asserts the mitigation — that they are far apart in hue —
    // rather than asserting a lightness separation that cannot exist.
    const fills = paletteFor(diverging)
    const hue = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
        number,
        number,
        number,
      ]
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const d = max - min
      if (d === 0) return 0
      const h =
        max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
      return h * 60
    }
    const apart = Math.abs(hue(fills[0]!) - hue(fills[fills.length - 1]!))
    expect(Math.min(apart, 360 - apart)).toBeGreaterThan(90)
  })
})

describe('the diverging ramp keeps its direction', () => {
  it('runs purple for the most negative class to orange for the most positive', () => {
    // Pinned so that a future edit reversing the ramp has to say so out loud. Without this,
    // flipping it would silently invert every migration map and break nothing.
    const fills = paletteFor(diverging)
    const isPurple = (hex: string) => {
      const [r, , b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [
        number,
        number,
        number,
      ]
      return b > r
    }
    expect(isPurple(fills[0]!)).toBe(true)
    expect(isPurple(fills[fills.length - 1]!)).toBe(false)
  })
})

describe('the focus ring', () => {
  const everything = [
    ...paletteFor(sequential),
    ...paletteFor(diverging),
    ...Object.values(NO_VALUE_FILLS).map((f) => f.ground),
    MAP_GROUND,
  ]

  it('has at least one tone meeting 3:1 against every fill on the map', () => {
    // A single ring colour cannot do this and the arithmetic says so: a tone dark enough for the
    // lightest class is too dark for the darkest one. Two tones, one light and one dark, always
    // leave one of them in contrast.
    for (const fill of everything) {
      const best = Math.max(contrast(FOCUS_RING.core, fill), contrast(FOCUS_RING.halo, fill))
      expect(best, `neither ring tone reaches 3:1 against ${fill}`).toBeGreaterThanOrEqual(3)
    }
  })

  it('proves a single tone would not have been enough', () => {
    const fills = paletteFor(sequential)
    const lightest = fills[0]!
    const darkest = fills[fills.length - 1]!
    const coreOnly = Math.min(
      contrast(FOCUS_RING.core, lightest),
      contrast(FOCUS_RING.core, darkest),
    )
    const haloOnly = Math.min(
      contrast(FOCUS_RING.halo, lightest),
      contrast(FOCUS_RING.halo, darkest),
    )
    expect(Math.max(coreOnly, haloOnly)).toBeLessThan(3)
  })

  it('has two tones that are themselves distinguishable, or the ring is one thick line', () => {
    expect(contrast(FOCUS_RING.core, FOCUS_RING.halo)).toBeGreaterThanOrEqual(7)
  })
})

describe('what absence looks like', () => {
  it('gives each of the four no-value statuses its own pattern', () => {
    const ids = Object.values(NO_VALUE_FILLS).map((f) => f.patternId)
    expect(new Set(ids).size).toBe(4)
    expect(ids.every((id) => id.length > 0)).toBe(true)
  })

  it('never gives a no-value status a flat colour from any ramp', () => {
    const ramps = new Set([...paletteFor(sequential), ...paletteFor(diverging)])
    for (const status of Object.keys(NO_VALUE_FILLS)) {
      const fill = fillFor(sequential, null, status as never)
      expect(fill.startsWith('url(#')).toBe(true)
      expect(ramps.has(fill)).toBe(false)
    }
  })

  it('is told apart by pattern rather than by a grey that could pass for a class', () => {
    // Every no-value ground is lighter than the lightest class, so none of them can be misread
    // as a low value. The pattern on top is what distinguishes them from each other.
    const lightestClass = luminance(paletteFor(sequential)[0]!)
    for (const [status, fill] of Object.entries(NO_VALUE_FILLS)) {
      expect(luminance(fill.ground), `${status} ground`).toBeGreaterThanOrEqual(lightestClass)
    }
  })
})

describe('fillFor', () => {
  it('colours a published value by its class', () => {
    expect(fillFor(sequential, 995574, 'present')).toBe(paletteFor(sequential)[6])
    expect(fillFor(sequential, 0, 'present')).toBe(paletteFor(sequential)[0])
  })

  it('keeps the class colour for a perturbed value, because the value is real', () => {
    // SCB adds noise from 2025; that is a caveat to state, not a number to withhold. This is
    // the one non-present status that carries a value.
    expect(fillFor(sequential, 999239, 'perturbed')).toBe(fillFor(sequential, 999239, 'present'))
  })

  it('patterns a redrawn boundary, because that cell has no value at all', () => {
    // Corrected from the plan, which assumed these cells kept a value: all five
    // structural-break cells in the published pantry are null.
    expect(fillFor(sequential, null, 'structural-break')).toBe(
      `url(#${NO_VALUE_FILLS['structural-break'].patternId})`,
    )
  })
})

describe('zeroClassOf', () => {
  it('finds the class that actually contains zero on a diverging scale', () => {
    // The breaks are quantiles, so zero does not sit on one: net migration runs
    // [-6.47, -2.32, 0.61, 3.28, 6.15, 10.5] and zero falls inside the third class.
    expect(diverging.scale.breaks).toEqual([-6.47, -2.32, 0.61, 3.28, 6.15, 10.5])
    expect(zeroClassOf(diverging)).toBe(2)
  })

  it('is null for a sequential scale, which has no zero to mark', () => {
    expect(zeroClassOf(sequential)).toBeNull()
  })
})
