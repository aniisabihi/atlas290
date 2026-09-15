import { describe, expect, it } from 'vitest'
import { distance, nearest, sharedDimensions, windowMean } from './distance'

describe('windowMean', () => {
  it('averages each municipality across the years of the window', () => {
    // Two municipalities, three years. First: 1, 2, 3 -> 2. Second: 10, 20, 30 -> 20.
    expect(
      windowMean([
        [1, 10],
        [2, 20],
        [3, 30],
      ]),
    ).toEqual([2, 20])
  })

  it('skips years the indicator does not cover rather than counting them as absences', () => {
    // The real case: tax-rate starts in 2000, so a window beginning in 1999 has one
    // uncovered year. Averaging over 3 instead of 2 would pull every score toward zero.
    expect(windowMean([null, [4, 8], [6, 12], null])).toEqual([5, 10])
  })

  it('averages over the years a municipality has, not the years the window has', () => {
    // First municipality has 2 of 3 years; its mean must be over those 2.
    expect(
      windowMean([
        [2, 1],
        [null, 1],
        [4, 1],
      ]),
    ).toEqual([3, 1])
  })

  it('gives null for a municipality present in no covered year', () => {
    expect(
      windowMean([
        [null, 5],
        [null, 7],
      ]),
    ).toEqual([null, 6])
  })

  it('gives an empty result when no year in the window is covered at all', () => {
    expect(windowMean([null, null])).toEqual([])
  })
})

describe('distance', () => {
  it('is the root mean squared difference, rescaled to the dimension count', () => {
    // Differences 3 and 4 over 2 dimensions: sqrt((9+16)/2 * 2) = 5, the plain Euclidean
    // distance when nothing is missing.
    expect(distance([0, 0], [3, 4])).toBe(5)
  })

  it('is zero between a municipality and itself', () => {
    expect(distance([1, -2, 0.5], [1, -2, 0.5])).toBe(0)
  })

  it('rescales so a pair missing a dimension is comparable with a complete pair', () => {
    // Both pairs differ by 3 on every dimension they share. Without the rescaling the
    // second would come out at sqrt(18) = 4.24 against the first's sqrt(27) = 5.20, and
    // every pair involving a municipality with no house price would look closer to
    // everyone than it is.
    expect(distance([0, 0, 0], [3, 3, 3])).toBeCloseTo(distance([0, 0, null], [3, 3, 3])!, 10)
  })

  it('returns null, not zero, when the two share no dimension', () => {
    // A 0 here would sort two municipalities with nothing in common to the top of each
    // other's list, which is the worst possible failure for this feature.
    expect(distance([1, null], [null, 2])).toBeNull()
    expect(distance([1, null], [null, 2])).not.toBe(0)
  })

  it('throws when the two features have different lengths', () => {
    expect(() => distance([1, 2], [1, 2, 3])).toThrow(/2 dimensions against 3/)
  })
})

describe('sharedDimensions', () => {
  it('counts only the dimensions both sides have', () => {
    expect(sharedDimensions([1, 2, null, null], [1, null, 3, null])).toBe(1)
    expect(sharedDimensions([1, 2], [3, 4])).toBe(2)
  })
})

describe('nearest', () => {
  const codes = ['0001', '0002', '0003', '0004']
  const tie = (i: number) => codes[i]!

  it('returns the k closest, nearest first', () => {
    const features = [[0], [1], [5], [2]]
    expect(nearest(features, 0, 2, tie).map((n) => n.index)).toEqual([1, 3])
  })

  it('never includes the municipality itself', () => {
    const features = [[0], [0], [1]]
    expect(nearest(features, 0, 3, tie).map((n) => n.index)).not.toContain(0)
  })

  it('breaks exact ties by code, not by array position', () => {
    // Deliberately ordered so position and code disagree: index 3 is '0004' and index 1 is
    // '0002', both exactly 1 away. Position order would give 1 then 3 either way, so the
    // codes are reversed to make the two orderings distinguishable.
    const reversed = ['0004', '0003', '0002', '0001']
    const features = [[0], [1], [9], [1]]
    expect(nearest(features, 0, 2, (i) => reversed[i]!).map((n) => n.index)).toEqual([3, 1])
  })

  it('leaves out candidates that share no dimension rather than ranking them first', () => {
    const features = [
      [1, null],
      [null, 5],
      [2, 3],
    ]
    expect(nearest(features, 0, 2, tie).map((n) => n.index)).toEqual([2])
  })

  it('reports how many dimensions each neighbour was compared on', () => {
    const features = [
      [0, 0],
      [1, null],
      [1, 1],
    ]
    const result = nearest(features, 0, 2, tie)
    expect(result.find((n) => n.index === 1)?.shared).toBe(1)
    expect(result.find((n) => n.index === 2)?.shared).toBe(2)
  })

  it('throws rather than silently returning nothing for an index that does not exist', () => {
    expect(() => nearest([[1]], 7, 1, tie)).toThrow(/no feature row at index 7/)
  })
})
