import { describe, expect, it } from 'vitest'
import rawBubbles from '../../public/pantry/layout/bubbles.json'
import { Bubbles } from '../../shared/pantry'
import { FRAME } from '../../shared/geometry'
import { boundsOf, place, placeAll, placementFor } from './frame'

const bubbles = Bubbles.parse(rawBubbles)
const circles = bubbles.circles

describe('boundsOf', () => {
  it('includes the radii, because a circle near an edge sticks out past its centre', () => {
    const b = boundsOf([{ code: '0001', x: 0.5, y: 0.5, r: 0.2 }])
    expect(b).toEqual({ minX: 0.3, minY: 0.3, maxX: 0.7, maxY: 0.7 })
  })

  it('spans the whole committed layout, which is not a unit square', () => {
    const b = boundsOf(circles)
    expect(b.minX).toBeCloseTo(0.0535, 4)
    expect(b.minY).toBeCloseTo(0.0544, 4)
    expect(b.maxX).toBeCloseTo(0.8964, 4)
    // Past 1: a circle whose centre sits near the bottom edge spills over it.
    expect(b.maxY).toBeCloseTo(1.0609, 4)
    // 0.837 wide for every 1 tall, against a frame that is 0.5 — so the width limits, and
    // scaling x and y separately would stretch the layout to twice its height.
    const aspect = (b.maxX - b.minX) / (b.maxY - b.minY)
    expect(aspect).toBeCloseTo(0.837, 3)
  })

  it('throws rather than returning an infinite box for no circles', () => {
    expect(() => boundsOf([])).toThrow(/no circles to place/)
  })
})

describe('placementFor', () => {
  it('uses one scale for both axes, so a circle stays a circle', () => {
    // The defect this exists to prevent: scaling x by 1000 and y by 2000 stretches the layout
    // to twice its height and leaves a radius with two different values depending on which way
    // it is measured. The morph prototype did exactly that.
    const at = placementFor(circles)
    const placed = place({ code: 'x', x: 0.5, y: 0.5, r: 0.1 }, at)
    const widthAcross = place({ code: 'x', x: 0.6, y: 0.5, r: 0 }, at).x - placed.x
    const heightDown = place({ code: 'x', x: 0.5, y: 0.6, r: 0 }, at).y - placed.y
    expect(widthAcross).toBeCloseTo(heightDown, 10)
  })

  it('fits rather than fills, so nothing is ever clipped', () => {
    const placed = placeAll(circles)
    for (const c of placed) {
      expect(c.x - c.r, c.code).toBeGreaterThanOrEqual(0)
      expect(c.y - c.r, c.code).toBeGreaterThanOrEqual(0)
      expect(c.x + c.r, c.code).toBeLessThanOrEqual(FRAME[0])
      expect(c.y + c.r, c.code).toBeLessThanOrEqual(FRAME[1])
    }
  })

  it('leaves the padding it was asked for on the limiting axis', () => {
    const at = placementFor(circles, FRAME, 20)
    const b = boundsOf(circles)
    const left = b.minX * at.scale + at.offsetX
    const right = b.maxX * at.scale + at.offsetX
    const top = b.minY * at.scale + at.offsetY
    const bottom = b.maxY * at.scale + at.offsetY
    expect(Math.min(left, top)).toBeGreaterThanOrEqual(20 - 1e-9)
    expect(Math.min(FRAME[0] - right, FRAME[1] - bottom)).toBeGreaterThanOrEqual(20 - 1e-9)
    // One axis touches the padding exactly; the other is centred with slack.
    const tightAcross = Math.abs(left - 20) < 1e-6 && Math.abs(FRAME[0] - right - 20) < 1e-6
    const tightDown = Math.abs(top - 20) < 1e-6 && Math.abs(FRAME[1] - bottom - 20) < 1e-6
    expect(tightAcross || tightDown).toBe(true)
  })

  it('centres the layout on the axis that is not limiting', () => {
    const at = placementFor(circles)
    const b = boundsOf(circles)
    const top = b.minY * at.scale + at.offsetY
    const bottom = b.maxY * at.scale + at.offsetY
    // The committed layout is wide relative to a 1:2 frame, so width limits and the slack is
    // vertical. Asserted as "equal gaps", not as "the gap is N", so it survives a new layout.
    expect(top).toBeCloseTo(FRAME[1] - bottom, 6)
  })

  it('lets the height limit when the layout is tall', () => {
    // Which axis wins is computed, not assumed, so a future bubble layout cannot silently
    // overflow. A tall thin layout must be limited by height.
    const tall = [
      { code: '0001', x: 0.5, y: 0, r: 0.01 },
      { code: '0002', x: 0.5, y: 1, r: 0.01 },
    ]
    const at = placementFor(tall, [1000, 2000], 20)
    expect(at.scale).toBeCloseTo((2000 - 40) / (1 + 0.02), 6)
  })

  it('throws on a layout with no extent rather than dividing by zero', () => {
    expect(() => placementFor([{ code: '0001', x: 0.5, y: 0.5, r: 0 }])).toThrow(/no extent/)
  })
})

describe('placeAll', () => {
  it('places every circle and keeps its code', () => {
    const placed = placeAll(circles)
    expect(placed).toHaveLength(circles.length)
    expect(placed.map((c) => c.code)).toEqual(circles.map((c) => c.code))
  })

  it('keeps every radius positive, so no municipality vanishes', () => {
    for (const c of placeAll(circles)) expect(c.r, c.code).toBeGreaterThan(0)
  })

  it('preserves the layout — relative distances are unchanged', () => {
    const at = placementFor(circles)
    const [a, b] = [circles[0]!, circles[1]!]
    const before = Math.hypot(a.x - b.x, a.y - b.y)
    const [pa, pb] = [place(a, at), place(b, at)]
    const after = Math.hypot(pa.x - pb.x, pa.y - pb.y)
    expect(after / before).toBeCloseTo(at.scale, 6)
  })
})
