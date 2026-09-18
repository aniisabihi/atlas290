# ADR-0014: Indicators become definitions

- **Status:** Accepted | **Date:** 2026-09-18
- **Decided by:** Aniisa Bihi (draft by Claude Opus 5)
- **Affects:** `kitchen/src/indicators/**`, `kitchen/src/similar/build.ts`
- **Related:** [Plan 14](../plans/2026-09-18-14-indicators-become-definitions.md), [fourth slice design](../plans/2026-09-17-fourth-slice-design.md), supersedes part of [0002](0002-similarity-metric.md)

## Context

An indicator was a hand-written module: 153 lines for the simplest, 696 for the three in
`derived.ts`. Ten of them took a whole plan. The fourth slice adds fifteen more.

Reading all nine modules first showed they had more in common than the slice design assumed. Every
one builds the same shape of selection — region filtered to the 290 four-digit codes, each other
dimension totalled or given explicit values, the content code resolved by its stable Swedish
label, and the years. What genuinely differs is which dimensions are totalled, whether values are
explicit, how many tables are stitched, and what derives from what.

## Decision

**D1 — An indicator is a declaration; a builder is code.** Nine of the ten now declare a table, a
content label, a per-dimension rule and a year range. Three builders cover them: `direct`, `ratio`
(a count over another indicator's series, times a factor) and `share` (one fetch partitioned by a
dimension). Two modifiers: inflation adjustment and a minimum case count.

**D2 — Builders arrived with the indicator that needed them, not in advance.** The plan called for
writing five builders and then migrating. Writing them first would have been five guesses at what
the migration needed; this way each was proven by the byte-identical pantry the moment it existed.
Two of the five were never needed: `change` has one user that is not a definition (D5), and
`difference` is not written until plan 15 has something to difference.

**D3 — `TOTAL_CODES` and `SUM_SAFE` did not move and did not soften.** They are the difference
between a correct total and one that overcounts by a multiple. A declarative format that made
summing the default would be a worse pipeline with less code.

**D4 — Definitions are functions, not constants.** `CKM_FROM` lives in `population.ts`, which other
indicator modules import from and which imports back. Reading it at module-load time to build a
definition object races that cycle, and `registry.load-order.test.ts` caught it within minutes of
the first attempt. Evaluating at build time removes the hazard for the fifteen plan 15 adds too.

**D5 — `population-change` stays hand-written, deliberately.** It reads population's series,
propagates four statuses through a year-over-year comparison, and applies the structural-break rule
for the years a municipality split. A generic builder for it would have one user and a pile of
special cases, which is the speculative generality this project's own rules warn against. Nine of
ten is the honest outcome, not a shortfall.

**D6 — Similarity names its ten.** `buildSimilar` takes an explicit core set, defaulting to the ten
decision 0002 measured, and refuses an indicator it cannot find rather than measuring over nine.
It is a parameter rather than a constant so a fabricated test pantry can still exercise the guards.

**D7 — The old modules' dead code is NOT deleted here.** See Consequences.

## Motivation (why)

An indicator is now a declaration of **7 to 30 lines, mean 19**, against modules of 153 to 696.
The shared builders are 492 lines, written once.

|                                                         |                                              |
| ------------------------------------------------------- | -------------------------------------------- |
| `public/pantry/` after every one of the nine migrations | **byte-identical**                           |
| `data/similar.json` after pinning the core set          | **byte-identical**                           |
| Declaration size                                        | 7–30 lines, mean 19                          |
| Shared builder code                                     | 492 lines (`define.ts` 274, `source.ts` 218) |
| Unit tests                                              | 1,236, from 1,218                            |

## Alternatives considered

- **Generate the prose too.** `description`, `caveat` and `derivation` are what a reader checks a
  published figure against. Generating them from the declaration would produce something true and
  unreadable.
- **One builder with options rather than three.** The three do genuinely different arithmetic, and
  a single function taking a shape flag is three functions wearing one name.
- **Force `population-change` into a builder.** See D5.

## Consequences

- Adding an indicator is now a declaration plus its prose and its tests, rather than a module.
- **The old per-indicator builders and selection helpers are still in the tree, unused.** Twenty-
  seven functions with no production caller, and roughly 190 test assertions against them. Deleting
  them is worth doing and was deliberately not done in the same change as the migration: this
  change's entire claim is "nothing moved", and burying that proof under a 1,500-line deletion
  would make it unreviewable. Until they go, each indicator has two implementations and only one of
  them runs — recorded here as a known cost, with its own follow-up.
- **The frozen-response layer caught a real bug.** Selecting "ages 65 and over" as "every code
  whose leading digits reach 65" swept in TAB5557's aggregate bands — `65-69`, `70-74`, `90-99` —
  alongside the single ages, which would have counted the same people twice and published a share
  far too high. The selection no longer matched anything ever fetched, so `publish` refused. The
  rule now says what it means: single years of age from 65 up, plus the open-ended top band named
  per table, because TAB638 calls it `100+` and TAB5557 calls it `100+1` and that disagreement is
  data rather than something to be clever about.
- **Writing the core-set test found a second defect.** Neighbours were already unchanged by an
  extra indicator, but the published method description still enumerated every indicator in the
  pantry, so `data/similar.json` would have claimed to measure over one it never looked at.
- One existing test changed: `population.test.ts` pinned the provenance array to five fixed
  positions, and only the English metadata's position moved. It now asserts what ruling R2 needs —
  every response recorded, data before metadata — because the manifest is byte-identical across the
  change and the positions were an implementation detail the published file does not depend on.
