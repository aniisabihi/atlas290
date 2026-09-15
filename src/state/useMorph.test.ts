import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { easeInOut, MORPH_MS, useMorph } from './useMorph'

describe('easeInOut', () => {
  it('starts at 0 and ends at 1', () => {
    expect(easeInOut(0)).toBe(0)
    expect(easeInOut(1)).toBe(1)
  })

  it('clamps outside the range rather than overshooting', () => {
    expect(easeInOut(-1)).toBe(0)
    expect(easeInOut(2)).toBe(1)
  })

  it('passes through the middle', () => {
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 10)
  })

  it('is slow at both ends and fast in the middle', () => {
    // What "ease" means, stated as a property rather than as a sampled number, so a different
    // curve with the same character still passes.
    expect(easeInOut(0.1)).toBeLessThan(0.1)
    expect(easeInOut(0.9)).toBeGreaterThan(0.9)
    const middleSpeed = easeInOut(0.55) - easeInOut(0.45)
    const endSpeed = easeInOut(0.1) - easeInOut(0)
    expect(middleSpeed).toBeGreaterThan(endSpeed)
  })

  it('never goes backwards', () => {
    let previous = -1
    for (let i = 0; i <= 100; i++) {
      const value = easeInOut(i / 100)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })
})

describe('useMorph', () => {
  let now = 0
  let callbacks: Array<(t: number) => void> = []

  beforeEach(() => {
    now = 0
    callbacks = []
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
      callbacks.push(cb)
      return callbacks.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** Advance the clock and run whatever frame is pending. */
  const advance = (ms: number) => {
    now += ms
    const pending = callbacks
    callbacks = []
    act(() => {
      for (const cb of pending) cb(now)
    })
  }

  /** Renders the hook and records every frame it pushes. */
  const drive = (initial: 0 | 1, reduced = false) => {
    const frames: number[] = []
    const view = renderHook(
      ({ to, reduce }) =>
        useMorph(to, reduce, (t) => {
          frames.push(t)
        }),
      { initialProps: { to: initial, reduce: reduced } },
    )
    return { frames, ...view }
  }

  const last = (frames: number[]) => frames[frames.length - 1]

  it('pushes the resting value straight away', () => {
    expect(last(drive(0).frames)).toBe(0)
    expect(last(drive(1).frames)).toBe(1)
  })

  it('travels to the other end and lands exactly on it', () => {
    const { frames, rerender } = drive(0)
    rerender({ to: 1, reduce: false })
    advance(MORPH_MS / 2)
    expect(last(frames)).toBeGreaterThan(0)
    expect(last(frames)).toBeLessThan(1)
    advance(MORPH_MS)
    // Exactly 1, not 0.9999: morphD draws the real circle only at exactly 1.
    expect(last(frames)).toBe(1)
  })

  it('pushes a frame for every step, not only the ends', () => {
    // The point of the callback API: the caller writes each frame to the DOM itself, because
    // asking React to re-render 290 paths sixty times a second dropped 13 to 16 frames of
    // every 67 under 4x and 6x CPU throttling.
    const { frames, rerender } = drive(0)
    const before = frames.length
    rerender({ to: 1, reduce: false })
    for (let i = 0; i < 10; i++) advance(MORPH_MS / 20)
    expect(frames.length - before).toBeGreaterThan(8)
  })

  it('turns round from where it is rather than teleporting', () => {
    const { frames, rerender } = drive(0)
    rerender({ to: 1, reduce: false })
    advance(MORPH_MS / 2)
    const midway = last(frames)!
    expect(midway).toBeGreaterThan(0.2)
    rerender({ to: 0, reduce: false })
    advance(1)
    expect(Math.abs(last(frames)! - midway)).toBeLessThan(0.1)
    advance(MORPH_MS)
    expect(last(frames)).toBe(0)
  })

  it('eases rather than moving linearly', () => {
    // A quarter of the way through the clock, a linear morph is at 0.25 and this one is at
    // 4 * 0.25^3 = 0.0625.
    const { frames, rerender } = drive(0)
    rerender({ to: 1, reduce: false })
    advance(MORPH_MS / 4)
    expect(last(frames)).toBeCloseTo(0.0625, 4)
  })

  it('gives a short return trip a short duration', () => {
    const { frames, rerender } = drive(0)
    rerender({ to: 1, reduce: false })
    advance(MORPH_MS * 0.1)
    const near = last(frames)!
    rerender({ to: 0, reduce: false })
    advance(MORPH_MS * near + 1)
    expect(last(frames)).toBe(0)
  })

  it('never schedules a frame when the visitor asked for less motion', () => {
    // Not a shorter morph or a faster one: none at all. A 290-shape flight across the screen
    // is the largest movement on this site, and the setting exists for people that harms.
    const { frames, rerender } = drive(0, true)
    expect(callbacks).toHaveLength(0)
    rerender({ to: 1, reduce: true })
    expect(callbacks).toHaveLength(0)
    expect(last(frames)).toBe(1)
    rerender({ to: 0, reduce: true })
    expect(callbacks).toHaveLength(0)
    expect(last(frames)).toBe(0)
  })

  it('schedules frames when motion is allowed, so the test above means something', () => {
    const { rerender } = drive(0)
    rerender({ to: 1, reduce: false })
    expect(callbacks.length).toBeGreaterThan(0)
  })

  it('does not restart when the callback identity changes', () => {
    // The caller passes an inline arrow. Listing it as a dependency would restart the
    // animation on every render, which is an animation that never finishes.
    const frames: number[] = []
    const { rerender } = renderHook(
      ({ to }) =>
        useMorph(to, false, (t) => {
          frames.push(t)
        }),
      { initialProps: { to: 0 as 0 | 1 } },
    )
    rerender({ to: 1 })
    advance(MORPH_MS / 2)
    const midway = frames[frames.length - 1]!
    rerender({ to: 1 })
    advance(MORPH_MS / 4)
    expect(frames[frames.length - 1]!).toBeGreaterThan(midway)
  })

  it('stops when it is unmounted mid-flight', () => {
    const cancel = vi.fn()
    vi.stubGlobal('cancelAnimationFrame', cancel)
    const { rerender, unmount } = drive(0)
    rerender({ to: 1, reduce: false })
    advance(MORPH_MS / 4)
    unmount()
    expect(cancel).toHaveBeenCalled()
  })
})
