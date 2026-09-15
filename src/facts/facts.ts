import type { Facts } from '../../shared/pantry'

/**
 * The facts strip, read rather than written.
 *
 * This module used to hold five sentences a person chose and worded by hand, each with a check
 * the tests re-derived from the pantry. Plan 7 moved the finding and the wording into the
 * kitchen; what is left here is the reader.
 *
 * **The check did not move — it got more important.** A hand-written sentence has an author who
 * would notice it going stale. A generated one does not, so `facts.test.ts` still recomputes
 * every published claim from `indicators.json` alone, by a route that does not run the
 * generator. That is the only thing standing between a monthly refresh and a confident lie on
 * the front page.
 */
export type Fact = Facts['facts'][number]

export function factsFrom(facts: Facts): readonly Fact[] {
  return facts.facts
}

/** The five families, in the order the kitchen emits them: widest claim first. */
export function familiesIn(facts: Facts): readonly string[] {
  return facts.facts.map((f) => f.family)
}
