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

  describe('fertility-rate (TAB4805, women)', () => {
    // Read from TAB4805 on 2026-09-18 through a separate single-municipality request, before
    // this indicator was declared: Stockholm 2024 = 1.33, Borgholm = 1.42. The published cells
    // reproduce both, which is the check that the Kon=2 selection landed where it was meant to.
    it('reproduces the 2024 rates for Stockholm and Borgholm', () => {
      expect(cell('fertility-rate', 'Stockholm', 2024)).toEqual({ value: 1.33, status: 'present' })
      expect(cell('fertility-rate', 'Borgholm', 2024)).toEqual({ value: 1.42, status: 'present' })
    })

    // The measure this indicator is NOT. TAB4805 has no sex total, and a rate summed over men
    // and women would land near 2.7 rather than near 1.4 — far outside anything a fertility
    // rate can be, which is what makes this assertion worth making.
    it('is a womens rate, so no cell approaches the sum of both sexes', () => {
      const s = seriesOf('fertility-rate')
      const values = s.values.flat().filter((v): v is number => v !== null)
      expect(Math.max(...values)).toBeLessThan(4)
    })
  })

  describe('dependency-ratio (TAB4642)', () => {
    it('reproduces the 2024 ratios for Stockholm and Borgholm', () => {
      expect(cell('dependency-ratio', 'Stockholm', 2024)).toEqual({
        value: 59.5,
        status: 'present',
      })
      expect(cell('dependency-ratio', 'Borgholm', 2024)).toEqual({
        value: 123.8,
        status: 'present',
      })
    })

    // The one indicator on this site whose unit is `percent` and whose values legitimately pass
    // 100: it counts people per 100 of working age, not a share of anything. A plausible-range
    // ceiling of 100 would have refused the real data.
    it('passes 100 where the young and the old outnumber the working age', () => {
      const values = seriesOf('dependency-ratio')
        .values.flat()
        .filter((v): v is number => v !== null)
      expect(Math.max(...values)).toBeGreaterThan(100)
    })
  })

  describe('employment-rate and unemployment-rate (TAB3200, ages 20-64)', () => {
    it('reproduces both 2024 rates for Stockholm and Borgholm', () => {
      expect(cell('employment-rate', 'Stockholm', 2024)).toEqual({
        value: 80.3,
        status: 'present',
      })
      expect(cell('employment-rate', 'Borgholm', 2024)).toEqual({ value: 82.6, status: 'present' })
      expect(cell('unemployment-rate', 'Stockholm', 2024)).toEqual({
        value: 5.3,
        status: 'present',
      })
      expect(cell('unemployment-rate', 'Borgholm', 2024)).toEqual({
        value: 3.5,
        status: 'present',
      })
    })

    // Both are published for 20-64 so that they describe the same people. They still do not sum
    // to 100, because unemployment is a share of the labour force and employment a share of the
    // population — and asserting that they do NOT is what keeps the caveat honest.
    it('do not sum to 100, because their denominators differ', () => {
      const e = cell('employment-rate', 'Stockholm', 2024).value!
      const u = cell('unemployment-rate', 'Stockholm', 2024).value!
      expect(e + u).not.toBeCloseTo(100, 1)
    })

    it('covers every municipality in every year of its short register, 2020 to 2024', () => {
      for (const id of ['employment-rate', 'unemployment-rate']) {
        const s = seriesOf(id)
        expect(s.years).toEqual([2020, 2021, 2022, 2023, 2024])
        const present = s.values.flat().filter((v) => v !== null).length
        expect(present).toBe(290 * 5)
      }
    })
  })

  describe('the three money measures SCB publishes ready-made', () => {
    // Read from each table on 2026-09-18 through a separate single-municipality request, before
    // any of them was declared. Stockholm 2024: skattekraft 329,390 NOMINAL kronor, disposable
    // 533.8 tkr, rent 1,619 kr per square metre per year. Borgholm: 212,862, 426.6, 1,182.
    it('reproduces the disposable income and the rent exactly, since neither is adjusted here', () => {
      expect(cell('disposable-household-income', 'Stockholm', 2024)).toEqual({
        value: 533_800,
        status: 'present',
      })
      expect(cell('disposable-household-income', 'Borgholm', 2024)).toEqual({
        value: 426_600,
        status: 'present',
      })
      expect(cell('median-rent-per-sqm', 'Stockholm', 2024)).toEqual({
        value: 1619,
        status: 'present',
      })
      expect(cell('median-rent-per-sqm', 'Borgholm', 2024)).toEqual({
        value: 1182,
        status: 'present',
      })
    })

    // The tax base IS adjusted, so it must NOT reproduce the nominal figure — and the gap has to
    // be the right size. 2024 kronor expressed in 2025 kronor is a little more, not a lot: if
    // this ever equalled the nominal figure the adjustment silently stopped running, and if it
    // were far larger the wrong base year was used.
    it('publishes the tax base in the price index base year, a little above the nominal figure', () => {
      const stockholm = cell('taxable-income-per-resident', 'Stockholm', 2024)
      expect(stockholm.status).toBe('present')
      expect(stockholm.value).toBe(331_635)
      expect(stockholm.value! / 329_390).toBeGreaterThan(1)
      expect(stockholm.value! / 329_390).toBeLessThan(1.05)
      expect(cell('taxable-income-per-resident', 'Borgholm', 2024).value).toBe(214_313)
    })

    // TAB3600 publishes 2026 and the price index does not reach it. Dropping the year is the
    // decision; this is what makes it visible if anyone ever quietly adds it back unadjusted.
    it('stops the tax base at the price index, not at the table', () => {
      const years = seriesOf('taxable-income-per-resident').years
      expect(years[years.length - 1]).toBe(2025)
      expect(seriesOf('tax-rate').years).toContain(2026)
    })
  })

  describe('the four rates, each hand-computed from its own raw counts', () => {
    // Every figure below was reconstructed on 2026-09-18 from a separate read of the source
    // table's raw counts and this pantry's own published population, then compared with what
    // the pipeline published. Stockholm 2024: 11,430 births, 5,850 deaths, 4,959 dwellings
    // completed, 522,654 dwellings standing, over a population of 995,574. Borgholm: 51, 187,
    // 157, 6,317, over 10,666. Emissions are 2022: 3,736 and 145 kilotonnes over 984,748 and
    // 10,857 residents.
    it('reproduces natural change, including a negative rate where deaths outnumber births', () => {
      expect(cell('natural-change-rate', 'Stockholm', 2024)).toEqual({
        value: 5.6,
        status: 'present',
      })
      // Borgholm had 51 births against 187 deaths. A rate that could not go negative would have
      // to publish something here, and everything it could publish would be false.
      expect(cell('natural-change-rate', 'Borgholm', 2024)).toEqual({
        value: -12.75,
        status: 'present',
      })
    })

    it('reproduces both dwelling rates', () => {
      expect(cell('dwellings-completed-rate', 'Stockholm', 2024).value).toBe(4.98)
      expect(cell('dwellings-completed-rate', 'Borgholm', 2024).value).toBe(14.72)
      expect(cell('dwellings-per-1000', 'Stockholm', 2024).value).toBe(524.98)
      expect(cell('dwellings-per-1000', 'Borgholm', 2024).value).toBe(592.26)
    })

    it('reproduces emissions in tonnes per resident, not kilotonnes', () => {
      // 3,736 kilotonnes over 984,748 people is 3.79 tonnes each, not 0.0038. The unit
      // conversion is the whole reason this indicator has a unit of its own.
      expect(cell('greenhouse-gas-per-resident', 'Stockholm', 2022).value).toBe(3.79)
      expect(cell('greenhouse-gas-per-resident', 'Borgholm', 2022).value).toBe(13.36)
    })

    // Every other series in this pantry that reaches the present ends in 2025. This one ends in
    // 2022, and saying so is more honest than quietly letting the slider run past it.
    it('ends emissions in 2022, three years before the rest', () => {
      const years = seriesOf('greenhouse-gas-per-resident').years
      expect(years[years.length - 1]).toBe(2022)
    })
  })

  describe('the two computed from the pantry alone', () => {
    // Neither fetches anything, so the whole point is that a reader can check them against the
    // two numbers already on the page. These assertions do exactly that.
    it('derives the education gap as women minus men, from the two published splits', () => {
      for (const place of ['Stockholm', 'Borgholm', 'Lund']) {
        const women = cell('post-secondary-education-women', place, 2024).value!
        const men = cell('post-secondary-education-men', place, 2024).value!
        const gap = cell('post-secondary-education-gap', place, 2024).value!
        // Within half a rounding step, not exactly equal: the gap is computed from the two
        // UNROUNDED shares and rounded once at the end, which is the same rule every other
        // derived figure in this pantry follows. Lund publishes 5.94 where the rounded shares
        // differ by 5.93, and that is the rounding working rather than failing.
        expect(gap).toBeCloseTo(women - men, 1)
      }
    })

    // A property neither split asserts on its own: the combined share has to sit between them,
    // because it is the same measure over both sexes together.
    it('leaves the combined share between the two splits, for every municipality and year', () => {
      const women = seriesOf('post-secondary-education-women')
      const men = seriesOf('post-secondary-education-men')
      const both = seriesOf('post-secondary-education')
      let checked = 0
      for (let i = 0; i < both.values.length; i++) {
        for (let j = 0; j < both.years.length; j++) {
          const w = women.values[i]?.[j]
          const m = men.values[i]?.[j]
          const b = both.values[i]?.[j]
          if (w === null || m === null || b === null) continue
          if (w === undefined || m === undefined || b === undefined) continue
          expect(b).toBeGreaterThanOrEqual(Math.min(w, m) - 0.01)
          expect(b).toBeLessThanOrEqual(Math.max(w, m) + 0.01)
          checked++
        }
      }
      expect(checked).toBeGreaterThan(10_000)
    })

    it('derives house price in years of income from the two published money series', () => {
      const price = cell('house-prices', 'Stockholm', 2024).value!
      const income = cell('median-income', 'Stockholm', 2024).value!
      expect(cell('house-price-to-income', 'Stockholm', 2024).value).toBeCloseTo(price / income, 1)
      expect(cell('house-price-to-income', 'Borgholm', 2024).value).toBe(9)
    })

    // Both operands run further than the overlap — house prices from 1981, income to 2024 — and
    // a quotient over a year only one of them covers would have one operand.
    it('covers only the years both its operands publish', () => {
      const years = seriesOf('house-price-to-income').years
      expect(years[0]).toBe(1999)
      expect(years[years.length - 1]).toBe(2024)
      expect(seriesOf('house-prices').years[0]).toBe(1981)
    })
  })

  describe('the two housing shares (TAB824)', () => {
    // Each partitions the same stock a different way, so each share is a fraction of the whole
    // and neither can exceed 100.
    it('reproduces both shares for a city, an island and a university town', () => {
      expect(cell('share-houses', 'Stockholm', 2024).value).toBe(8.74)
      expect(cell('share-houses', 'Borgholm', 2024).value).toBe(71.39)
      expect(cell('share-rentals', 'Stockholm', 2024).value).toBe(42.82)
      expect(cell('share-rentals', 'Borgholm', 2024).value).toBe(23.22)
    })

    it.each(['share-houses', 'share-rentals'])('keeps %s inside 0 and 100', (id) => {
      const values = seriesOf(id)
        .values.flat()
        .filter((v): v is number => v !== null)
      expect(Math.min(...values)).toBeGreaterThanOrEqual(0)
      expect(Math.max(...values)).toBeLessThanOrEqual(100)
    })
  })

  describe('the three measures SCB had already computed (plan 17)', () => {
    // Each read on 2026-09-21 through a separate request before the indicator was declared.
    it('reproduces household size, which is small everywhere and smallest in the north', () => {
      expect(cell('persons-per-household', 'Stockholm', 2024).value).toBe(2.04)
      expect(cell('persons-per-household', 'Borgholm', 2024).value).toBe(1.93)
      expect(cell('persons-per-household', 'Arjeplog', 2024).value).toBe(1.86)
    })

    it('reproduces cars per 1,000, where a city is about half a rural municipality', () => {
      const stockholm = cell('cars-per-1000', 'Stockholm', 2024).value!
      expect(stockholm).toBe(354)
      expect(cell('cars-per-1000', 'Borgholm', 2024).value).toBe(620)
      expect(cell('cars-per-1000', 'Arjeplog', 2024).value).toBe(657)
      // The pattern is the measure: if a city ever stopped being the least car-owning of the
      // three, something has gone wrong with the owner-category selection rather than with
      // Sweden.
      expect(stockholm).toBeLessThan(cell('cars-per-1000', 'Borgholm', 2024).value!)
    })

    // The counter-intuitive one, and the reason the caveat exists: the mean is weighted over
    // RESIDENTS, so a vast northern municipality whose people live in one town is further from
    // protected nature than a city whose residents cluster beside an urban reserve.
    it('reproduces distance to protected nature, with Arjeplog further out than Stockholm', () => {
      expect(cell('distance-to-protected-nature', 'Stockholm', 2025).value).toBe(1100)
      expect(cell('distance-to-protected-nature', 'Borgholm', 2025).value).toBe(1500)
      expect(cell('distance-to-protected-nature', 'Arjeplog', 2025).value).toBe(3300)
    })

    it('publishes a distance for every municipality in every year, with no gaps', () => {
      const s = seriesOf('distance-to-protected-nature')
      expect(s.years).toHaveLength(13)
      expect(s.values.flat().filter((v) => v !== null)).toHaveLength(290 * 13)
    })
  })

  describe('commuting, stitched across three tables (plan 17)', () => {
    // Solna is the case both measures exist for: an office district north of Stockholm with
    // more people working in it than living in it. Read from TAB5839 on 2026-09-21 before the
    // indicators were declared — 94,108 in-commuters, 33,987 out, 12,379 who both live and
    // work there, so the out-commuter share is 33,987 / (33,987 + 12,379) = 73.30%.
    it('reproduces Solna, where more people commute in than live there', () => {
      expect(cell('in-commuters-per-1000', 'Solna', 2021).value!).toBeGreaterThan(1000)
      expect(cell('in-commuters-per-1000', 'Solna', 2021).value).toBe(1117.84)
      expect(cell('out-commuter-share', 'Solna', 2021).value).toBe(73.3)
    })

    it('reproduces Stockholm, whose share is computed from the same two content codes', () => {
      // 142,587 / (142,587 + 379,098) = 27.33%.
      expect(cell('out-commuter-share', 'Stockholm', 2021).value).toBe(27.33)
    })

    // The share is grouped by content LABEL, and the three tables use different codes for the
    // same measure. If that ever broke, the years from one of the tables would go null rather
    // than wrong — so the coverage of the whole stitch is the assertion that catches it.
    it('covers all three stitched tables, 1993 to 2021, with no gap at the joins', () => {
      const s = seriesOf('out-commuter-share')
      expect(s.years[0]).toBe(1993)
      expect(s.years[s.years.length - 1]).toBe(2021)
      for (const year of [2003, 2004, 2018, 2019]) {
        expect(cell('out-commuter-share', 'Stockholm', year).value, String(year)).not.toBeNull()
      }
    })
  })

  describe('life expectancy, with its five-year windows pinned (plan 17)', () => {
    // TAB4394 publishes 1998-2002 … 2021-2025 and the pantry publishes each under the window's
    // LAST year. Read from the table directly: 1998-2002 for Stockholm is 76.54 for men and
    // 81.82 for women; 2021-2025 is 82.56 and 86.22.
    it('publishes the 1998-2002 window under 2002, and 2021-2025 under 2025', () => {
      expect(cell('life-expectancy-men', 'Stockholm', 2002).value).toBe(76.5)
      expect(cell('life-expectancy-women', 'Stockholm', 2002).value).toBe(81.8)
      expect(cell('life-expectancy-men', 'Stockholm', 2025).value).toBe(82.6)
      expect(cell('life-expectancy-women', 'Stockholm', 2025).value).toBe(86.2)
    })

    it('lands the twenty-four overlapping windows on twenty-four consecutive years', () => {
      const years = seriesOf('life-expectancy-women').years
      expect(years).toHaveLength(24)
      expect(years[0]).toBe(2002)
      expect(years[years.length - 1]).toBe(2025)
      for (let i = 1; i < years.length; i++) expect(years[i]! - years[i - 1]!).toBe(1)
    })

    // 86.22 - 82.56 = 3.66, which rounds to 3.7 — where the two ROUNDED values differ by 3.6.
    // The gap is computed before rounding and rounded once, the same rule every derived figure
    // in this pantry follows, and this is the cell that shows the difference it makes.
    it('computes the gap before rounding, not from the rounded halves', () => {
      const women = cell('life-expectancy-women', 'Stockholm', 2025).value!
      const men = cell('life-expectancy-men', 'Stockholm', 2025).value!
      expect(cell('life-expectancy-gap', 'Stockholm', 2025).value).toBe(3.7)
      expect(Number((women - men).toFixed(1))).toBe(3.6)
    })

    // Written first as "women outlive men everywhere", which is false — and the three places it
    // is false are the caveat's own argument rather than a counter-example to it. Norberg has
    // about 5,600 residents and Dorotea about 2,500; over a five-year window that is few enough
    // deaths for the order to reverse by chance. Naming them keeps the claim honest AND keeps a
    // fourth from appearing unnoticed.
    it('has women outliving men almost everywhere, and names the three windows where they do not', () => {
      const gap = seriesOf('life-expectancy-gap')
      const negative: string[] = []
      for (let i = 0; i < gap.values.length; i++) {
        for (let j = 0; j < gap.years.length; j++) {
          const v = gap.values[i]?.[j]
          if (v !== null && v !== undefined && v <= 0) {
            negative.push(`${data.municipalities[i]?.name.sv} ${gap.years[j]}`)
          }
        }
      }
      expect(negative).toEqual(['Norberg 2008', 'Dorotea 2015', 'Dorotea 2018'])
      const all = gap.values.flat().filter((v): v is number => v !== null)
      expect(all).toHaveLength(6959)
      expect(Math.max(...all)).toBeLessThan(15)
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

    it.each([
      'population',
      'density',
      'share-65-plus',
      'net-migration-rate',
      'natural-change-rate',
    ])('does mark cells of %s perturbed, from the 2025 CKM tables', (id) => {
      expect(statusesIn(id)).toContain('perturbed')
    })
  })
})

/**
 * Plan 19's seven, and the three claims their caveats make that a reader could check.
 *
 * Each of these was written the wrong way round first and corrected by the published figures —
 * which is the reason they are tests rather than prose alone. ADR-0021 recorded the same shape
 * of correction for "women outlive men everywhere", which is false in three windows.
 */
describe('published pantry: the sparse seven', () => {
  const data = publishedPantry
  const seriesOf = (id: string): IndicatorSeries => {
    const s = data.series.find((x) => x.indicator === id)
    if (!s) throw new Error(`no series for ${id}`)
    return s
  }
  const metaOf = (id: string) => {
    const i = data.indicators.find((x) => x.id === id)
    if (!i) throw new Error(`no indicator ${id}`)
    return i
  }
  const cells = (id: string) =>
    seriesOf(id)
      .values.flat()
      .filter((v): v is number => v !== null)

  it('publishes an explicit year list for each of the seven, and for nothing that is dense', () => {
    const sparse = data.indicators.filter((i) => i.coverage.years).map((i) => i.id)
    expect(sparse.sort()).toEqual(
      [
        'councillors-women-share',
        'farmland-hectares',
        'green-space-within-200m',
        'share-land-built',
        'turnout-gap-general-municipal',
        'turnout-general-election',
        'turnout-municipal-election',
      ].sort(),
    )
  })

  it('every declared year list matches its own series, year for year', () => {
    for (const indicator of data.indicators) {
      if (!indicator.coverage.years) continue
      expect(indicator.coverage.years, indicator.id).toEqual(seriesOf(indicator.id).years)
    }
  })

  it('pins the fifteen election years, including the three-to-four-year change in 1994', () => {
    // Sweden moved from three-year to four-year terms in 1994, so this list cannot be generated
    // from a step and a start — which is exactly why it is written out.
    expect(metaOf('turnout-general-election').coverage.years).toEqual([
      1973, 1976, 1979, 1982, 1985, 1988, 1991, 1994, 1998, 2002, 2006, 2010, 2014, 2018, 2022,
    ])
  })

  it('makes the turnout gap reproducible from the two series it is published beside', () => {
    // The reason both splits ship rather than the gap alone (0016 D6): a reader can check it.
    const gap = seriesOf('turnout-gap-general-municipal')
    const general = seriesOf('turnout-general-election')
    const municipal = seriesOf('turnout-municipal-election')
    for (const [i] of data.municipalities.entries()) {
      for (const [j] of gap.years.entries()) {
        const a = general.values[i]?.[j]
        const b = municipal.values[i]?.[j]
        const d = gap.values[i]?.[j]
        if (a === null || b === null || a === undefined || b === undefined) {
          expect(d ?? null).toBeNull()
          continue
        }
        expect(Math.abs((d ?? NaN) - (a - b))).toBeLessThanOrEqual(0.005)
      }
    }
  })

  it('names the four points where municipal turnout BEAT the general election', () => {
    // The caveat says the gap is "almost always positive". Almost: four of 4,288, all within a
    // tenth of a point of zero. Named here so a fifth cannot appear unnoticed.
    const gap = seriesOf('turnout-gap-general-municipal')
    const negative: string[] = []
    data.municipalities.forEach((m, i) =>
      gap.years.forEach((y, j) => {
        const v = gap.values[i]?.[j]
        if (v !== null && v !== undefined && v < 0) negative.push(`${m.name.sv} ${y}`)
      }),
    )
    expect(negative.sort()).toEqual([
      'Bjurholm 2002',
      'Timrå 1973',
      'Vilhelmina 1973',
      'Öckerö 1973',
    ])
  })

  it('records that green space within 200 m barely separates anybody', () => {
    // The caveat's own numbers. 200 m was chosen as the most discriminating distance SCB
    // offers, and it still saturates — which is the honest version of that choice.
    const v = cells('green-space-within-200m')
    expect(v).toHaveLength(580)
    expect(v.filter((x) => x < 90)).toHaveLength(46)
    expect(Math.max(...v)).toBe(100)
  })

  it('keeps farmland an area rather than a share, zeros included', () => {
    // Stockholm publishes 0 hectares for 1990, 1995 and 2000 and 462 for 2005. That is SCB's
    // own figure, re-read off the frozen chunk, not a null summed to zero — the method changed
    // between surveys, which is what the caveat warns about.
    const s = seriesOf('farmland-hectares')
    const i = data.municipalities.findIndex((m) => m.code === '0180')
    expect(s.values[i]).toEqual([38, 0, 0, 0, 462, 353, 259, 124])
  })

  it('has every councillor share inside a plausible half of the range', () => {
    // 24 to 58 across five mandate periods: no municipality has ever had a council that was
    // more than 58 percent women, and none below 24.
    const v = cells('councillors-women-share')
    expect(Math.min(...v)).toBeGreaterThanOrEqual(20)
    expect(Math.max(...v)).toBeLessThanOrEqual(60)
    expect(v).toHaveLength(1443)
  })

  it('leaves seven municipalities without a 2023 council figure, and says how many', () => {
    const s = seriesOf('councillors-women-share')
    const j = s.years.indexOf(2023)
    const absent = s.values.filter((row) => row[j] === null)
    expect(absent).toHaveLength(7)
    expect(OBSERVATION_STATUS[s.status[s.values.findIndex((r) => r[j] === null)]![j]!]).toBe(
      'not-yet-published',
    )
  })
})
