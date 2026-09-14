import { useEffect } from 'react'
import type { Lookup } from '../data/select'
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
  const covered = (y: number) => y >= indicator.coverage.from && y <= indicator.coverage.to

  useEffect(() => {
    if (!playing) return
    if (year >= max) {
      onPlayingChange(false)
      return
    }
    const timer = setTimeout(() => onYear(year + 1, true), STEP_MS)
    return () => clearTimeout(timer)
  }, [playing, year, max, onYear, onPlayingChange])

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
          covered(year)
            ? String(year)
            : `${year} — ${strings.notPublishedFor(
                indicator.name[lang],
                indicator.coverage.from,
                indicator.coverage.to,
              )}`
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
