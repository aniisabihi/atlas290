/**
 * The distance itself, over already-standardised features.
 *
 * This module knows nothing about indicators, years or the pantry — it takes a table of
 * numbers with holes in it and answers "which rows are closest". That keeps the part with the
 * arithmetic in it testable by hand, which is the only way to be sure a distance is the
 * distance you meant.
 */

/** One municipality's position: one number per indicator, null where it has no value. */
export type Feature = Array<number | null>

/**
 * Mean of the per-year standard scores across a window, per municipality per indicator.
 *
 * A single year is not a usable basis and this is the whole reason the window exists.
 * Measured against the committed pantry: neighbours computed from 2023 and from 2024 agree on
 * the nearest municipality for only 89 of 290, with a mean overlap of 2.39 of the top five. A
 * ten-year window raises that to 244 of 290 and 4.36 of 5. The single-year version is not a
 * noisier description of the same thing; it is mostly a description of which of a dozen
 * near-tied candidates happened to edge ahead that year.
 *
 * Years an indicator does not cover are skipped rather than counted as absences, so an
 * indicator present for six of the ten window years is averaged over those six. A
 * municipality with no value in any covered year gets null for that indicator, and
 * `distance` then leaves the indicator out of the comparison entirely.
 */
export function windowMean(perYear: ReadonlyArray<Array<number | null> | null>): Feature {
  const covered = perYear.filter((year): year is Array<number | null> => year !== null)
  if (covered.length === 0) return []
  const rows = covered[0]!.length
  const out: Feature = []
  for (let m = 0; m < rows; m++) {
    let sum = 0
    let n = 0
    for (const year of covered) {
      const v = year[m]
      if (v === null || v === undefined) continue
      sum += v
      n += 1
    }
    out.push(n === 0 ? null : sum / n)
  }
  return out
}

/**
 * Root mean squared difference over the dimensions BOTH municipalities have, rescaled to the
 * full dimension count.
 *
 * Rescaling is what makes a pair compared on nine indicators comparable with a pair compared
 * on ten: without it, a missing dimension would remove a term from the sum and every pair
 * involving one of the five municipalities with no house price would look closer to everyone
 * than it is. Measured after the fact, those five appear as somebody's neighbour 17 times out
 * of 1,450 — 1.17%, against a 1.72% share of the country — so the correction does not
 * over-shoot into pushing them away either.
 *
 * Returns null, not 0, when the two share no dimension at all. Two municipalities with
 * nothing in common are not identical, and a 0 here would sort them to the top of every list.
 */
export function distance(a: Feature, b: Feature): number | null {
  if (a.length !== b.length) {
    throw new Error(`distance: ${a.length} dimensions against ${b.length}`)
  }
  let sum = 0
  let shared = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (x === null || x === undefined || y === null || y === undefined) continue
    sum += (x - y) ** 2
    shared += 1
  }
  if (shared === 0) return null
  return Math.sqrt((sum / shared) * a.length)
}

export type Neighbour = { index: number; distance: number; shared: number }

/** How many dimensions two features actually have in common. */
export function sharedDimensions(a: Feature, b: Feature): number {
  let n = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (x !== null && x !== undefined && y !== null && y !== undefined) n += 1
  }
  return n
}

/**
 * The `k` closest rows to `from`, nearest first.
 *
 * Ties are broken by `tieBreak` — the municipality code in practice — rather than by array
 * position, because the pantry must rebuild byte-identically and array position is an
 * accident of SCB's response order. Exact ties are not hypothetical here: the gap between the
 * fifth and sixth nearest has a measured minimum of 0.000 across the 290.
 *
 * The result is a set the caller must not present as a ranking. That same gap has a median of
 * 0.032 against typical distances near 1.0, so "the third most similar" is a claim the
 * numbers do not support.
 */
export function nearest(
  features: readonly Feature[],
  from: number,
  k: number,
  tieBreak: (index: number) => string,
): Neighbour[] {
  const self = features[from]
  if (!self) throw new Error(`nearest: no feature row at index ${from}`)
  const candidates: Neighbour[] = []
  for (const [index, other] of features.entries()) {
    if (index === from) continue
    const d = distance(self, other)
    if (d === null) continue
    candidates.push({ index, distance: d, shared: sharedDimensions(self, other) })
  }
  candidates.sort(
    (p, q) => p.distance - q.distance || tieBreak(p.index).localeCompare(tieBreak(q.index)),
  )
  return candidates.slice(0, k)
}
