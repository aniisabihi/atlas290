import type { Indicator, PantryData } from '../../shared/pantry'

/**
 * The figure SCB actually published, recovered from the inflation-adjusted one.
 *
 * The pantry stores money adjusted to a single year's kronor, because nominal kronor across four
 * decades mostly show inflation. But "what did a house there cost at the time" is a real question
 * and the profile answers it, so the original has to come back.
 *
 * It comes back exactly rather than approximately, which is why this is arithmetic on screen
 * rather than a second copy of every figure in the pantry. SCB publishes these in thousands of
 * kronor, so every original landed on a known step; undo the adjustment and snap to that step and
 * the rounding the pipeline applied on the way out is undone precisely.
 * `nominal.test.ts` proves it for all 20,260 money cells against the frozen SCB responses.
 */
export function nominalOf(
  data: PantryData,
  indicator: Indicator,
  adjusted: number | null,
  year: number,
): number | null {
  if (adjusted === null) return null
  if (indicator.priceBasis !== 'fixed-latest-year') return null

  const step = indicator.publishedStep
  if (step === undefined) {
    throw new Error(
      `${indicator.id}: adjusted for inflation but has no publishedStep, so the figure SCB ` +
        `published cannot be recovered`,
    )
  }

  const base = data.priceIndex.values[String(data.priceIndex.base)]
  const then = data.priceIndex.values[String(year)]
  // Never invent a figure for a year the index does not reach.
  if (base === undefined || then === undefined) return null

  return Math.round((adjusted * then) / base / step) * step
}
