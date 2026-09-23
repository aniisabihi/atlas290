import { useEffect } from 'react'
import { coversYear } from '../../shared/pantry'
import type { Lookup } from '../data/select'
import { notPublishedSentence } from '../i18n/format'
import { t } from '../i18n/strings'
import { useReducedMotion } from '../state/useReducedMotion'
import type { Lang, PantryMeta } from '../state/url'

/**
 * Time, and a play button.
 *
 * A native range input, because the browser already gives it keyboard support, touch support and
 * a screen-reader announcement that nothing hand-built will match. `aria-valuetext` carries the
 * year and, when that year is outside the indicator's coverage, the reason it is empty.
 *
 * The axis is always the full span whatever indicator is chosen. Ragged coverage is a true and
 * interesting thing about this data, so the years an indicator does not publish are dimmed rather
 * than removed.
 */

const STEP_MS = 1000

export function YearSlider({
  lk,
  meta,
  indicatorId,
  year,
  lang,
  playing,
  onYear,
  onPlayingChange,
}: {
  lk: Lookup
  meta: PantryMeta
  indicatorId: string
  year: number
  lang: Lang
  playing: boolean
  /** `stepping` is true when playback moved the year, so the caller can replace history. */
  onYear: (year: number, stepping?: boolean) => void
  onPlayingChange: (playing: boolean) => void
}) {
  const indicator = lk.indicator(indicatorId)
  const strings = t(lang)
  const reducedMotion = useReducedMotion()
  const { min, max } = meta.years
  const covered = (y: number) => coversYear(indicator, y)

  /**
   * Where playback goes next, and where it stops.
   *
   * Plan 19: a sparse indicator counted by one would spend most of its run on an empty map —
   * turnout would show fourteen blank years for every election. So playback steps to the next
   * year the indicator HAS, and stops at its last one rather than running out the axis.
   *
   * A dense indicator gets exactly the old behaviour, because for it "the next year with data"
   * and "one more" are the same number, and it stops at `max` because its own last year IS the
   * axis end or beyond it.
   */
  const sparseYears = indicator.coverage.years
  const nextYear = sparseYears
    ? (sparseYears.find((y) => y > year) ?? null)
    : year < max
      ? year + 1
      : null

  useEffect(() => {
    if (!playing) return
    if (nextYear === null) {
      onPlayingChange(false)
      return
    }
    const timer = setTimeout(() => onYear(nextYear, true), STEP_MS)
    return () => clearTimeout(timer)
  }, [playing, nextYear, onYear, onPlayingChange])

  const years = Array.from({ length: max - min + 1 }, (_, i) => min + i)

  return (
    <div className="year-slider" data-animate={reducedMotion ? 'false' : 'true'}>
      <div className="year-controls">
        <button type="button" onClick={() => onPlayingChange(!playing)}>
          {playing ? strings.pause : strings.play}
        </button>
        <label htmlFor="year">{strings.yearLabel}</label>
        <output htmlFor="year">{year}</output>
      </div>
      <input
        id="year"
        type="range"
        min={min}
        max={max}
        step={1}
        value={year}
        aria-valuetext={
          covered(year) ? String(year) : `${year} – ${notPublishedSentence(indicator, lang)}`
        }
        onChange={(event) => {
          // Taking hold of the slider stops the playback, rather than fighting it.
          if (playing) onPlayingChange(false)
          onYear(Number(event.target.value))
        }}
      />
      {/* The value text already carries this, so the strip is decoration for the eye only. */}
      <div className="year-ticks" data-year-ticks="" aria-hidden="true">
        {years.map((y) => (
          <span key={y} data-year-tick="" data-covered={covered(y) ? 'true' : 'false'} />
        ))}
      </div>
    </div>
  )
}
