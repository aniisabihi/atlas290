import { describe, expect, it } from 'vitest'
import { DEFAULT_PANTRY_DIR, readPantryParts } from './publish'
import { type ObservationStatus } from '../../shared/pantry'
import {
  CKM_MAX_NOISE,
  noiseBoundFor,
  extremesOf,
  longestRun,
  pointsFor,
  reversal,
  shareOf,
  stepIsReal,
  type Point,
} from './stats'

/** The published pantry, reassembled from the files the kitchen writes (Plan 13). */
const publishedPantry = readPantryParts(DEFAULT_PANTRY_DIR)

const data = publishedPantry
const population = data.series.find((s) => s.indicator === 'population')!
const rowOf = (code: string) => data.municipalities.findIndex((m) => m.code === code)
const name = new Map(data.municipalities.map((m) => [m.code, m.name.sv]))

/** A hand-built series: values from `startYear`, every one published unless said otherwise. */
function points(values: number[], startYear = 2000, statuses: ObservationStatus[] = []): Point[] {
  return values.map((value, i) => ({
    year: startYear + i,
    value,
    status: statuses[i] ?? 'present',
  }))
}

describe('stepIsReal', () => {
  it('trusts a step between two unperturbed figures, however small', () => {
    const [a, b] = points([100, 101])
    expect(stepIsReal(a!, b!)).toBe(true)
  })

  it('refuses a small step into a perturbed figure', () => {
    // The real case: several municipalities move by 0, 1 or 2 people between 2024 and 2025,
    // and every 2025 figure is perturbed. Counting those as growth or decline would be
    // reporting the noise as a fact.
    const [a, b] = points([100, 101], 2024, ['present', 'perturbed'])
    expect(stepIsReal(a!, b!)).toBe(false)
  })

  it('trusts a step into a perturbed figure once it exceeds the noise bound', () => {
    const [a, b] = points([100, 104], 2024, ['present', 'perturbed'])
    expect(b!.value - a!.value).toBeGreaterThan(CKM_MAX_NOISE)
    expect(stepIsReal(a!, b!)).toBe(true)
  })

  it('refuses a step of exactly the bound, which the noise alone could have produced', () => {
    const [a, b] = points([100, 103], 2024, ['present', 'perturbed'])
    expect(b!.value - a!.value).toBe(CKM_MAX_NOISE)
    expect(stepIsReal(a!, b!)).toBe(false)
  })

  it('trusts every step when the bound is zero', () => {
    // Which is what a non-count unit gets: the perturbation propagates into a derived share,
    // but by about 0.03 percentage points, not by three.
    const [a, b] = points([100, 100.5], 2024, ['present', 'perturbed'])
    expect(stepIsReal(a!, b!, 0)).toBe(true)
  })

  it('doubles the bound when both ends are perturbed', () => {
    const both: ObservationStatus[] = ['perturbed', 'perturbed']
    expect(stepIsReal(...(points([100, 105], 2025, both) as [Point, Point]))).toBe(false)
    expect(stepIsReal(...(points([100, 107], 2025, both) as [Point, Point]))).toBe(true)
  })
})

describe('longestRun', () => {
  it('counts steps, not observations', () => {
    // Four figures rising is three steps, and "rose every year for three years" is the claim
    // those four figures support.
    expect(longestRun(points([1, 2, 3, 4]), 1)).toEqual({ years: 3, from: 2000, to: 2003 })
  })

  it('finds the longest stretch, not the first or the last', () => {
    expect(longestRun(points([1, 2, 1, 2, 3, 4, 1]), 1)).toEqual({ years: 3, from: 2002, to: 2005 })
  })

  it('reads direction, so a fall is not a rise', () => {
    expect(longestRun(points([4, 3, 2, 1]), -1)).toEqual({ years: 3, from: 2000, to: 2003 })
    expect(longestRun(points([4, 3, 2, 1]), 1)).toBeNull()
  })

  it('treats a flat year as a break, because it moved in neither direction', () => {
    expect(longestRun(points([1, 2, 2, 3, 4]), 1)).toEqual({ years: 2, from: 2002, to: 2004 })
  })

  it('will not bridge a gap in the years', () => {
    // Two figures either side of an unpublished decade are not a consecutive pair, and
    // calling them one would turn "every year" into a lie.
    const gapped: Point[] = [
      { year: 2000, value: 1, status: 'present' },
      { year: 2010, value: 2, status: 'present' },
      { year: 2011, value: 3, status: 'present' },
    ]
    expect(longestRun(gapped, 1)).toEqual({ years: 1, from: 2010, to: 2011 })
  })

  it('ends a run at an untrustworthy step rather than extending it', () => {
    const p = points([1, 2, 3, 4], 2022, ['present', 'present', 'present', 'perturbed'])
    // The last step is +1 into a perturbed year, so it cannot be told from noise: the run is
    // the two steps before it, not three.
    expect(longestRun(p, 1)).toEqual({ years: 2, from: 2022, to: 2024 })
  })

  it('returns null when nothing moves that way at all', () => {
    expect(longestRun(points([5, 5, 5]), 1)).toBeNull()
    expect(longestRun([], 1)).toBeNull()
  })
})

describe('longestRun against the committed pantry', () => {
  it('finds the 47-year declines in Kramfors and Strömsund', () => {
    for (const code of ['2282', '2313']) {
      expect(longestRun(pointsFor(population, rowOf(code)), -1), name.get(code)).toEqual({
        years: 47,
        from: 1968,
        to: 2015,
      })
    }
  })

  it('finds the twelve municipalities that have grown every year since 1968', () => {
    const grown = data.municipalities.filter((m) => {
      const run = longestRun(pointsFor(population, rowOf(m.code)), 1)
      return run?.from === 1968 && run.years >= 56
    })
    expect(grown.map((m) => m.name.sv).sort()).toEqual([
      'Alingsås',
      'Halmstad',
      'Härryda',
      'Kungälv',
      'Lund',
      'Sollentuna',
      'Strängnäs',
      'Umeå',
      'Vallentuna',
      'Varberg',
      'Växjö',
      'Ängelholm',
    ])
  })

  it('lets those runs reach 2025, because each 2025 step clears the noise bound', () => {
    // Lund grew by 743 people in 2025 and Ängelholm by 49, both far more than the CKM noise
    // could account for, so the runs legitimately reach the perturbed year and are 57 steps.
    // The guard is not a blanket exclusion of 2025; it is a test each step has to pass.
    for (const code of ['1281', '1292']) {
      const run = longestRun(pointsFor(population, rowOf(code)), 1)
      expect(run?.to, name.get(code)).toBe(2025)
      expect(run?.years, name.get(code)).toBe(57)
    }
  })
})

describe('reversal', () => {
  const thresholds = { minFallPercent: 5, minRecoveryPercent: 5, minYearsSince: 10 }

  it('finds the peak before the trough, and the recovery after it', () => {
    const p = points([100, 120, 80, 90, 150], 1970)
    // Years are 1970..1974, so minYearsSince has to be relaxed for the shape test.
    const r = reversal(p, { ...thresholds, minYearsSince: 1 })
    expect(r?.peak.year).toBe(1971)
    expect(r?.trough.year).toBe(1972)
    expect(r?.fall).toBeCloseTo(-33.33, 2)
    expect(r?.recovery).toBeCloseTo(87.5, 2)
  })

  it('takes the highest figure BEFORE the trough, not a later one', () => {
    // 200 in the final year is part of the recovery, not the thing that was lost.
    const r = reversal(points([100, 120, 80, 200], 1970), { ...thresholds, minYearsSince: 1 })
    expect(r?.peak.value).toBe(120)
  })

  it('declines when the trough is the first year, so nothing was lost', () => {
    expect(reversal(points([80, 100, 120], 1970), { ...thresholds, minYearsSince: 1 })).toBeNull()
  })

  it('declines when the trough is too recent to call a recovery', () => {
    expect(reversal(points([100, 120, 80, 150], 1970), thresholds)).toBeNull()
  })

  it('declines on a fall or a recovery too small to be more than noise', () => {
    const shallow = points(
      Array.from({ length: 20 }, (_, i) => (i === 3 ? 99 : 100)),
      1970,
    )
    expect(reversal(shallow, thresholds)).toBeNull()
  })
})

describe('reversal against the committed pantry', () => {
  it('finds that Stockholm was smaller in 1981 than in 1968', () => {
    const r = reversal(pointsFor(population, rowOf('0180')), {
      minFallPercent: 5,
      minRecoveryPercent: 5,
      minYearsSince: 10,
    })
    expect(r?.peak.year).toBe(1968)
    expect(r?.trough.year).toBe(1981)
    expect(Math.round(r!.fall)).toBe(-15)
    expect(Math.round(r!.recovery)).toBe(54)
  })

  it('finds 29 municipalities that fell and came back', () => {
    const found = data.municipalities.filter((m) =>
      reversal(pointsFor(population, rowOf(m.code)), {
        minFallPercent: 5,
        minRecoveryPercent: 5,
        minYearsSince: 10,
      }),
    )
    expect(found).toHaveLength(29)
  })
})

describe('shareOf', () => {
  it('counts only the items the question can be put to', () => {
    // Six municipalities did not exist in 1968, so they are not failures of the test — they
    // are outside the denominator. "124 of 290" would be false where "124 of 284" is true.
    expect(shareOf([1, 2, 3, null, null], (x) => (x === null ? null : x > 1))).toEqual({
      matching: 2,
      comparable: 3,
    })
  })

  it('counts nothing when nothing can be asked', () => {
    expect(shareOf([null, null], () => null)).toEqual({ matching: 0, comparable: 0 })
  })

  it('finds that 124 of 284 have fewer people than in 1968', () => {
    const from = population.years.indexOf(1968)
    const to = population.years.indexOf(2024)
    expect(
      shareOf(data.municipalities, (m) => {
        const row = rowOf(m.code)
        const then = population.values[row]?.[from] ?? null
        const now = population.values[row]?.[to] ?? null
        return then === null || now === null ? null : now < then
      }),
    ).toEqual({ matching: 124, comparable: 284 })
  })

  it('finds that 288 of 289 tax more in 2026 than in 2000, not 288 of 290', () => {
    // Knivsta was created in 2003 and has no tax rate for 2000, so it cannot be asked. This
    // is exactly the error shareOf exists to prevent, and it is not hypothetical: the first
    // draft of this plan recorded the fact as '288 of 290', which is false.
    const tax = data.series.find((s) => s.indicator === 'tax-rate')!
    const from = tax.years.indexOf(2000)
    const to = tax.years.indexOf(2026)
    expect(
      shareOf(data.municipalities, (m) => {
        const row = rowOf(m.code)
        const then = tax.values[row]?.[from] ?? null
        const now = tax.values[row]?.[to] ?? null
        return then === null || now === null ? null : now > then
      }),
    ).toEqual({ matching: 288, comparable: 289 })
  })
})

describe('extremesOf', () => {
  it('returns the highest and lowest and how many had a value', () => {
    const r = extremesOf(
      [
        { c: 'a', v: 3 },
        { c: 'b', v: null },
        { c: 'c', v: 9 },
        { c: 'd', v: 1 },
      ],
      (x) => x.v,
      (x) => x.c,
    )
    expect(r?.highest.c).toBe('c')
    expect(r?.lowest.c).toBe('d')
    expect(r?.comparable).toBe(3)
  })

  it('breaks ties by the tie-break rather than by array position', () => {
    const r = extremesOf(
      [
        { c: 'z', v: 5 },
        { c: 'a', v: 5 },
      ],
      (x) => x.v,
      (x) => x.c,
    )
    expect(r?.highest.c).toBe('a')
  })

  it('returns null when fewer than two have a value', () => {
    expect(
      extremesOf(
        [{ c: 'a', v: 1 }],
        (x) => x.v,
        (x) => x.c,
      ),
    ).toBeNull()
  })

  it('names the real denominator for a suppressed indicator', () => {
    // House prices are `too-few-cases` in five municipalities, so the comparable count is 285.
    const prices = data.series.find((s) => s.indicator === 'house-prices')!
    const col = prices.years.indexOf(2024)
    const r = extremesOf(
      data.municipalities,
      (m) => prices.values[rowOf(m.code)]?.[col] ?? null,
      (m) => m.code,
    )
    expect(r?.comparable).toBe(285)
    expect(r?.lowest.name.sv).toBe('Åsele')
  })
})

describe('pointsFor', () => {
  it('carries the status through, so a perturbed figure is known to be one', () => {
    const p = pointsFor(population, rowOf('0180'))
    expect(p.find((x) => x.year === 2025)?.status).toBe('perturbed')
    expect(p.find((x) => x.year === 2024)?.status).toBe('present')
  })

  it('leaves out absences rather than reading them as zero', () => {
    // Knivsta did not exist in 1968.
    const p = pointsFor(population, rowOf('0330'))
    expect(p.some((x) => x.year === 1968)).toBe(false)
    expect(p.every((x) => x.value > 0)).toBe(true)
  })

  it('returns nothing for a row that is not there', () => {
    expect(pointsFor(population, 9999)).toEqual([])
  })
})

describe('noiseBoundFor', () => {
  it('is three people for a count', () => {
    expect(noiseBoundFor('count')).toBe(CKM_MAX_NOISE)
  })

  it('is zero for every other unit', () => {
    // Three PERCENTAGE POINTS is not a noise bound, it is about a third of the national
    // spread of share-65-plus. Using the count bound on a derived share flipped a real fact
    // in this plan — "283 of 284" silently became "284 of 284" — before the unit was taken
    // into account, by discarding the one municipality that disagreed.
    for (const unit of ['percent', 'sek', 'years', 'per-thousand', 'per-km2']) {
      expect(noiseBoundFor(unit), unit).toBe(0)
    }
  })
})
