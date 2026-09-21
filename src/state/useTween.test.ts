import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TWEEN_MS, useTween } from './useTween'

/**
 * The clock behind a bubble's change of size or place. The properties that matter: it does not
 * run on mount, it runs once from 0 to 1 when the key changes, its first frame lands before paint,
 * a key that changes mid-flight restarts it, and reduced motion gets no frames at all.
 */
describe('useTween', () => {
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

  const advance = (ms: number) => {
    now += ms
    const pending = callbacks
    callbacks = []
    act(() => {
      for (const cb of pending) cb(now)
    })
  }

  const drive = (reduced = false) => {
    const frames: number[] = []
    const view = renderHook(
      ({ key, reduce }) =>
        useTween(key, reduce, (p) => {
          frames.push(p)
        }),
      { initialProps: { key: 'a', reduce: reduced } },
    )
    return { frames, ...view }
  }

  it('is at rest on mount: one frame at 1 and no animation', () => {
    const { frames } = drive()
    expect(frames).toEqual([1])
    expect(callbacks).toHaveLength(0)
  })

  it('runs from 0 to 1 when the key changes, easing, and lands exactly on 1', () => {
    const { frames, rerender } = drive()
    rerender({ key: 'b', reduce: false })
    // The first frame is written synchronously with the commit, so nothing paints at the end.
    expect(frames[frames.length - 1]).toBe(0)
    advance(TWEEN_MS / 2)
    expect(frames[frames.length - 1]).toBeCloseTo(0.5, 6)
    advance(TWEEN_MS / 2)
    expect(frames[frames.length - 1]).toBe(1)
    expect(callbacks).toHaveLength(0)
    // Monotonic.
    const run = frames.slice(1)
    expect(run).toEqual([...run].sort((a, b) => a - b))
  })

  it('does not run again for a render that keeps the key', () => {
    const { frames, rerender } = drive()
    rerender({ key: 'a', reduce: false })
    expect(frames).toEqual([1])
  })

  it('restarts from 0 when the key changes mid-flight', () => {
    const { frames, rerender } = drive()
    rerender({ key: 'b', reduce: false })
    advance(TWEEN_MS / 4)
    rerender({ key: 'c', reduce: false })
    expect(frames[frames.length - 1]).toBe(0)
    advance(TWEEN_MS)
    expect(frames[frames.length - 1]).toBe(1)
  })

  it('schedules no frame at all under reduced motion, and goes straight to 1', () => {
    const { frames, rerender } = drive(true)
    rerender({ key: 'b', reduce: true })
    expect(frames).toEqual([1, 1])
    expect(callbacks).toHaveLength(0)
  })

  it('calls the latest callback, not the one it was mounted with', () => {
    const seen: string[] = []
    const { rerender } = renderHook(
      ({ key, label }) =>
        useTween(key, false, () => {
          seen.push(label)
        }),
      { initialProps: { key: 'a', label: 'first' } },
    )
    rerender({ key: 'b', label: 'second' })
    advance(TWEEN_MS)
    expect(seen.filter((l) => l === 'first')).toHaveLength(1)
    expect(seen.filter((l) => l === 'second').length).toBeGreaterThan(0)
  })
})
