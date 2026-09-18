# ADR-0015: The old implementations go

- **Status:** Accepted | **Date:** 2026-09-18
- **Decided by:** Aniisa Bihi (draft by Claude Opus 5)
- **Affects:** `kitchen/src/indicators/**`, `src/indicators.semantics.test.ts`
- **Related:** [Plan 15](../plans/2026-09-18-15-the-old-implementations-go.md),
  [issue #28](https://github.com/aniisabihi/atlas290/issues/28), completes
  [0014](0014-indicators-become-definitions.md) D7

## Context

[0014](0014-indicators-become-definitions.md) turned nine indicators into declarations and
deliberately left their hand-written implementations in the tree: that change's whole claim was
that nothing moved, and a 1,500-line deletion in the same diff would have buried the proof. It was
filed as #28 with the real question attached rather than an answer — **roughly 190 test assertions
exercised the dead code, and some of them encoded data semantics that were expensive to learn.**

Four options were put to the architect on 2026-09-18 and **B** was chosen: delete the code,
re-home the assertions that were derived independently of the pipeline, drop the ones the shared
resolver now covers generically.

## Decision

**D1 — The `fetch*` entry points went first, on their own.** Eight per-indicator verification runs
from plans 1 and 2, with no caller anywhere — not production, not a test, not a spike. No
trade-off to weigh, so nothing was gained by weighing it alongside one.

**D2 — The net was built before anything was deleted, not after.** `define.test.ts` proved one
indicator; it now proves all nine, each equal to its published series value for value and status
byte for status byte. Written and verified able to fail — by changing education's numerator from
levels 5+6+7 to 6+7 — before the first deletion.

**D3 — A figure that was derived independently is worth more than the code that produced it.**
Twenty-eight assertions — the extremes, the awkward cells, the per-table status semantics — moved
to `src/indicators.semantics.test.ts`, reading the published pantry. Every expected value was
re-read off the committed file while moving it, never carried across on trust. All twenty-eight
agreed.

**D4 — A table-specific claim was retargeted, not deleted.** Roughly thirty more assertions were
about what a particular SCB table does: TAB1211 has no sex total and must sum both, TAB1212 and
TAB6640 carry four-digit Stor-Stockholm codes that look like municipalities and are not, TAB1169's
permanent-home code must be resolved by label because `221` sorts first. Those now run against the
declarations the pipeline uses, through the shared resolver. Only the selection-shape assertions
`source.test.ts` covers generically were dropped.

**D5 — `Source.verify` exists because a rule cannot say what a code means.** See Consequences: the
deletion found that plan 14 had left a live guard behind in dead code.

**D6 — Education's national-aggregate check stayed in the kitchen.** It sums the raw frozen chunks
and reconciles the total against SCB's own whole-country row. That is a claim about the fetch, not
about what was published, so the published pantry is the wrong place for it.

## Motivation (why)

|                                                   | Before |              After |
| ------------------------------------------------- | -----: | -----------------: |
| Non-test lines under `kitchen/src/indicators/`    |  3,753 |          **2,651** |
| Test lines under the same                         |  3,622 |          **2,302** |
| `tax.ts`                                          |    164 |             **73** |
| `migration.ts`                                    |    300 |            **112** |
| `housing.ts`                                      |    401 |            **194** |
| `income.ts`                                       |    260 |            **118** |
| `education.ts`                                    |    349 |            **209** |
| `derived.ts`                                      |    711 |            **440** |
| `density.ts`                                      |    237 |            **160** |
| Definitions proven against their published series | 1 of 9 |         **9 of 9** |
| `public/pantry/`                                  |      — | **byte-identical** |

Plan 14's halving target was written against the nine old modules, and read against those, they
halved.

## Alternatives considered

- **Delete everything, tests included.** Cheapest. It would have lost Solna's 1990 price resting
  on two sales, Knivsta's perturbation year and Filipstad as the real lowest post-secondary share
  — and the loss would not have shown up until an SCB table changed shape.
- **Retarget all 129 assertions onto the definitions.** Loses nothing, costs the most, and would
  have re-homed a large number of selection-shape claims `source.test.ts` already makes.
- **Keep the dead code as an equivalence oracle until after the fifteen.** Buys nothing plan 14 had
  not already proved byte-identically, and carries two implementations of every indicator through
  the slice that adds fifteen more.

## Consequences

- **A live guard had been running nowhere since plan 14, and this deletion is what found it.**
  `post-secondary-education` picks `UtbildningsNiva` levels 5, 6 and 7 because of what those levels
  are — a human definition the table does not state. `validateLevels` asserts TAB3981 still labels
  those eight codes as assumed, so a codelist change fails loudly instead of quietly redefining the
  published share. Plan 14 moved education to a declaration and left `validateLevels` behind in
  `educationSelection`, which nothing calls. Nothing failed, because a byte-identical pantry cannot
  exercise a codelist SCB has not changed. A dimension rule says which codes to take and can never
  say what one is expected to mean, so that belongs to the source: `Source.verify` is a check the
  metadata must pass before any selection is built, and education declares `validateLevels` there.
- **What this leaves behind has an honest limit.** `define.test.ts` compares a definition's output
  to the published pantry, which the definition generated. That proves no drift; it cannot prove a
  definition was ever right. The non-circular part is `src/indicators.semantics.test.ts` and
  `src/indicators.headline.test.ts`, whose figures were hand-summed or checked against the live API
  on 2026-09-14. **Plan 16's fifteen have no byte-identical predecessor at all**, so they need
  figures of that second kind from the start rather than the first.
- **This project's memory of TAB1169's labels was wrong twice over**, found by writing the first
  test of the by-label dimension rule: `Fastighetstyp` 220 is `permanentbostad (ej tomträtt)`, and
  the price content code is labelled `Köpeskilling, medelvärde i tkr`. Both were read off the
  frozen metadata. The guard is not decoration.
- **Writing the reader that re-read the pantry got `OBSERVATION_STATUS`'s order wrong from
  memory**, which turned four cells into plausible nonsense — Solna's two-sale cell read as
  `did-not-exist`, Knivsta's pre-existence years as `too-few-cases`. The enum's index is a
  persisted status byte. Nothing errored; only the labels were wrong. It was read from
  `shared/pantry.ts` instead, and that is the only way to read it.
- Perturbation is now asserted in both directions: never present for the four tables carrying no
  CKM note, always present for the four that do. A one-way assertion catches half of a published
  lie.
- `tax.test.ts` is down to a single claim — its own year range. Everything else it asserted has a
  better home, and the file says which.
