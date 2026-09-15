# Plan 6: Similar municipalities, and a profile that reads

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two things the profile panel cannot do today. Say which other municipalities are like this one, and say in words what its own numbers have done since 1968.

**Architecture:** The distance metric is computed in the kitchen and published as a pantry file, like every other derived figure. The site reads it and renders it. The prose is generated in the site from series the site already holds, because it depends on the selected year and cannot be precomputed for all 58 of them.

**Tech stack:** Unchanged. No new dependency — the metric is arithmetic and the prose is string templates.

**Spec:** [docs/DESIGN.md](../DESIGN.md), sections 3 (architecture), 4 (data model), 7 (scope), 8 (known limitations).

## Why this plan is sixth and the facts engine seventh

Decided by the architect on 2026-09-15 and recorded in [docs/plans/README.md](README.md): a fact is only interesting relative to something, and this plan builds the "places like it" baseline that Plan 7 will need in order to say "unusual _for a place like this_" rather than ten variations of "Stockholm is the biggest".

## Global constraints

Unchanged. The four that bind hardest here:

- **The site reads `public/pantry/` and nothing else.** No runtime request of any kind.
- **Absence is never zero.** A municipality with no house-price figure is compared on the nine indicators it has, never on ten with a zero substituted.
- **No "higher is better" anywhere.** "Places like this" is not a league table and carries no ordering of merit. The prose says what changed, never whether that was good.
- Both languages on every visible string, enforced by the type. Conventional Commits. Trailer: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Never `--no-verify`. Work on `feat/plan-06-similar-and-story`; do not push, merge or change branches from inside a task.

## Verified facts

Measured on 2026-09-15 against the committed pantry, before any of this was designed. Every number below came from running the metric, not from expecting it.

| Fact                                                                                                                                                                                       | How it was verified                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| **A single year is not a usable basis.** Neighbours computed from 2023 and from 2024 agree on the nearest municipality for only **89 of 290**; mean overlap of the top five is **2.39/5**  | built both and compared                                              |
| A **ten-year window** raises that to **244/290** and **4.36/5**; fifteen years to 260/290 and 4.60/5                                                                                       | swept spans 1, 3, 5, 10, 15                                          |
| **Raw values must not be used.** Population's largest z-score is **12.49** and density's **10.37**, so distance becomes a test of "is it Stockholm"                                        | computed the distribution of all ten for 2024                        |
| Under a log transform those fall to **4.00** and **3.19** — and Arjeplog's nearest places change from Storfors, Ydre, Askersund to **Jokkmokk, Sorsele, Storuman**                         | ran both and read the output                                         |
| **Five municipalities have no 2024 house price** — Bjurholm, Malå, Sorsele, Dorotea, Arjeplog, all `too-few-cases`                                                                         | read the status bytes                                                |
| Comparing on shared dimensions only does **not** pull them in: they appear as somebody's neighbour **17/1450 times (1.17%)** against a 1.72% share of the country                          | counted appearances and mean distances                               |
| **`mean-age` and `share-65-plus` correlate at 0.991**, `net-migration-rate` and `population-change` at 0.902 — so age and growth each effectively get two votes                            | correlation matrix over the windowed features                        |
| …but it barely changes the answer: dropping the duplicates keeps the same nearest municipality for **233/290** and 4.19/5 of the top five, with the top three near-identical throughout    | built all-ten, eight-indicator and half-weight variants and compared |
| **Per-year neighbours are not affordable and not possible.** `tax-rate` starts in 2000, so the earliest ten-year window ends **2009** — no neighbours for 42 of the 58 years               | read every indicator's coverage                                      |
| …and publishing 2009–2024 would add roughly **320 kB to a 1.00 MB pantry** for those 16 years                                                                                              | counted entries                                                      |
| **The cut at five is arbitrary.** The gap between the 5th and 6th nearest has a median of **0.032** against typical distances near 1.0, and a minimum of **0.000** — an exact tie          | computed the gap for all 290                                         |
| **Mutuality is 55%.** A is in B's five for only 798 of 1450 relationships, so "similar to" cannot be worded as if it were symmetric                                                        | checked every pair                                                   |
| The metric finds real kinds of place unprompted: **Lund → Uppsala, Linköping, Umeå**; **Gävle → Uddevalla, Östersund, Karlskrona, Sundsvall**; **Katrineholm → Motala, Köping, Sandviken** | read the output for a spread of probes                               |
| **Population peaks mid-series for 160 of 290 municipalities** — 55 peak in the first year and 75 in the last, so a "peak was in YYYY" sentence must decline for 130 of them                | found the maximum of every population series                         |
| **185 of 290 have a rank inside the top or bottom 10%** of at least one indicator in 2024, and the winning indicator is spread across all ten (48/43/41/36/29/24/21/20/17/11)              | ranked all ten for 2024 and took each municipality's most extreme    |

## The decisions this plan makes

Recorded here and in a decision record, per [docs/decisions/README.md](../decisions/README.md).

**D1 — All ten indicators, equally weighted.** The three variants tried (all ten; eight with the near-duplicates dropped; all ten with duplicate pairs sharing a vote) produce near-identical top-three lists, so the simplest rule wins: every indicator the site has, one vote each. Any subset would need an editorial argument for why two measures do not count, which a visitor cannot check. The 0.991 correlation between mean age and share aged 65+ is real and means age carries more weight than one tenth; that goes in DESIGN section 8 as a stated limitation rather than being fixed by a rule nobody can verify.

**D2 — A ten-year window ending at the last complete year, not the selected year.** Proven above: one year is noise, ten years is stable, and a per-year version cannot exist before 2009. So similarity is one fixed set, and the site says out loud which years it was measured over. It does not move when the slider moves, because what kind of place somewhere is does not change annually.

**D3 — Log transform for the four skewed indicators** (`population`, `density`, `house-prices`, `median-income`), chosen by a declared list in the kitchen and recorded in the published file, never inferred at render time.

**D4 — Missing cells reduce the dimensions, never the value.** Distance is the root of the mean squared difference over the dimensions both municipalities have, rescaled to ten. Measured not to bias the five affected municipalities into other people's lists.

**D5 — Five neighbours, presented as a set and not a ranking.** The 5th/6th gap is a rounding error, so the panel says "places like this" and lists them, with no ordinal, no "most similar", and no numbered positions. The distance is not shown either: a number to two decimals would invite exactly the false precision the gap measurement disproves.

**D6 — The prose is the municipality's own story, not a comparison.** Chosen by the architect. It needs nothing but the series the site already holds, every clause traces to a figure the sparkline beside it already draws, and it stays true regardless of what the distance metric later becomes.

## The published file

A new pantry file rather than a field on `PantryData`, for the same reason adjacency and bubbles are separate: it is derived from the data rather than part of it, and the site can validate and fail on it independently.

```ts
// public/pantry/data/similar.json
{
  schemaVersion: 1,
  method: {
    indicators: string[]   // the ten ids, in published order
    logged: string[]       // which were log-transformed
    window: { from: number; to: number }
    neighbours: number     // 5
  },
  // code -> the codes of its five nearest, in ascending distance, ties by code
  nearest: Record<MunicipalityCode, MunicipalityCode[]>
}
```

`method` is published, not assumed. The panel's "measured over 2015–2024 across ten indicators" line is rendered from this object, so a changed window cannot leave a stale sentence behind — the specific failure mode Plan 4's facts strip was built to avoid.

## The prose

Three rules, in order. Each either fires with a sentence or declines. A rule that cannot state its claim truthfully says nothing; there is no filler.

1. **The arc.** "Åsele har förlorat 53 % av sina invånare sedan 1968, från 5 764 till 2 694." Fires when population exists in both the first covered year and the selected year. Six municipalities did not exist in 1968, so the rule uses each municipality's own first year and says which.
2. **The turn.** "Folkmängden var som störst 1968." Fires only when the peak is neither the first nor the last year of the series — a real turning point, true of 160 of 290.
3. **Where it stands.** "Huspriserna är de lägsta i landet, av 285 kommuner med siffror." Fires only when the municipality sits in the top or bottom tenth of some indicator, which is true of 185 of 290; picks the single most extreme, and names the denominator, because 285 is not 290.

**Every rule gets a test that re-derives its claim from the pantry**, exactly as the facts strip does — the same guard, for the same reason, since a monthly refresh is when a confident sentence quietly becomes false.

## File structure

```
shared/pantry.ts                          Similar schema
kitchen/src/similar/standardise.ts        per-year z-scores, log where declared
kitchen/src/similar/standardise.test.ts
kitchen/src/similar/distance.ts           windowed mean, shared-dimension distance, k-nearest
kitchen/src/similar/distance.test.ts
kitchen/src/similar/build.ts              the whole metric, and its guards
kitchen/src/similar/build.test.ts
kitchen/src/publish.ts                    writes data/similar.json

src/data/pantry.ts                        loads and validates it
src/data/similar.ts                       reading it, with the method
src/data/similar.test.ts
src/profile/story.ts                      the three rules, both languages
src/profile/story.test.ts                 each claim re-derived from the pantry
src/components/SimilarPlaces.tsx
src/components/SimilarPlaces.test.tsx
src/components/ProfileStory.tsx
src/components/ProfileStory.test.tsx
e2e/similar.spec.ts
docs/decisions/0002-similarity-metric.md
```

## Tasks

### Task 1 — The schema

- [ ] Add `Similar` to `shared/pantry.ts`: `schemaVersion`, `method`, `nearest`.
- [ ] `superRefine`: every value in `nearest` must be non-empty, must not contain its own key, must have no duplicates, and `method.window.from` must be `<= method.window.to`.
- [ ] Tests for each refinement, each one mutation-tested by breaking the rule it guards.

### Task 2 — Standardising

- [ ] `kitchen/src/similar/standardise.ts`: `zScoresForYear(series, year, { log })` returning one number or null per municipality, using the population standard deviation over present values only.
- [ ] `LOGGED` as an exported constant listing the four skewed indicators, with the measured z-scores in the comment so the choice is evidence and not taste.
- [ ] Throws rather than returning zeros when a year has fewer than two present values — a standard deviation of zero would make every distance infinite or NaN and the map would still render.
- [ ] Tests: a known series by hand; log applied only to declared indicators; a null stays null; the throw.

### Task 3 — Distance

- [ ] `kitchen/src/similar/distance.ts`: `windowMean` (mean of per-year z over the window, per municipality per indicator, skipping years an indicator does not cover), `distance` (root mean squared difference over shared dimensions, rescaled to the full count), `nearest` (k smallest, ties broken by code so the output is deterministic).
- [ ] `distance` returns null when no dimension is shared, rather than 0 — two municipalities with nothing in common are not identical.
- [ ] Tests: a hand-computed three-municipality case; the rescaling proven by comparing a full pair with a pair missing one dimension; the tie-break; the null.

### Task 4 — Building, with guards

- [ ] `kitchen/src/similar/build.ts`: assembles the file from a `PantryData`, choosing the window as the ten years ending at the last year every indicator covers, computed from the data rather than written down.
- [ ] **Guard A:** every municipality must end with exactly five neighbours, or throw naming the municipality.
- [ ] **Guard B:** every municipality must share at least eight of the ten dimensions with each of its five, or throw — a neighbour chosen on four indicators is not a neighbour.
- [ ] **Guard C:** the window must be at least ten years and must lie inside every indicator's coverage, or throw naming the indicator that fails.
- [ ] Tests: the happy path against the real pantry; each guard mutation-tested by feeding data that violates it.

### Task 5 — Publishing

- [ ] Write `public/pantry/data/similar.json` from `publish()`, through `writePantryFile` so the schema is enforced at write time.
- [ ] Run `yarn kitchen publish` and commit the generated file.
- [ ] Extend the determinism test so a second run is byte-identical, and confirm the published window is 2015–2024 and the file's real size.

### Task 6 — Loading it

- [ ] `src/data/pantry.ts` fetches and validates `similar.json` alongside the other four; a missing or invalid file fails loudly with the same message shape.
- [ ] `src/data/similar.ts`: a small reader giving the neighbours for a code and the method.
- [ ] Extend `src/data/pantry.test.ts` for the new file, including the not-ok case.

### Task 7 — Places like this

- [ ] `SimilarPlaces.tsx` in the profile: a heading, five links that select that municipality, and one line stating the method from the published `method` object.
- [ ] No ordinal, no numbering, no distance shown — D5.
- [ ] Both languages. Links are real links carrying the URL state, so middle-click and "open in new tab" work like everything else on this site.
- [ ] Tests: renders five; each link lands in the right state; the method line reads from the file rather than a literal; a municipality missing from the file renders nothing rather than throwing.

### Task 8 — The story

- [ ] `src/profile/story.ts`: the three rules, each returning `{ id, text: Record<Lang, string>, claim, check }` in the shape `facts.ts` already uses.
- [ ] Each rule declines cleanly — returns null — rather than emitting a sentence it cannot support.
- [ ] Swedish and English both written by hand, not templated from one into the other; number formatting goes through `src/i18n/format.ts`.

### Task 9 — The story, tested and rendered

- [ ] `story.test.ts`: every rule's claim re-derived from the committed pantry for a spread of municipalities, including the six that did not exist in 1968, the five with no house price, and a municipality whose peak is its last year.
- [ ] Assert the measured coverage: rule 2 fires for 160 of 290, rule 3 for 185 of 290 — so a refresh that quietly changes the shape of the prose fails the build.
- [ ] `ProfileStory.tsx` renders it into the profile above the ten rows; tests for both languages and for the declining case.

### Task 10 — In a browser

- [ ] `e2e/similar.spec.ts`: open a profile, confirm the similar list is there, follow one of its links and confirm the URL and the panel both change.
- [ ] Confirm the story reads correctly in both languages, and that the axe scan stays clean with the two new blocks present.
- [ ] Run the full suite in all three engines and Lighthouse; the performance budget must still pass with the new pantry file.

### Task 11 — Write it down

- [ ] `docs/decisions/0002-similarity-metric.md`: D1–D6 with the measurements behind them, and the correlation limitation stated plainly.
- [ ] DESIGN section 8 gains the double-counted-age limitation; section 7's increment list marks this one done.
- [ ] `docs/kitchen.md` gains the new stage; `docs/plans/README.md` marks Plan 6 done.
- [ ] Final review of every change, then open a PR.
