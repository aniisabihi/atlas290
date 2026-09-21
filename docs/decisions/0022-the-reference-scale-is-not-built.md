# ADR-0022: The reference scale is not built

- **Status:** Accepted | **Date:** 2026-09-21
- **Decided by:** Aniisa Bihi (draft by Claude Opus 5)
- **Affects:** `shared/pantry.ts`, `kitchen/src/indicators/**`, `public/pantry/`
- **Related:** [Fifth slice design](../plans/2026-09-21-fifth-slice-design.md) D9,
  [Plan 20](../plans/2026-09-21-20-stage-c-the-reference-scale.md),
  [0021](0021-stage-a-and-what-the-tables-said.md)

## Context

The fifth slice's stage C was one question with two answers allowed: build
`scale.reference: 'national-median'` and have `share-65-plus` use it, or delete the field as a
promise the site does not keep. The fourth slice had recorded Q30 — "Is this place ageing faster
than the country?" — as needing no work at all, because "`scale.reference: 'national-median'`
already exists in the contract".

## Decision

**D1 — `scale.reference` is removed from the contract.** Both of its values were dead, in
different ways.

`'zero'` was declared by seven indicators and read by nothing. The zero those scales want marked
is derived from `kind: 'diverging'` — `zeroClassOf` in `src/map/colour.ts` returns
`classOf(indicator, 0)` for a diverging scale and `null` otherwise, and never looks at
`reference`. So the field was not merely unused, it was redundant with a field beside it.

`'national-median'` had no producer and no consumer.

**D2 — `'national-median'` is not built, because it contradicts fixed breaks.** The breaks are
quantiles **fixed across every year**, which is what stops a municipality's colour changing as
the slider moves while its value stands still. A national median moves every year. Colouring
against it would do exactly what fixed breaks exist to prevent. It would also need a per-year
national figure, which the pantry does not publish to the map at all — so D9's "a small piece of
site work" was an underestimate in two directions at once.

**D3 — No `schemaVersion` bump.** Removing an OPTIONAL field is compatible both ways: an old
pantry parses against the new schema because zod strips the key, and a new pantry parses against
the old schema because the field was optional. That is not true of plan 17's `contentCode` →
`contentCodes`, which renamed a required field and therefore bumped.

**D4 — `councillors-women-share` becomes sequential.** See Consequences.

**D5 — Q30 is recorded as unanswered rather than quietly closed.** See Consequences.

## Motivation (why)

|                               | Before |       After |
| ----------------------------- | -----: | ----------: |
| Readers of `scale.reference`  |      0 |           — |
| Indicators declaring it       |      7 |       **0** |
| `"reference"` keys published  |      7 |       **0** |
| Published series that changed |      — | **0 of 42** |
| Unit tests                    |  1,323 |   **1,327** |

Not one published number moved: the eight changed files are the index and seven indicator files,
and every one of the 42 series is byte-identical.

## Alternatives considered

- **Build the median scale anyway, recentring breaks per year.** Rejected: it contradicts fixed
  breaks, and the contradiction is the point of fixed breaks rather than an inconvenience.
- **Keep `reference: 'zero'` and delete only `'national-median'`.** Rejected: `'zero'` says
  nothing `kind: 'diverging'` does not already say, and a field kept "for symmetry" is the next
  reader's puzzle.
- **Answer Q30 here as an indicator.** It is the right answer to Q30 and the wrong scope for
  this stage. Filed.

## Consequences

- **Q30 is still unanswered, and the contract no longer pretends otherwise.** The question list
  asked for "Share 65+ **minus** the national share, percentage points" — a number, in the same
  family as the education gap, the turnout gap and the life-expectancy gap, all of which ship as
  indicators. The fourth slice reclassified it as a scale on the strength of this field existing,
  and that reclassification is what this record undoes. Deleting the field does not answer the
  question; it stops the schema claiming the answer is already half-built.

- **Removing the field found a defect it had been hiding.** `councillors-women-share` was
  declared `kind: 'diverging'` in plan 19. Its values run **24 to 58** and never approach zero,
  so the legend was marking a zero class twenty-four points outside the data and the map drew a
  signed PuOr ramp for an unsigned measure. It is now sequential, like `share-65-plus`,
  `share-houses` and `share-rentals`. Parity at 50 would be a defensible midpoint for a diverging
  scale, but choosing one would be the "higher is better" flag this project deliberately does not
  have.

- **The test pins the rule, not the instance.** Every diverging indicator's published values must
  actually straddle zero. The six that were already diverging do — net migration reaches −72.82,
  natural change −20.25, the education gap −7.75, the life-expectancy gap −0.5, the turnout gap
  −0.2 — and a future indicator that declares diverging without meaning it now fails the build
  rather than shipping a legend that marks nothing.

- **`kind` is now the whole scale contract**, and it carries three separate jobs: the colour ramp
  (`src/map/colour.ts`), whether a figure prints its sign (`src/i18n/format.ts`), and whether the
  legend marks a zero class. Worth knowing before anyone adds a fourth thing to it.
