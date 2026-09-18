import { describe, expect, it } from 'vitest'
import { publishedPantry } from '../test/pantry'
import rawPrices from '../../kitchen/raw/TAB1169/sv/26dfe1200425fa20.json'
import rawIncome from '../../kitchen/raw/TAB3554/sv/474d0f391fc1c46f.json'
import { type Indicator } from '../../shared/pantry'
import { nominalOf } from './nominal'

const data = publishedPantry
const byId = (id: string): Indicator => {
  const found = data.indicators.find((i) => i.id === id)
  if (!found) throw new Error(`no indicator ${id}`)
  return found
}

/**
 * JSON-stat2: one flat value array, with each dimension's positions read from its own
 * `category.index` rather than from the order the keys happen to appear in. Reading them from
 * insertion order is the mistake that produced six false discrepancies during Plan 2.
 */
type JsonStat = {
  id: string[]
  size: number[]
  value: Array<number | null>
  dimension: Record<
    string,
    { category: { index: Record<string, number>; label?: Record<string, string> } }
  >
}

function reader(raw: JsonStat) {
  const strides = raw.size.map((_, i) => raw.size.slice(i + 1).reduce((a, b) => a * b, 1))
  return (selection: Record<string, string>) => {
    let offset = 0
    for (const [i, dim] of raw.id.entries()) {
      const code = selection[dim]
      if (code === undefined) throw new Error(`no selection for dimension ${dim}`)
      const position = raw.dimension[dim]!.category.index[code]
      if (position === undefined) return undefined
      offset += position * strides[i]!
    }
    return raw.value[offset]
  }
}

const firstKey = (raw: JsonStat, dim: string) => Object.keys(raw.dimension[dim]!.category.index)[0]!

/**
 * The whole point of this file. The site presents the recovered figure as what SCB actually
 * published at the time, so the recovery has to be exact for every cell, not most of them —
 * a sampled test would let a handful of wrong prices through wearing a factual claim.
 */
function proveEveryCell(
  indicatorId: string,
  raw: JsonStat,
  contentCode: string,
  dims: (code: string, year: number) => Record<string, string>,
) {
  const indicator = byId(indicatorId)
  const series = data.series.find((s) => s.indicator === indicatorId)!
  const at = reader(raw)
  let checked = 0
  const wrong: string[] = []

  for (const [yearIndex, year] of series.years.entries()) {
    for (const [row, municipality] of data.municipalities.entries()) {
      const adjusted = series.values[row]![yearIndex] ?? null
      if (adjusted === null) continue
      const published = at({ ...dims(municipality.code, year), ContentsCode: contentCode })
      if (published === undefined || published === null) continue
      checked += 1
      const want = Math.round(published * 1000)
      const got = nominalOf(data, indicator, adjusted, year)
      if (got === null || Math.abs(got - want) > 0.5) {
        if (wrong.length < 5)
          wrong.push(`${municipality.code} ${year}: got ${got}, SCB published ${want}`)
      }
    }
  }
  return { checked, wrong }
}

describe('nominalOf, against every money cell in the pantry', () => {
  it('recovers all 12,723 published house prices exactly', () => {
    const { checked, wrong } = proveEveryCell(
      'house-prices',
      rawPrices.response as unknown as JsonStat,
      'BO0501C2',
      (code, year) => ({ Region: code, Fastighetstyp: '220', Tid: String(year) }),
    )
    expect(wrong).toEqual([])
    expect(checked).toBe(12_723)
  })

  it('recovers all 7,537 published median incomes exactly', () => {
    const raw = rawIncome.response as unknown as JsonStat
    const { checked, wrong } = proveEveryCell(
      'median-income',
      raw,
      firstKey(raw, 'ContentsCode'),
      (code, year) => ({
        Region: code,
        Kon: firstKey(raw, 'Kon'),
        Alder: firstKey(raw, 'Alder'),
        Inkomstklass: firstKey(raw, 'Inkomstklass'),
        Tid: String(year),
      }),
    )
    expect(wrong).toEqual([])
    expect(checked).toBe(7_537)
  })
})

describe('nominalOf', () => {
  it('leaves the base year alone, since adjusting to it changes nothing', () => {
    const houses = byId('house-prices')
    const series = data.series.find((s) => s.indicator === 'house-prices')!
    const row = data.municipalities.findIndex((m) => m.code === '0180')
    const stored = series.values[row]![series.years.indexOf(2025)]!
    expect(nominalOf(data, houses, stored, 2025)).toBe(stored)
  })

  it('gives nothing for an indicator that was never adjusted', () => {
    expect(nominalOf(data, byId('population'), 995_574, 2024)).toBeNull()
  })

  it('gives nothing where there is no value', () => {
    expect(nominalOf(data, byId('house-prices'), null, 1990)).toBeNull()
  })

  it('gives nothing for a year the price index does not cover', () => {
    // The index starts in 1980; house prices start in 1981, so this cannot happen with real
    // data — but the function must not invent a figure if it ever does.
    expect(nominalOf(data, byId('house-prices'), 1_000_000, 1975)).toBeNull()
  })

  it('needs the step the source publishes at, and says so when it is missing', () => {
    const noStep = { ...byId('house-prices'), publishedStep: undefined }
    expect(() => nominalOf(data, noStep, 1_000_000, 1990)).toThrow(/publishedStep/)
  })
})
