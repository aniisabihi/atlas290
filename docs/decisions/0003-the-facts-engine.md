# 0003 — How the facts strip finds its own facts

**Date:** 2026-09-15
**Plan:** [Plan 7](../plans/2026-09-15-07-statistics-and-facts-that-find-themselves.md)
**Status:** accepted

## Context

Five sentences on the front page were chosen and worded by a person. Plan 7 replaces them with
a file the kitchen generates. The question the roadmap set was "what makes a fact interesting
rather than merely true", and the answer it assumed was that Plan 6's neighbours would supply
it.

That assumption was half wrong, which is the most useful thing recorded here.

## What the investigation found

**Plan 6's neighbours do not, on their own, solve the "Stockholm is the biggest" problem.**
Ranking municipalities by how far they sit from the mean of their five nearest still puts
Stockholm first, at 10.46 standard deviations. Not because Stockholm is surprising — because it
has no close neighbours, so a large residual measures the failure of the match. The
municipalities at the top of that list have a mean peer distance of 1.67 to 2.88 against a
median of 0.99.

**There is a circularity the ordering decision did not anticipate.** All ten indicators are used
to find a municipality's neighbours, so "is its population unusual among places with a similar
population" is close to self-contradictory.

**The strongest material needs no neighbours at all.** Kramfors and Strömsund fell every year
for 47 years. Twelve municipalities have grown every year since 1968. Stockholm was 15% smaller
in 1981 than in 1968. 288 of 289 municipalities tax more in 2026 than in 2000.

So the ordering argument for running Plan 6 first was only partly right. Leave-one-out surprise
is a real family and needs Plan 6's machinery; the rest of the strip would have been reachable
either way.

## Decisions

### D1 — Five families, one fact each, and no score comparing them

"How surprising" is not comparable across kinds of claim. A 47-year run of decline and a tax
rate three points below a municipality's twins are both striking, and there is no honest
exchange rate between them; a single number ranking one above the other would be an invention
dressed as objectivity. Each family ranks its own candidates by its own measure and the strip
takes the best of each.

| Family     | Ranked by                        | What it currently finds                                    |
| ---------- | -------------------------------- | ---------------------------------------------------------- |
| `country`  | nearness to unanimity, then span | Post-secondary education has risen in all 284 since 1985   |
| `run`      | length of the run                | 12 municipalities have grown every year since 1968         |
| `reversal` | depth of fall times recovery     | Sundbyberg was 11% smaller in 1981, and is now 123% larger |
| `unusual`  | leave-one-out gap                | Kävlinge taxes less than the places most like it           |
| `extreme`  | ratio between the two ends       | Sundbyberg's density is 32,230 times Arjeplog's            |

**The run family's winner is not the best sentence and that is deliberate.** Kramfors and
Strömsund falling every year for 47 years reads better than twelve municipalities growing for 57. Length is a rule anybody can check; "which of those is more interesting" is not, and adding
a tie-break to reach the answer I preferred would be exactly the dressing-up D1 refuses.

### D2 — The `unusual` family is leave-one-out, over the windowed scores

Neighbours recomputed on the other nine indicators; surprise measured on the tenth. Both sides
are Plan 6's ten-year windowed standard scores, never a single year — on single-year values the
family collapses onto the three volatile indicators (tax rate, net migration, population change)
and reports spikes as facts.

It also keeps only candidates whose neighbours are genuinely near, the closer half. Without that
the top is Stockholm, for the reason above.

### D3 — No fact may rest on the sign of a perturbed step

Every 2025 population figure is perturbed, and SCB's Cell Key Method noise is an integer in
−3…+3 (SCB's own words, quoted in [scb-pxweb.md](../research/reports/scb-pxweb.md)). Several
municipalities move by 0, 1 or 2 people that year, so a run extended into 2025 on a one-person
step reports the noise as a fact.

The rule is a test each step has to pass, not a blanket exclusion of 2025: Lund's +743 and
Ängelholm's +49 both clear it, so those runs legitimately reach the perturbed year.

**The bound is in the indicator's own unit.** This was got wrong first: `CKM_MAX_NOISE` is three
_people_, and applying it to `share-65-plus` treated three _percentage points_ as noise — about
a third of the whole national spread — which silently turned "283 of 284" into "284 of 284" by
discarding the one municipality that disagreed. A ±3 perturbation on two counts near 20,000
moves that share by roughly 0.03 points. So the bound is three for a count and zero everywhere
else, and the honest statement is that this project has a published bound for counts and an
argued-negligible effect for the derived indicators, rather than one number pretending to fit
all six units.

### D4 — Generated in the kitchen, published in both languages

`public/pantry/data/facts.json`, 1,636 bytes, rebuilt byte-identically. The site finds nothing
and renders what the file holds. Swedish and English are written out separately rather than one
generated from the other.

### D5 — Every published fact keeps its check

`src/facts/facts.test.ts` recomputes each claim from `indicators.json` by a route that does not
call the kitchen — the arithmetic written out again, because a generator and a checker sharing
an implementation check nothing. Four of the five re-derive fully. The `unusual` claim is half
re-derived, and says so: its own figure is checked against the pantry, but its peer mean is not,
because recomputing a leave-one-out neighbour set in the site would mean a second copy of the
distance metric there. That half is checked where it is computed.

This mattered more after generation, not less. A hand-written sentence has an author who would
notice it going stale; a generated one has nobody.

### D6 — Nothing says whether a fact is good news

A 47-year decline is not a tragedy and 288 municipalities raising tax is not a scandal. The
templates state what happened and stop.

## Consequences

- The strip's wording now changes with the data. Tests that named a sentence had to be rewritten
  to name a shape instead, or they would fail on every refresh for reasons that say nothing.
- A change to Plan 6's distance metric now changes a sentence on the front page, because the
  `unusual` family reuses its windowed features.
- Two claims in the plan document were wrong and the tests caught them: the tax fact is 288 of
  289, not 290 (Knivsta has no rate for 2000), and twelve municipalities have grown every year
  since 1968, not six — a truncated prototype listing that had been read as complete.

## Where the numbers are re-derived

- `kitchen/src/stats.test.ts` — the runs, the reversals, the denominators, and the noise bound
  in each unit.
- `kitchen/src/facts/families.test.ts` — each family's ranking, the leave-one-out circularity,
  and a synthetic pantry for the three rules the real one cannot exercise.
- `kitchen/src/facts/phrasing.test.ts` — both languages, per-locale number formatting, and that
  no template says whether anything is good.
- `src/facts/facts.test.ts` — every published claim, re-derived.
