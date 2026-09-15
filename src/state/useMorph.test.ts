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

  it('starts wherever it is pointed', () => {
    expect(renderHook(() => useMorph(0, false)).result.current).toBe(0)
    expect(renderHook(() => useMorph(1, false)).result.current).toBe(1)
  })

  it('travels to the other end and lands exactly on it', () => {
    const { result, rerender } = renderHook(({ to }) => useMorph(to, false), {
      initialProps: { to: 0 as 0 | 1 },
    })
    rerender({ to: 1 })
    advance(MORPH_MS / 2)
    expect(result.current).toBeGreaterThan(0)
    expect(result.current).toBeLessThan(1)
    advance(MORPH_MS)
    // Exactly 1, not 0.9999: morphD draws the real circle only at exactly 1.
    expect(result.current).toBe(1)
  })

  it('turns round from where it is rather than teleporting', () => {
    const { result, rerender } = renderHook(({ to }) => useMorph(to, false), {
      initialProps: { to: 0 as 0 | 1 },
    })
    rerender({ to: 1 })
    advance(MORPH_MS / 2)
    const midway = result.current
    expect(midway).toBeGreaterThan(0.2)
    rerender({ to: 0 })
    advance(1)
    // The first frame after reversing is near where it was, not near the far end.
    expect(Math.abs(result.current - midway)).toBeLessThan(0.1)
    advance(MORPH_MS)
    expect(result.current).toBe(0)
  })

  it('eases rather than moving linearly', () => {
    // The mutation this catches: using `progress` directly instead of `easeInOut(progress)`
    // left every test green, because the easing tests covered the function and not its use.
    // A quarter of the way through the clock, a linear morph is at 0.25 and this one is at
    // 4 * 0.25^3 = 0.0625.
    const { result, rerender } = renderHook(({ to }) => useMorph(to, false), {
      initialProps: { to: 0 as 0 | 1 },
    })
    rerender({ to: 1 })
    advance(MORPH_MS / 4)
    expect(result.current).toBeCloseTo(0.0625, 4)
    expect(result.current).toBeLessThan(0.15)
  })

  it('gives a short return trip a short duration', () => {
    const { result, rerender } = renderHook(({ to }) => useMorph(to, false), {
      initialProps: { to: 0 as 0 | 1 },
    })
    rerender({ to: 1 })
    advance(MORPH_MS * 0.1)
    const near = result.current
    rerender({ to: 0 })
    // Only `near` of the journey is left, so it must finish in well under the full duration.
    advance(MORPH_MS * near + 1)
    expect(result.current).toBe(0)
  })

  it('never schedules a frame when the visitor asked for less motion', () => {
    // Not a shorter morph or a faster one: none at all. A 290-shape flight across the screen
    // is the largest movement on this site, and the setting exists for people that harms.
    const { result, rerender } = renderHook(({ to }) => useMorph(to, true), {
      initialProps: { to: 0 as 0 | 1 },
    })
    expect(callbacks).toHaveLength(0)
    rerender({ to: 1 })
    expect(callbacks).toHaveLength(0)
    expect(result.current).toBe(1)
    rerender({ to: 0 })
    expect(callbacks).toHaveLength(0)
    expect(result.current).toBe(0)
  })

  it('schedules frames when motion is allowed, so the test above means something', () => {
    const { rerender } = renderHook(({ to }) => useMorph(to, false), {
      initialProps: { to: 0 as 0 | 1 },
    })
    rerender({ to: 1 })
    expect(callbacks.length).toBeGreaterThan(0)
  })

  it('stops when it is unmounted mid-flight', () => {
    const cancel = vi.fn()
    vi.stubGlobal('cancelAnimationFrame', cancel)
    const { rerender, unmount } = renderHook(({ to }) => useMorph(to, false), {
      initialProps: { to: 0 as 0 | 1 },
    })
    rerender({ to: 1 })
    advance(MORPH_MS / 4)
    unmount()
    expect(cancel).toHaveBeenCalled()
  })
})
