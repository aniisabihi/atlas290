import { describe, expect, it } from 'vitest'
import rawSimilar from '../../public/pantry/data/similar.json'
import { Similar } from '../../shared/pantry'
import { isMutual, similarTo } from './similar'

const similar = Similar.parse(rawSimilar)

describe('similarTo', () => {
  it('gives the five neighbours the kitchen published', () => {
    // Lund, whose five are the other university towns plus the two big cities.
    expect(similarTo(similar, '1281')).toEqual(['0380', '0580', '2480', '1280', '1480'])
  })

  it('gives an empty list, not a throw, for a municipality the file does not cover', () => {
    // A profile panel that crashed on a municipality added between two publishes would be a
    // worse failure than one that quietly omits the section.
    expect(similarTo(similar, '9999')).toEqual([])
  })

  it('covers all 290 municipalities with five each', () => {
    expect(Object.keys(similar.nearest)).toHaveLength(290)
    for (const [code, list] of Object.entries(similar.nearest)) expect(list, code).toHaveLength(5)
  })
})

describe('isMutual', () => {
  it('is true when each is in the other list', () => {
    // Malmö and Göteborg are each other's nearest.
    expect(isMutual(similar, '1280', '1480')).toBe(true)
  })

  it('is false when the relationship runs one way only', () => {
    // The measured fact this function exists for: 55% of the 1,450 relationships are mutual,
    // so 45% are not, and nothing may word the relationship as symmetric from one side.
    const oneWay: Array<[string, string]> = []
    for (const [code, list] of Object.entries(similar.nearest)) {
      for (const other of list)
        if (!similarTo(similar, other).includes(code)) oneWay.push([code, other])
    }
    expect(oneWay.length).toBeGreaterThan(0)
    const [a, b] = oneWay[0]!
    expect(isMutual(similar, a, b)).toBe(false)
  })

  it('finds the published file about half mutual, as measured', () => {
    let mutual = 0
    let total = 0
    for (const [code, list] of Object.entries(similar.nearest)) {
      for (const other of list) {
        total += 1
        if (isMutual(similar, code, other)) mutual += 1
      }
    }
    expect(total).toBe(1450)
    // Asserted as a band rather than a number: the point is that it is nowhere near 100%, so
    // a refresh that made it symmetric would mean the metric had changed, not improved.
    expect(mutual / total).toBeGreaterThan(0.4)
    expect(mutual / total).toBeLessThan(0.7)
  })
})
