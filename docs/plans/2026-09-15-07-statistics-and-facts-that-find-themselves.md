# Plan 7: Statistics, and facts that find themselves

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace five sentences a person wrote by hand with a file the kitchen generates, and make the machine find things nobody went looking for.

**Architecture:** A statistics module in the kitchen, five fact families built on it, and a published `data/facts.json` the site renders. The site keeps no fact-finding logic at all; `src/facts/facts.ts` stops being a list of sentences and becomes a reader.

**Tech stack:** Unchanged. No new dependency.

**Spec:** [docs/DESIGN.md](../DESIGN.md), sections 3 (architecture), 4 (data model), 7 (scope).

## What the investigation changed about this plan

Measured on 2026-09-15 against the committed pantry, before anything was designed. Three findings moved the plan away from what the roadmap assumed.

**1. Plan 6's neighbours do not, on their own, solve the "Stockholm is the biggest" problem.** Ranking municipalities by how far they sit from the average of their five nearest still puts Stockholm first, at 10.46 standard deviations. The reason is not that Stockholm is surprising: it is that Stockholm has no close neighbours, so a large residual measures the failure of the match rather than a fact about the place.

**2. There is a circularity nobody spotted when the order was decided.** All ten indicators are used to find the neighbours, so "unusual population among places with a similar population" is close to self-contradictory. The fix is leave-one-out — find the neighbours on the other nine, then measure the surprise on the tenth — and it is both principled and sayable out loud: _among the places most like Kävlinge in every other way, Kävlinge taxes least_.

**3. The strongest facts turn out to need no neighbours at all.** The best material found anywhere in this investigation is in time, not in similarity: Kramfors and Strömsund lost people **every single year for 47 years** and then stopped; six municipalities have grown **every year since 1968**; Stockholm was **15% smaller in 1981** than in 1968; **288 of 290** municipalities tax more in 2026 than in 2000.

This does not undo the decision to run Plan 6 first — leave-one-out surprise is a real family and it needs Plan 6's machinery. But it is worth recording that the ordering argument was only partly right, and that the facts strip's best sentences would have been reachable either way.

## Verified facts

| Fact                                                                                                                                                                                    | How it was verified                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Ranking by distance from the neighbours' mean puts **Stockholm first at z = 10.46**, and the top 40 hold only 28 distinct municipalities                                                | built it and read the output              |
| Those municipalities' neighbours are **far away** — mean peer distance 1.67–2.88 against a median of **0.99**                                                                           | measured the distances                    |
| Leave-one-out **alone does not fix it** — Stockholm still leads, at z = 11.92                                                                                                           | rebuilt with the held-out column          |
| Leave-one-out **on the windowed standard scores** does: the top becomes Kävlinge and Vellinge taxing far below their twins, Lund's education, Burlöv's income, Gällivare's mining wages | rebuilt in the windowed space             |
| Single-year surprise collapses onto the volatile indicators — **only `tax-rate`, `net-migration-rate` and `population-change`** appear in its top 40                                    | compared single-year with windowed        |
| **Kramfors and Strömsund fell every year from 1968 to 2015** — 47 consecutive years                                                                                                     | walked every population series            |
| **Six municipalities have grown every year since 1968**: Vallentuna, Sollentuna, Strängnäs, Växjö, Lund, Ängelholm                                                                      | same walk, the other direction            |
| **29 municipalities fell to a trough and recovered** — Sundbyberg −11% to 1981 then +123%; Stockholm −15% to 1981 then +54%                                                             | found each trough and measured both sides |
| **288 of 290 tax more in 2026 than in 2000**; **283 of 290** have a larger share aged 65+ than in 1968; **124 of 284** have fewer people than in 1968                                   | counted                                   |
| The population series has **no structural breaks at all** — 16,368 `present` and 290 `perturbed`, nothing else                                                                          | tallied every status byte                 |
| **2025 is the only perturbed year**, and every municipality's 2025 figure is perturbed                                                                                                  | same tally                                |
| SCB's Cell Key Method noise is **an integer in −3…+3**, quoted from SCB in [scb-pxweb.md](../research/reports/scb-pxweb.md)                                                             | read the research report, not assumed     |
| Several municipalities change by **0, 1 or 2 people** between 2024 and 2025, so a run extended into 2025 can be an artefact of that noise rather than a fact                            | measured every 2024→2025 step             |

## The decisions this plan makes

**D1 — Five families, one fact each, rather than one ranking of everything.** "How surprising" is not comparable across kinds of claim: a 47-year run of decline and a tax rate three points below a municipality's twins are both striking and there is no honest exchange rate between them. Inventing one would be a number with no meaning dressed as objectivity. So each family ranks its own candidates by its own measure, and the strip takes the best of each — which is also what the architect chose for the hand-written strip in Plan 4, for the same reason.

| Family     | What it says                                            | Ranked by                              |
| ---------- | ------------------------------------------------------- | -------------------------------------- |
| `country`  | 288 of 290 municipalities tax more in 2026 than in 2000 | how lopsided the split is              |
| `run`      | Kramfors lost people every year for 47 years            | length of the run                      |
| `reversal` | Stockholm was 15% smaller in 1981 than in 1968          | depth of the fall times the recovery   |
| `unusual`  | Kävlinge taxes least of the places most like it         | leave-one-out gap, in standard scores  |
| `extreme`  | Arjeplog has 0.2 people per km²; Sundbyberg has 6,446   | rank 1, and the ratio between the ends |

**D2 — The `unusual` family uses leave-one-out, in the windowed space.** Neighbours are recomputed on the other nine indicators, and the surprise is the gap between a municipality's own windowed standard score and the mean of theirs. Both sides are already ten-year means, so a one-year spike cannot produce a fact. Finding 2 above is the reason; finding 4 is the evidence that it works.

**D3 — A fact may not rest on the sign of a perturbed step.** Only 2025 is perturbed, the noise is an integer in −3…+3, and 2024 is clean — so a step into 2025 is trustworthy exactly when it exceeds 3 in absolute value. Runs and reversals apply that test rather than either trusting 2025 blindly or discarding it wholesale. The guard is real: some municipalities move by 0, 1 or 2 people that year.

**D4 — The facts are generated in the kitchen and published, in both languages.** `public/pantry/data/facts.json`. The site renders them and finds nothing itself, which is the same wall every other number in this project sits behind. Sentences are assembled from templates the kitchen holds, so Swedish and English are written by hand once rather than translated per fact.

**D5 — Every published fact keeps its check.** The hand-written facts each carry a claim the tests re-derive from the pantry, and that property is the reason the strip has never gone stale. A generated fact carries the same thing: the numbers it asserts, in a form a test can recompute from `indicators.json` alone, by a route that does not run the generator.

**D6 — Nothing says whether a fact is good news.** A 47-year decline is not a tragedy and 288 municipalities raising tax is not a scandal. The templates state what happened and stop, as everything else in this project does.

## The published file

```ts
// public/pantry/data/facts.json
{
  schemaVersion: 1,
  facts: Array<{
    id: string                          // stable, so a link to one keeps working
    family: 'country' | 'run' | 'reversal' | 'unusual' | 'extreme'
    text: { sv: string; en: string }
    href: string                        // into a view that shows it
    claim: string                       // what a test must be able to re-derive
  }>
}
```

## File structure

```
shared/pantry.ts                        Facts schema
kitchen/src/stats.ts                    runs, reversals, shares, extremes — the arithmetic
kitchen/src/stats.test.ts
kitchen/src/facts/families.ts           the five families, each returning ranked candidates
kitchen/src/facts/families.test.ts
kitchen/src/facts/phrasing.ts           the bilingual templates
kitchen/src/facts/phrasing.test.ts
kitchen/src/facts/build.ts              picking one per family, and the guards
kitchen/src/facts/build.test.ts
kitchen/src/publish.ts                  writes data/facts.json

src/data/pantry.ts                      loads and validates it
src/facts/facts.ts                      becomes a reader over the published file
src/facts/facts.test.ts                 re-derives every published claim
src/components/FactsStrip.tsx           reads the file instead of the constant
docs/decisions/0003-the-facts-engine.md
```

## Tasks

### Task 1 — The schema

- [ ] `Facts` in `shared/pantry.ts`: `schemaVersion`, `facts`.
- [ ] `superRefine`: ids unique; `href` starts with `/?` and carries `i=` and `y=`; both languages non-empty and different from each other where the template differs; at most one fact per family.
- [ ] Tests for each, mutation-tested.

### Task 2 — The statistics module

- [ ] `kitchen/src/stats.ts`: `runs` (longest unbroken rise or fall, with its years), `reversal` (peak, trough, recovery), `shareOf` (how many municipalities satisfy a predicate, and the comparable denominator), `extremes` (highest and lowest with their values).
- [ ] Every one takes a series and returns a plain result; none knows about indicators, languages or sentences.
- [ ] **D3's guard lives here**: a step whose end is perturbed counts only when its size exceeds the CKM bound. The bound is a named constant carrying SCB's own −3…+3 in its comment.
- [ ] Tests: hand-built series for each; the CKM guard mutation-tested by feeding a one-person step into a perturbed year.

### Task 3 — The `country` and `extreme` families

- [ ] `kitchen/src/facts/families.ts`: both families, each returning ranked candidates with the figures they rest on.
- [ ] `country` excludes municipalities missing either endpoint from the denominator — "124 of 284", never "124 of 290".
- [ ] `extreme` names the denominator too, because house prices are suppressed in five municipalities.
- [ ] Tests against the committed pantry, asserting the measured figures above.

### Task 4 — The `run` and `reversal` families

- [ ] Both built on Task 2, both applying D3.
- [ ] A reversal needs a real fall, a trough at least ten years before the end, and a real recovery; the thresholds are stated with the count they produce (29 municipalities).
- [ ] Tests: Kramfors at 47 years, the six 1968-onward growth runs, Stockholm's trough in 1981.

### Task 5 — The `unusual` family

- [ ] Leave-one-out neighbours over the windowed features, reusing `kitchen/src/similar/` rather than a second copy of the metric.
- [ ] Records the gap, the municipality's own value, the neighbours' mean, and which indicator was held out.
- [ ] Tests: the circularity is closed (the held-out indicator is absent from the features the neighbours were found on), and Kävlinge's tax rate is among the top candidates.

### Task 6 — Phrasing

- [ ] `kitchen/src/facts/phrasing.ts`: one template per family, Swedish and English written separately.
- [ ] Numbers formatted for each locale; no template says whether anything is good.
- [ ] Tests: every family renders in both languages; no template can emit an empty number or an undefined name.

### Task 7 — Building and publishing

- [ ] `kitchen/src/facts/build.ts`: one fact per family, deterministic ties, and guards — exactly five facts, five distinct families, every `href` parseable, every claim non-empty.
- [ ] Wired into `publish()`; `data/facts.json` generated and committed; determinism confirmed.

### Task 8 — The site reads them

- [ ] `src/data/pantry.ts` loads and validates `facts.json`.
- [ ] `src/facts/facts.ts` becomes a reader; the hand-written `FACTS` constant is deleted.
- [ ] `FactsStrip.tsx` renders from the file. The existing tests that check each fact links to a renderable view must keep passing, against generated facts rather than written ones.

### Task 9 — Every published claim re-derived

- [ ] `src/facts/facts.test.ts` recomputes each published claim from `indicators.json` alone, by a route independent of the generator — the guard that has kept the strip honest since Plan 4, now applied to facts nobody wrote.
- [ ] Assert the family spread: five facts, five families.

### Task 10 — In a browser, and written down

- [ ] Extend the e2e suite: the strip shows five facts, each link lands on a view that shows it, both languages.
- [ ] Full suite in three engines, axe, Lighthouse.
- [ ] `docs/decisions/0003-the-facts-engine.md` with D1–D6 and the measurements; DESIGN section 7 marks the facts engine done; `docs/plans/README.md` marks Plan 7 done.
- [ ] Final review, then open a PR.
