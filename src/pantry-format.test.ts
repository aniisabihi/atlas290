import { describe, expect, it } from 'vitest'
import rawManifestText from '../public/pantry/manifest.json?raw'
import { publishedPantry } from './test/pantry'

/**
 * Every published data file, as text. Plan 13 split `data/indicators.json` into an index plus one
 * file per indicator, so the minification guard now covers all twelve rather than one — a glob
 * rather than a list, so an indicator added later is covered without anyone remembering to add it.
 */
const rawDataTexts = import.meta.glob('../public/pantry/data/**/*.json', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

/**
 * Follow-up to Task 13 (docs/plans/2026-09-14-02-the-ten-indicators.md). Task 13's own publish
 * left `data/indicators.json` at 4,962,191 bytes, five times what the plan said to flag —
 * almost none of it data. Two causes, both fixed by this follow-up: the file was pretty-printed
 * (2-space indent alone cost more than half the bytes), and derived values carried full float
 * precision (`share-65-plus` publishing `4.7196549599507085`, sixteen significant figures for a
 * percentage derived from integer counts SCB itself perturbs).
 *
 * Both regressions are cheap to silently reintroduce (a `JSON.stringify(x, null, 2)` creeping
 * back in; a rounding step skipped, or applied against the wrong unit) and expensive to notice
 * by eye in a megabyte-plus file, so both are asserted here directly against the real,
 * committed published artifact — the same "self-proving repository" convention
 * indicators.headline.test.ts already established for the values themselves. A test that
 * cannot fail is worse than none: both guards below were confirmed red by deliberately
 * reverting the fix they guard and re-publishing, before being confirmed green again (see this
 * task's own report for the captured failing output).
 *
 * `?raw` (not the plain JSON import indicators.headline.test.ts uses) is what actually lets
 * this see whitespace at all — a parsed object cannot distinguish `{"a":1}` from
 * `{\n  "a": 1\n}`, only the raw text can. `?raw` is a Vite import-query convention (declared by
 * `vite/client`'s own ambient types, already in this project's tsconfig.app.json), so this
 * needs no Node types, matching every other src/ pantry test's own convention.
 */
describe('published pantry: file format (regression guards, this task)', () => {
  it('every data file is minified — no embedded newline beyond the one trailing byte', () => {
    const files = Object.entries(rawDataTexts)
    expect(files.length).toBeGreaterThanOrEqual(12)
    for (const [path, text] of files) {
      expect(path.endsWith('.json') && text.slice(0, -1).includes('\n')).toBe(false)
      expect(text.endsWith('\n')).toBe(true)
    }
  })

  it('manifest.json is minified — no embedded newline beyond the one trailing byte', () => {
    expect(rawManifestText.slice(0, -1)).not.toContain('\n')
    expect(rawManifestText.endsWith('\n')).toBe(true)
  })

  /**
   * Deliberately restated here rather than imported from `kitchen/src/round.ts`'s own
   * `UNIT_DECIMALS`: src/ cannot import kitchen/ code (a separate tsconfig project —
   * tsconfig.app.json includes only `src` and `shared`), and even if it could, a test that
   * checks published data against the exact map its own producer used could never catch that
   * map itself being wrong. This is copied from this task's own brief, independently of the
   * implementation it is checking.
   */
  const EXPECTED_DECIMALS: Record<string, number> = {
    count: 0,
    sek: 0,
    percent: 2,
    'per-thousand': 2,
    'per-km2': 1,
    years: 1,
    // Plan 16. Both carry 2 decimals because 0 would destroy the measure: a fertility rate of
    // 1.45 children per woman publishes as 1, and 4.17 tonnes of CO2e per resident as 4.
    'children-per-woman': 2,
    'tonnes-per-resident': 2,
    'persons-per-household': 2,
    metres: 0,
    // Plan 19. Farmland is a whole number of hectares: a decimal on 32,000 hectares of field,
    // measured every five years by a survey whose method changed during the period, would be
    // precision the source does not have.
    hectares: 0,
    // The editorial pass. A difference between two shares, at the precision of the shares.
    'percentage-points': 2,
  }

  /** Counts the decimal digits a number's own JS string representation actually carries —
   * never re-deriving it via rounding (which would make this test unable to distinguish an
   * already-rounded value from one that merely happens to round losslessly). Throws rather
   * than silently mis-measuring if a value ever stringifies in exponential notation — no real
   * published value in this project is small or large enough to reach that, so hitting it
   * means something else has already gone wrong. */
  function decimalsOf(n: number): number {
    const s = Math.abs(n).toString()
    if (s.includes('e') || s.includes('E')) {
      throw new Error(
        `decimalsOf: ${n} stringifies in exponential notation (${s}) — cannot count its ` +
          'decimal digits this way; investigate rather than adjust this helper blindly',
      )
    }
    const dot = s.indexOf('.')
    return dot === -1 ? 0 : s.length - dot - 1
  }

  const data = publishedPantry

  it("every published value and colour-scale break carries no more precision than its indicator's declared unit honestly has", () => {
    for (const indicator of data.indicators) {
      const maxDecimals = EXPECTED_DECIMALS[indicator.unit]
      if (maxDecimals === undefined) {
        throw new Error(
          `no EXPECTED_DECIMALS entry for unit '${indicator.unit}' (indicator ` +
            `'${indicator.id}') — every unit this pantry publishes must be checked, never ` +
            'silently skipped',
        )
      }
      const series = data.series.find((s) => s.indicator === indicator.id)
      if (series) {
        for (const [i, row] of series.values.entries()) {
          for (const [j, v] of row.entries()) {
            if (v === null) continue
            expect(
              decimalsOf(v),
              `${indicator.id} row ${i} col ${j} (year ${series.years[j]}) = ${v} has more ` +
                `than ${maxDecimals} decimals for unit '${indicator.unit}'`,
            ).toBeLessThanOrEqual(maxDecimals)
          }
        }
      }
      for (const b of indicator.scale.breaks) {
        expect(
          decimalsOf(b),
          `${indicator.id}'s colour-scale break ${b} has more than ${maxDecimals} decimals ` +
            `for unit '${indicator.unit}'`,
        ).toBeLessThanOrEqual(maxDecimals)
      }
    }
  })
})
