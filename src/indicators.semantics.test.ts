import { describe, expect, it } from 'vitest'
import { publishedPantry } from './test/pantry'
import { OBSERVATION_STATUS, type IndicatorSeries } from '../shared/pantry'

/**
 * Published pantry: the edge cells and the status semantics.
 *
 * Sibling to `indicators.headline.test.ts`, which pins coverage, an exact non-null cell count and
 * one real value per indicator. This file takes what that one deliberately does not carry: the
 * extremes, the cells that exist to be awkward, and what each source table's own quirks mean for
 * the status byte.
 *
 * WHERE THESE FIGURES CAME FROM, and why it matters. Plan 15 deleted nine hand-written indicator
 * implementations and roughly 190 assertions against them. Most of those assertions were about
 * selection shape and are now covered generically by `kitchen/src/indicators/source.test.ts`; the
 * ones gathered here are not, because they were derived INDEPENDENTLY of the pipeline — hand-
 * summed from a frozen chunk, or spot-checked against the live SCB API on 2026-09-14 — and that
 * is the whole reason they were worth carrying rather than dropping.
 *
 * Every number below was re-read off the committed `public/pantry/` while moving it, never
 * carried across from the old test on trust, and every one agreed. If any of these ever fails,
 * the pantry no longer matches the ground truth this project is built on: investigate, never
 * "fix" it by editing the expected number here.
 *
 * `kitchen/src/indicators/define.test.ts` proves each definition still reproduces its published
 * series. It cannot prove a definition was ever RIGHT, because the pantry is generated from that
 * same definition. This file is the part that can.
 */
describe('published pantry: edge cells and status semantics', () => {
  const data = publishedPantry

  const codeOf = (name: string) =>
    data.municipalities.find((m) => m.name.sv === name)?.code ??
    (() => {
      throw new Error(`no municipality named '${name}'`)
    })()
  const rowOf = (name: string) => data.municipalities.findIndex((m) => m.code === codeOf(name))
  const seriesOf = (id: string): IndicatorSeries => {
    const s = data.series.find((x) => x.indicator === id)
    if (!s) throw new Error(`no series for indicator '${id}'`)
    return s
  }
  const cell = (id: string, name: string, year: number) => {
    const s = seriesOf(id)
    const i = rowOf(name)
    const j = s.years.indexOf(year)
    if (j === -1) throw new Error(`${id} does not publish ${year}`)
    return { value: s.values[i]?.[j] ?? null, status: OBSERVATION_STATUS[s.status[i]?.[j] ?? 0] }
  }
  /** Every status that appears anywhere in an indicator's series, sorted. */
  const statusesIn = (id: string) =>
    [...new Set(seriesOf(id).status.flatMap((row) => row.map((s) => OBSERVATION_STATUS[s])))].sort()

  describe('tax-rate (TAB2017)', () => {
    // Verified live against the real API on 2026-09-14, before the first version of this
    // assertion was written: Stockholm 2024 = 30.36, 2026 = 30.55; Arjeplog 2024 = 34.84.
    it('reproduces Stockholm — roughly 30 percent — in both 2024 and the 2026 year only this indicator reaches', () => {
      expect(cell('tax-rate', 'Stockholm', 2024)).toEqual({ value: 30.36, status: 'present' })
      expect(cell('tax-rate', 'Stockholm', 2026)).toEqual({ value: 30.55, status: 'present' })
    })

    it('reproduces a second real municipality, Arjeplog, not just Stockholm', () => {
      expect(cell('tax-rate', 'Arjeplog', 2024)).toEqual({ value: 34.84, status: 'present' })
    })
  })

  describe('density (TAB628)', () => {
    // Verified live 2026-09-14: Stockholm 2024 = 5289.4 per km², Arjeplog = 0.2 — well under
    // one, which is the point of keeping both.
    it('reproduces the two ends of the range, Stockholm and Arjeplog, for 2024', () => {
      expect(cell('density', 'Stockholm', 2024)).toEqual({ value: 5289.4, status: 'present' })
      expect(cell('density', 'Arjeplog', 2024)).toEqual({ value: 0.2, status: 'present' })
    })

    it('marks 2025 perturbed, because density comes from the same CKM cutover population does', () => {
      expect(cell('density', 'Stockholm', 2025).status).toBe('perturbed')
      expect(cell('density', 'Stockholm', 2024).status).toBe('present')
    })

    // Land area is not a series: TAB628 publishes it beside the density, and the kitchen fills
    // it onto the municipality itself. Verified live 2026-09-14.
    it('fills land area onto the municipality from the same table', () => {
      const area = (name: string) =>
        data.municipalities.find((m) => m.name.sv === name)?.landAreaKm2
      expect(area('Stockholm')).toBe(188.22)
      expect(area('Arjeplog')).toBe(12635.46)
    })
  })

  describe('mean-age (TAB637)', () => {
    // Spot-checked against all 290 municipalities on 2026-09-14: Borgholm is the oldest,
    // Knivsta the youngest.
    it('reproduces the 2025 extremes: Borgholm the oldest, Knivsta the youngest', () => {
      expect(cell('mean-age', 'Borgholm', 2025)).toEqual({ value: 53.3, status: 'present' })
      expect(cell('mean-age', 'Knivsta', 2025)).toEqual({ value: 37.8, status: 'present' })
    })

    // TAB637 sends a literal 0 for Knivsta's 1998-2001, not a null. Publishing that 0 would put
    // a municipality of average age zero on the map; the existed() gate is what stops it.
    it("discards SCB's literal 0 for Knivsta before 2002, and reads its real first value there", () => {
      expect(cell('mean-age', 'Knivsta', 1998)).toEqual({ value: null, status: 'did-not-exist' })
      expect(cell('mean-age', 'Knivsta', 2001)).toEqual({ value: null, status: 'did-not-exist' })
      expect(cell('mean-age', 'Knivsta', 2002)).toEqual({ value: 36.1, status: 'present' })
    })
  })

  describe('median-income (TAB3554, inflation-adjusted)', () => {
    // Verified live 2026-09-14: Danderyd reads 209.6 tkr NOMINAL for 1999, Högsby — the real
    // lowest of all 290, found by scanning every municipality rather than assumed — reads 140.6
    // tkr. Both published figures are far above 209,600 and 140,600 kronor, which is what proves
    // the inflation step actually ran rather than the thousands-to-kronor conversion alone.
    it('reproduces the adjusted 1999 figures for Danderyd and Högsby, both far above their nominal kronor', () => {
      const danderyd = cell('median-income', 'Danderyd', 1999)
      const hogsby = cell('median-income', 'Högsby', 1999)
      expect(danderyd).toEqual({ value: 339437, status: 'present' })
      expect(hogsby).toEqual({ value: 227695, status: 'present' })
      expect(danderyd.value!).toBeGreaterThan(209_600)
      expect(hogsby.value!).toBeGreaterThan(140_600)
      expect(danderyd.value!).toBeGreaterThan(hogsby.value!)
    })

    // Unlike TAB637 and TAB638, TAB3554 returns null rather than 0 for a municipality that did
    // not exist. The gate therefore governs the STATUS here, not the nulling.
    it('labels Knivsta did-not-exist before 2002 even though the table already sent null', () => {
      expect(cell('median-income', 'Knivsta', 1999).status).toBe('did-not-exist')
      expect(cell('median-income', 'Knivsta', 2001).status).toBe('did-not-exist')
      expect(cell('median-income', 'Knivsta', 2002).status).toBe('present')
    })
  })

  describe('house-prices (TAB1169, inflation-adjusted, minimum sale count)', () => {
    // Verified live 2026-09-14: Danderyd 1990 is 151 sales at a mean of 2,615 tkr; Åsele is 41
    // sales at 252 tkr.
    it('reproduces the adjusted 1990 figures for Danderyd and Åsele', () => {
      const danderyd = cell('house-prices', 'Danderyd', 1990)
      const asele = cell('house-prices', 'Åsele', 1990)
      expect(danderyd).toEqual({ value: 5259950, status: 'present' })
      expect(asele).toEqual({ value: 506886, status: 'present' })
      expect(danderyd.value!).toBeGreaterThan(2_615_000)
      expect(asele.value!).toBeGreaterThan(252_000)
    })

    // The cell this rule exists for. SCB published a mean price of 2,188 tkr for Solna in 1990
    // — resting on two sales. A mean price from two sales is noise wearing a number's clothes,
    // and the map would have drawn it as fact.
    it('nulls Solna 1990, which SCB published a price for on only two sales', () => {
      expect(cell('house-prices', 'Solna', 1990)).toEqual({
        value: null,
        status: 'too-few-cases',
      })
    })
  })

  describe('post-secondary-education (TAB3981)', () => {
    // Found by scanning every municipality's real 2024 figure on 2026-09-14, not assumed:
    // Danderyd is the highest of all 290 and Filipstad, rural, is the real lowest.
    it('reproduces the 2024 extremes: Danderyd and Lund high, Filipstad the real lowest of all 290', () => {
      const danderyd = cell('post-secondary-education', 'Danderyd', 2024)
      const lund = cell('post-secondary-education', 'Lund', 2024)
      const filipstad = cell('post-secondary-education', 'Filipstad', 2024)
      expect(danderyd).toEqual({ value: 65.28, status: 'present' })
      expect(lund).toEqual({ value: 64.9, status: 'present' })
      expect(filipstad).toEqual({ value: 19.29, status: 'present' })
      expect(danderyd.value!).toBeGreaterThan(filipstad.value!)
      expect(lund.value!).toBeGreaterThan(filipstad.value!)
    })

    // TAB3981 sends literal 0 before a municipality existed, like TAB638 and unlike TAB3554 —
    // the disagreement between tables is data, and each indicator has to know its own table's.
    it('reads Knivsta as did-not-exist in 2001 and present in 2002, through a literal 0', () => {
      expect(cell('post-secondary-education', 'Knivsta', 2001)).toEqual({
        value: null,
        status: 'did-not-exist',
      })
      expect(cell('post-secondary-education', 'Knivsta', 2002).status).toBe('present')
    })
  })

  describe('share-65-plus (TAB638, a share of population)', () => {
    // Hand-summed from the committed frozen chunk on 2026-09-14, against the real published
    // population: Stockholm is 162,879 of 995,574, Borgholm — the real oldest by this measure —
    // 4,222 of 10,666, and Knivsta 2,939 of 21,193.
    it('reproduces Stockholm 2024, hand-summed as 162,879 of 995,574', () => {
      expect(cell('share-65-plus', 'Stockholm', 2024)).toEqual({ value: 16.36, status: 'present' })
    })

    it('reproduces the real 2024 extreme: Borgholm, 4,222 of 10,666', () => {
      expect(cell('share-65-plus', 'Borgholm', 2024)).toEqual({ value: 39.58, status: 'present' })
    })

    // Knivsta's 65+ count is the full 2x4 sex-by-marital-status cross-tab summed, because
    // TAB638 offers no total for either dimension.
    it('sums the full cross-tab for a split municipality: Knivsta, 2,939 of 21,193', () => {
      expect(cell('share-65-plus', 'Knivsta', 2024)).toEqual({ value: 13.87, status: 'present' })
    })
  })

  describe('net-migration-rate (TAB1211/TAB1212/TAB6640 stitched)', () => {
    it('reproduces fast-growing Knivsta in 2024 and 2025', () => {
      expect(cell('net-migration-rate', 'Knivsta', 2024)).toEqual({
        value: 16.23,
        status: 'present',
      })
      expect(cell('net-migration-rate', 'Knivsta', 2025)).toEqual({
        value: 19.46,
        status: 'perturbed',
      })
    })

    // Pajala's population fell every year from 2015 to 2025. A net rate has to be able to be
    // negative, and nothing in this project says that is worse.
    it('reproduces shrinking Pajala in 2025, as a negative rate', () => {
      expect(cell('net-migration-rate', 'Pajala', 2025)).toEqual({
        value: -15.25,
        status: 'perturbed',
      })
    })

    // A flow is measured over a year, so a municipality created on 1 January 2003 has no 2002
    // flow — one year later than population's own boundary, where a snapshot on 31 December
    // 2002 already counts it.
    it("marks Knivsta's 2002 did-not-exist, one year later than population's own boundary", () => {
      expect(cell('net-migration-rate', 'Knivsta', 2002)).toEqual({
        value: null,
        status: 'did-not-exist',
      })
      expect(cell('net-migration-rate', 'Knivsta', 2003).status).toBe('present')
    })

    // Borås was renumbered by the 1998 county mergers. Its code simply is not in the table
    // before 1997 — which is missing data, not a municipality that did not exist.
    it('reads Borås as not-yet-published before 1997, present afterwards', () => {
      expect(cell('net-migration-rate', 'Borås', 1990)).toEqual({
        value: null,
        status: 'not-yet-published',
      })
      expect(cell('net-migration-rate', 'Borås', 2000).status).toBe('present')
    })
  })

  /**
   * Which tables carry SCB's Cell Key Method note is a per-table fact, and getting it wrong in
   * either direction is a published lie: a perturbed cell presented as exact, or an exact cell
   * disclaimed as perturbed. Asserted both ways round so that neither a status that should
   * appear nor one that should not can drift in unnoticed.
   */
  describe('perturbation is claimed exactly where the source table carries the note', () => {
    it.each(['mean-age', 'median-income', 'house-prices', 'post-secondary-education'])(
      'never marks a single cell of %s perturbed — its table carries no CKM note',
      (id) => {
        expect(statusesIn(id)).not.toContain('perturbed')
      },
    )

    it.each(['population', 'density', 'share-65-plus', 'net-migration-rate'])(
      'does mark cells of %s perturbed, from the 2025 CKM tables',
      (id) => {
        expect(statusesIn(id)).toContain('perturbed')
      },
    )
  })
})
