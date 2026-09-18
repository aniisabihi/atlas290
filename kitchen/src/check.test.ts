import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  PantryIndex,
  statusCode,
  type Indicator,
  type IndicatorSeries,
  type Municipality,
} from '../../shared/pantry'
import { DEFAULT_PANTRY_DIR } from './publish'
import { buildAll } from './indicators/registry'
import {
  check,
  EXPECTED_MUNICIPALITY_COUNT,
  PLAUSIBLE_RANGES,
  POPULATION_CHANGE_JUMP_THRESHOLD,
  type CheckInput,
} from './check'

const N = EXPECTED_MUNICIPALITY_COUNT

function makeMunicipalities(n = N): Municipality[] {
  return Array.from({ length: n }, (_, i) => ({
    code: String(i + 1).padStart(4, '0'),
    name: { sv: `Kommun ${i + 1}`, en: `Municipality ${i + 1}` },
    county: '01',
  }))
}

/** Minimal but schema-shaped Indicator, mirroring registry.test.ts's own fakeIndicator. */
function makeIndicator(
  id: string,
  coverage: { from: number; to: number },
  unit: Indicator['unit'] = 'count',
): Indicator {
  return {
    id,
    name: { sv: id, en: id },
    description: { sv: '', en: '' },
    unit,
    priceBasis: 'none',
    scale: { kind: 'sequential', breaks: [] },
    coverage,
    caveat: { sv: '', en: '' },
    sensitivity: 'none',
    sources: [],
    derivation: '',
  }
}

/** One value, 'present' everywhere, for every municipality and year — so a test only has to
 * mutate the one cell it actually cares about. */
function makeUniformSeries(
  id: string,
  years: number[],
  value: number,
  municipalities: Municipality[],
): IndicatorSeries {
  return {
    indicator: id,
    years,
    values: municipalities.map(() => years.map(() => value)),
    status: municipalities.map(() => years.map(() => statusCode('present'))),
  }
}

/** A pantry that passes every rule: 290 municipalities, population (count) and tax-rate
 * (percent), both covering 2000-2001, every cell 'present' and inside its declared range. */
function validInput(): CheckInput {
  const municipalities = makeMunicipalities()
  const population = makeIndicator('population', { from: 2000, to: 2001 }, 'count')
  const taxRate = makeIndicator('tax-rate', { from: 2000, to: 2001 }, 'percent')
  return {
    municipalities,
    indicators: [population, taxRate],
    series: [
      makeUniformSeries('population', [2000, 2001], 10_000, municipalities),
      makeUniformSeries('tax-rate', [2000, 2001], 30, municipalities),
    ],
  }
}

describe('check: a valid pantry', () => {
  it('does not throw', () => {
    expect(() => check(validInput())).not.toThrow()
  })
})

describe('rule 1: exactly 290 municipalities', () => {
  it('throws naming the expected and actual counts when a municipality is missing', () => {
    const input = validInput()
    input.municipalities = input.municipalities.slice(0, -1) // 289, series rows untouched
    expect(() => check(input)).toThrow(/expected exactly 290 municipalities.*got 289/)
  })
})

describe('rule 2: one row per municipality, one column per year', () => {
  it('throws naming the indicator when a series is missing a whole row', () => {
    const input = validInput()
    const s = input.series.find((x) => x.indicator === 'population')!
    s.values = s.values.slice(0, -1)
    s.status = s.status.slice(0, -1)
    expect(() => check(input)).toThrow(/population: has 289 rows but there are 290 municipalities/)
  })

  it('throws naming the municipality when one row has the wrong number of value columns', () => {
    const input = validInput()
    const s = input.series.find((x) => x.indicator === 'population')!
    s.values[3] = [10_000] // municipality '0004': one column instead of two
    expect(() => check(input)).toThrow(/population: municipality 0004 has 1 value columns/)
  })
})

describe('rule 3: no year outside declared coverage carries a present value', () => {
  it('throws naming the indicator, municipality, year and value', () => {
    const input = validInput()
    const population = input.indicators.find((i) => i.id === 'population')!
    population.coverage = { from: 2000, to: 2000 } // 2001 is now outside coverage
    expect(() => check(input)).toThrow(
      /population: 0001 in 2001 is marked 'present'.*outside this indicator's declared coverage.*value 10000/,
    )
  })
})

describe('rule 4: no implausible population-change jump unless flagged structural-break', () => {
  function withPopulationChangeCell(
    value: number,
    status: 'present' | 'structural-break',
  ): CheckInput {
    const input = validInput()
    const municipalities = input.municipalities
    const popChange = makeIndicator('population-change', { from: 2000, to: 2001 }, 'percent')
    const series = makeUniformSeries('population-change', [2000, 2001], 1, municipalities)
    series.values[0]![1] = value
    series.status[0]![1] = statusCode(status)
    input.indicators.push(popChange)
    input.series.push(series)
    return input
  }

  it('throws naming the municipality, year and value when a jump exceeds the threshold and is not flagged', () => {
    const input = withPopulationChangeCell(POPULATION_CHANGE_JUMP_THRESHOLD + 1, 'present')
    expect(() => check(input)).toThrow(
      /population-change: 0001 in 2001 changed by 51%, beyond the 50% plausibility threshold, and is not flagged 'structural-break'/,
    )
  })

  it('does NOT throw for the identical jump when the cell is flagged structural-break', () => {
    const input = withPopulationChangeCell(POPULATION_CHANGE_JUMP_THRESHOLD + 1, 'structural-break')
    expect(() => check(input)).not.toThrow()
  })
})

describe('rule 5: every value lies inside its declared plausible range', () => {
  it('throws naming the indicator, municipality, year and value for a tax rate above 100', () => {
    const input = validInput()
    const s = input.series.find((x) => x.indicator === 'tax-rate')!
    s.values[2]![0] = 150 // municipality '0003', year 2000
    expect(() => check(input)).toThrow(
      /tax-rate: 0003 in 2000 has value 150, outside the declared plausible range \[0, 100\]/,
    )
  })

  it('throws for a negative population', () => {
    const input = validInput()
    const s = input.series.find((x) => x.indicator === 'population')!
    s.values[5]![1] = -1 // municipality '0006', year 2001
    expect(() => check(input)).toThrow(/population: 0006 in 2001 has value -1/)
  })

  it('throws refusing to check an indicator with no declared range at all', () => {
    const input = validInput()
    const mystery = makeIndicator('mystery-indicator', { from: 2000, to: 2001 }, 'count')
    input.indicators.push(mystery)
    input.series.push(makeUniformSeries('mystery-indicator', [2000, 2001], 5, input.municipalities))
    expect(() => check(input)).toThrow(/mystery-indicator: no plausible range declared/)
  })
})

describe('rule 6: no indicator has zero non-null values', () => {
  it('throws naming the indicator', () => {
    const input = validInput()
    const s = input.series.find((x) => x.indicator === 'tax-rate')!
    s.values = s.values.map((row) => row.map(() => null))
    s.status = s.status.map((row) => row.map(() => statusCode('not-yet-published')))
    expect(() => check(input)).toThrow(/tax-rate: every value in this series is null/)
  })
})

describe('PLAUSIBLE_RANGES', () => {
  it('declares a range for exactly the indicators the pantry publishes, no more and no fewer', () => {
    // Read from the committed index rather than restated. This listed the ten by hand until plan
    // 16, which is a list that can only ever say how many indicators there were on the day it was
    // typed — and check.ts's own rule is precisely "every published indicator must declare one",
    // so the test should assert that rule rather than a snapshot of its result.
    //
    // Asserted in both directions: a published indicator with no range would make check.ts throw
    // at publish time, and a range for an indicator nobody publishes is a stale entry that would
    // silently outlive it.
    const published = PantryIndex.parse(
      JSON.parse(readFileSync(join(DEFAULT_PANTRY_DIR, 'data/index.json'), 'utf8')) as unknown,
    ).indicators.map((i) => i.id)
    const expected = [...published].sort()
    expect(Object.keys(PLAUSIBLE_RANGES).sort()).toEqual(expected)
  })
})

describe('the real dataset, built by buildAll() from the committed kitchen/raw cache', () => {
  it('passes every rule the check stage enforces', async () => {
    // Offline, exactly like publish.ts's own 'offline' fetch fake: every table this needs is
    // already frozen in kitchen/raw/, so this must never actually reach the network.
    const offline: typeof fetch = async (input) => {
      throw new Error(
        `check.test.ts: the real-data run must stay offline; tried to fetch ${String(input)}`,
      )
    }
    const result = await buildAll({ deps: { fetchImpl: offline } })
    expect(() => check(result)).not.toThrow()
  }, 30_000)
})
