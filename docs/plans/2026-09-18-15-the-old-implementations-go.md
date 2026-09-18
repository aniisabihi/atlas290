# Plan 15 — The old implementations go

> Closes [#28](https://github.com/aniisabihi/atlas290/issues/28). Fourth slice, between
> [plan 14](2026-09-18-14-indicators-become-definitions.md) and the fifteen.
> Source: [fourth slice design](2026-09-17-fourth-slice-design.md) §3.1,
> [ADR-0014](../decisions/0014-indicators-become-definitions.md) D7 and its Consequences.

## Why now, and not with plan 14

Plan 14's whole claim was that nothing moved: `public/pantry/` byte-identical after every one of
the nine migrations. A 1,500-line deletion in that diff would have buried the proof. It is now its
own reviewable unit, and it has to land **before** the fifteen: plan 16 adds indicators with
nothing to be byte-identical to, so whatever net survives this plan is the net those fifteen
inherit.

## What is actually dead, measured

Counted on `feat/old-implementations-go` at `cc35729`, by grepping every exported function under
`kitchen/src/indicators/` for a caller outside its own defining module.

| Group                 | Count | Production callers | Test references |
| --------------------- | ----: | ------------------ | --------------- |
| `fetch*` entry points |     8 | none               | **none at all** |
| `*Selection` helpers  |    10 | none               | ~45 assertions  |
| `build*Series`        |     8 | none               | ~55 assertions  |

Baseline: **3,753** non-test lines and **3,622** test lines under `kitchen/src/indicators/`;
**1,236** unit tests across 86 files; `public/pantry/` as committed at `cc35729`.

## The decision this plan executes

Option **B** of four put to the architect on 2026-09-18, plus the `fetch*` deletion as a separate
first commit. Delete the code; **re-home the assertions that encode real Statistics Sweden
semantics** against the published pantry, in the style
[`src/indicators.headline.test.ts`](../../src/indicators.headline.test.ts) already uses; drop the
assertions that `source.test.ts` and `define.test.ts` now cover generically.

The three options not taken, and why:

- **Delete everything including the tests.** Loses the extremes and the edge cells — Solna's 1990
  price resting on two sales, Knivsta's perturbation year, Filipstad as the real lowest
  post-secondary share. Cheapest, and the loss would not show up until an SCB table changed shape.
- **Retarget all 129 tests onto the definitions.** Loses nothing and costs the most, and re-homes a
  large number of selection-shape assertions that `source.test.ts` now duplicates generically.
- **Keep the dead code as an equivalence oracle until after the fifteen.** Buys nothing plan 14 did
  not already prove byte-identically, and carries two implementations of every indicator through
  the slice that adds fifteen more.

**The honest limit of what this plan leaves behind**, stated here so the ADR is not the first place
it appears: a test that builds an indicator from its definition and compares it to the published
pantry proves the definition has not _drifted_. It cannot prove a definition was right to begin
with, because the pantry is generated from that same definition. The non-circular part is Task 3 —
figures that were derived independently (hand-summed from a frozen chunk, or spot-checked against
the live SCB API on 2026-09-14) and are now pinned. Those are the ones worth carrying, and that is
the entire reason this plan is option B rather than option A.

## Tasks

Sequential. Each is its own commit, and every one of them re-runs the determinism gate, because a
deletion that changes a published byte is the exact failure this plan must not have.

---

### Task 1 — The fetch entry points go

**Source:** #28, "Standalone fetch entry points with no caller at all, not even a test".

Delete `fetchDensity`, `fetchEducation`, `fetchHousing`, `fetchIncome`, `fetchMeanAge`,
`fetchMigration`, `fetchShare65Plus`, `fetchTax`, and the doc-comments in sibling modules that
name them (the only remaining references, all prose).

`fetchPopulation` **stays** — it has 8 live test references and is a separate question, explicitly
out of scope for #28.

**Acceptance criteria**

- [ ] The 8 functions are gone; `grep -rn '\bfetchDensity\b' kitchen src shared tools` and the
      seven siblings return nothing.
- [ ] `fetchPopulation` is untouched.
- [ ] Test count is unchanged at 1,236 — this deletion removes no test.

**Verification**

```bash
yarn typecheck && yarn lint && yarn test
yarn kitchen publish && git diff --exit-code public/pantry/
```

---

### Task 2 — Every definition is proven against the published series

**Source:** the net that has to exist before Task 5 removes the old one.

`define.test.ts` proves exactly one indicator today (`tax-rate`). Parameterise it over **all nine**
definitions: built from its declaration, each must equal the published series **value for value and
status byte for status byte**.

TDD order applies (`kitchen/src/indicators/**` is highest-stakes, `workflow-config.md`). The test
will pass the moment it is written — that is what plan 14 proved — so the failing signal has to be
manufactured deliberately:

1. Write the parameterised test. Confirm green.
2. **Perturb one definition** (change a year bound, drop a dimension rule), confirm the test goes
   red and names that indicator, revert.
3. Record which perturbation was used, in the commit message.

Without step 2 this test would be assertion-shaped and prove nothing.

**Acceptance criteria**

- [ ] All nine definitions are covered by name, not by a loop over whatever happens to be exported.
- [ ] Status bytes are compared, not only values.
- [ ] A deliberate perturbation of one definition turns it red, and the failure names the
      indicator.

**Verification**

```bash
yarn test kitchen/src/indicators/define.test.ts
```

---

### Task 3 — The real figures move to the published pantry

**Source:** the ~28 independently-derived assertions in the seven old test files.

Create **`src/indicators.semantics.test.ts`**, a sibling to `indicators.headline.test.ts`, reading
`publishedPantry` the same way. `indicators.headline.test.ts` is **not** modified: it keeps
coverage, exact cell counts and one real value per indicator. The new file takes what that file
deliberately does not carry — the extremes, the edge cells, and the per-table status semantics:

| Moving                                               | From                |
| ---------------------------------------------------- | ------------------- |
| Borgholm oldest / Knivsta youngest mean age, 2025    | `derived.test.ts`   |
| Stockholm's 2024 65+ share, hand-summed              | `derived.test.ts`   |
| Borgholm's 2024 65+ share; Knivsta's split cross-tab | `derived.test.ts`   |
| Danderyd and Åsele 1990 house prices, adjusted       | `housing.test.ts`   |
| Solna 1990 nulled, `too-few-cases`, on 2 sales       | `housing.test.ts`   |
| Danderyd and Högsby 1999 incomes, adjusted           | `income.test.ts`    |
| Danderyd / Lund / Filipstad 2024 education shares    | `education.test.ts` |
| The 2024 national aggregate cross-check              | `education.test.ts` |
| Knivsta and Pajala net-migration rates               | `migration.test.ts` |
| Borås read as not-yet-published before 1997          | `migration.test.ts` |
| Stockholm and Arjeplog 2024 densities; land areas    | `density.test.ts`   |
| Stockholm and Arjeplog tax rates                     | `tax.test.ts`       |
| "no perturbed status anywhere" per no-CKM table      | five files          |
| Knivsta's 2025 perturbation where there is one       | `density.test.ts`   |

**Every expected figure is re-read off the committed `public/pantry/` before it is written into the
new file.** Not one is carried across from the old test on trust. This is the rule
`indicators.headline.test.ts` states about itself, and the reason plan 13 caught a wrong recalled
population figure.

**Acceptance criteria**

- [ ] The new file asserts against `publishedPantry` only — no kitchen internals, no frozen
      responses, no imports from `kitchen/`.
- [ ] Every figure traced to the committed pantry, with the source file and cell named in the test
      or its comment.
- [ ] Editing any single expected value turns the file red (spot-checked on three).

**Verification**

```bash
yarn test src/indicators.semantics.test.ts
```

---

### Task 4 — The guards keep a home

**Source:** the throw-assertions scattered through the seven files.

`source.test.ts` currently uses `taxSelection` as its oracle — a function Task 5 deletes. Rewrite
that test to assert the selection's shape directly.

Then, for each guard the old files assert, either point at the generic test that already covers it
or move it:

- label drift on `ContentsCode` → `source.test.ts`, covered.
- `SUM_SAFE` refusal, naming the dimension → `source.test.ts`, covered.
- a missing age/income-class total, naming the dimension → check; move if not covered.
- the CPI-missing-year throw and the empty-index guard → `cpi.test.ts`, check both.
- `UtbildningsNiva` level missing → the `share` builder in `define.test.ts`; move.

**Acceptance criteria**

- [ ] `source.test.ts` imports nothing that Task 5 deletes.
- [ ] Every guard in the old files is either demonstrably covered elsewhere (named in this plan's
      verification block) or moved.

---

### Task 5 — Delete

**Source:** #28.

Remove the 10 `*Selection` helpers, the 8 `build*Series` functions, and everything under
`kitchen/src/indicators/{tax,density,income,housing,education,migration,derived}.test.ts` that
exercised them. Modules keep their definition, their constants, their prose and their
`Indicator` record.

**Acceptance criteria**

- [ ] No exported function under `kitchen/src/indicators/` lacks a caller, except `fetchPopulation`
      (out of scope, #28) and the definitions themselves.
- [ ] `public/pantry/` **byte-identical**.
- [ ] `data/similar.json` byte-identical.
- [ ] Test count recorded against the 1,236 baseline, and any net loss stated with what was lost.
- [ ] Line count under `kitchen/src/indicators/` recorded against the 3,753 baseline.

**Verification**

```bash
yarn typecheck && yarn lint && yarn test && yarn build
yarn kitchen publish && git diff --exit-code public/pantry/
```

---

### Task 6 — The record

- ADR-0015, and a row in `docs/decisions/README.md`.
- This plan's measurement table filled in.
- `docs/kitchen.md`: the "what an indicator is" section stops describing two implementations.
- The fourth-slice design's plan-order table, which still says 12/13/14 for what shipped as
  13/14 and is now 15/16.
- #28 closed by this PR (`Closes #28`, on its own line, PR targets `main`).

---

## Measurements

| Gate                                        | Target                     | Result                                        |
| ------------------------------------------- | -------------------------- | --------------------------------------------- |
| `public/pantry/` after every task           | byte-identical             | **byte-identical**, all five                  |
| `data/similar.json`                         | byte-identical             | **byte-identical**                            |
| Non-test lines under `indicators/`          | well below 3,753           | **2,651**; the nine modules themselves halved |
| Test lines under `indicators/`              | down, with the loss stated | **2,302**, from 3,622                         |
| Unit tests                                  | stated against 1,236       | **1,204** — see below                         |
| Definitions proven against published series | 9 of 9                     | **9 of 9**                                    |
| Browser tests                               | no loss                    | **283 passed, 0 failed**, no retry needed     |

**The test count fell by 32 net, and that is the whole point of the change rather than a
shortfall.** 129 assertions exercised the dead code. 28 moved to the published pantry, ~30 were
retargeted at the declarations, and the rest were selection-shape claims `source.test.ts` now
makes once instead of seven times. Against them, 28 new pantry tests, 8 new definition tests and 3
new resolver guards. What was lost is duplication; what was kept is in `src/` and
`kitchen/src/indicators/source.test.ts`, named in [ADR-0015](../decisions/0015-the-old-implementations-go.md).

| Module         | Before |   After |
| -------------- | -----: | ------: |
| `tax.ts`       |    164 |  **73** |
| `migration.ts` |    300 | **112** |
| `income.ts`    |    260 | **118** |
| `density.ts`   |    237 | **160** |
| `housing.ts`   |    401 | **194** |
| `education.ts` |    349 | **209** |
| `derived.ts`   |    711 | **440** |

**One task exceeded its own scope, deliberately.** Task 4 was meant to find each guard a home. It
found instead that `validateLevels` had no home at all: plan 14 left it inside the dead
`educationSelection`, so `post-secondary-education` had been published without its codelist check
ever since. That is a defect in the live path rather than a test-coverage question, so it was
fixed here — `Source.verify` — rather than filed. Recorded in
[ADR-0015](../decisions/0015-the-old-implementations-go.md) D5.

**One stop condition nearly fired and did not.** Every one of the 28 re-read figures agreed with
the old test's expectation at published precision, so nothing had to be reported unresolved.

## Stop conditions

- The pantry is not byte-identical after a deletion → stop. That means something deleted was live.
- A figure re-read from the pantry disagrees with the old test's expected value → **stop and
  report**. One of the two is wrong and that is a finding, not a merge conflict to resolve by
  picking a side.
- A guard in Task 4 turns out to be covered nowhere and cannot be moved cheaply → keep the old
  test file for that guard alone, and say so.

## Not in this plan

- `fetchPopulation` and its 8 test references. #28 scopes it out explicitly.
- `population-change`, which is not a definition and is not dead ([ADR-0014](../decisions/0014-indicators-become-definitions.md) D5).
- Any new indicator. That is plan 16.
