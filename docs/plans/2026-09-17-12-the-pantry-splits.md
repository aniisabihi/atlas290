# Plan 12: The pantry splits

The first plan of [the third slice](2026-09-17-third-slice-design.md), and the one that ships on
its own. It adds no indicator, changes no number and alters nothing a visitor can see. It changes
how the data arrives, so that the fifteen indicators in plan 14 can arrive at all.

Source: [third slice design](2026-09-17-third-slice-design.md) §3.2. Architect's ruling, 2026-09-17:
the split ships ahead of any new indicator, as its own plan and its own pull request.

## What was checked before this was written

Everything measured against the working tree at `43bbd62`.

| Checked                                    | Found                                                                                                                                                                                                                                                    |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What first paint costs today               | `public/pantry/data/indicators.json` is 1,045,616 bytes raw, **275,842 gzipped**, fetched eagerly by `loadPantry()` before React renders anything (`src/main.tsx:7`). All 125,860 cells, for an opening view that draws one indicator.                   |
| What a slim index would cost               | id, name, unit, scale, coverage and the price fields, plus municipalities and the price index: **31,327 raw / 6,471 gzipped** at ten indicators, and **35,412 / 6,524 at twenty-five**. It barely grows, because municipalities (5,217 gz) dominate it.  |
| What each indicator costs on its own       | 6,128 gz (`tax-rate`, 27 years) to 49,092 gz (`house-prices`, 45 years). The ten sum to **272,697 gz** — within 1% of today's single file, so splitting costs nothing in total bytes.                                                                    |
| What the opening view would then cost      | Index plus `population-change` = 6,471 + 28,851 = **35,322 gz**, against 275,842 today. An **87% reduction** in blocking bytes before first paint.                                                                                                       |
| Who reads the file directly                | **40 files**: 34 unit tests, 3 kitchen tests, and `tools/build-pages.mjs`, `tools/build-cards.mjs`, `tools/build-fonts.mjs`. The tools run in Node at build time and legitimately need everything; the tests use it as a fixture.                        |
| How the site reads the pantry              | `lookup(data)` in `src/data/select.ts` is documented as "the only place that knows the pantry's columnar layout" and "built once per load". `App` memoises it on `data` identity, because `ranksFor` caches into a `WeakMap` keyed on the Lookup object. |
| Who needs every series at once             | `ProfilePanel` renders a row and a sparkline per indicator (`ProfilePanel.tsx:100`), and `ComparePanel` does the same for two municipalities. Nothing else does: the map, legend, table twin and live region all read one indicator.                     |
| How determinism is enforced                | `writePantryFile()` runs each value through its schema then `stableStringify` (sorted keys, trailing newline) per file. The mechanism is already per-file, so more files needs no new machinery.                                                         |
| What is computed from the assembled object | `buildSimilar(published)` and the facts build both take the whole `PantryData` inside `publish()`. That object still exists in the kitchen after the split; only what is written to disk changes.                                                        |

## The decisions this plan makes

**D1 — Three files where there was one, split by indicator.**

- `data/index.json` — schema version, municipalities, price index, and the **non-prose** fields of
  every indicator: id, name, unit, scale, coverage, `priceBasis`, `priceBasisYear`,
  `publishedStep`, `minCount`, `sensitivity`.
- `data/indicators/<id>.json` — the full `Indicator` including `description`, `caveat`,
  `derivation` and `sources`, plus its `IndicatorSeries`.
- Nothing else moves. `geometry/`, `layout/`, `similar.json`, `facts.json` and `manifest.json`
  are untouched.

Prose lives in the per-indicator file rather than the index because only `AboutIndicator` reads it,
and only for the indicator already chosen. That is what keeps the index flat at 6.5 kB from ten
indicators to twenty-five.

**D2 — `data/indicators.json` is removed, not kept as a compatibility copy.**
It is a generated file the project documents as regenerable (`CLAUDE.md`: "Generated, committed,
never hand-edited"), not a published interface. Keeping it would double the committed data and
leave two sources of truth for the determinism gate to police. Any reader who wants the whole
dataset can still assemble it from the parts, and `docs/kitchen.md` will say how.

**D3 — The data object grows; it is never mutated.**
`loadPantry()` returns index plus whichever series are loaded. When a series arrives, the site
builds a **new** data object and re-renders; `App`'s `useMemo` on identity then rebuilds `lookup`
exactly once, which is the behaviour its docstring already promises. This respects the repo's
immutability rule and needs no change to `select.ts`'s internals.

**D4 — The profile loads what it is missing, and the cliff is measured rather than hidden.**
Opening a profile needs every series. Today that cost is paid before first paint; after this plan
it is paid on profile open, and it is the same 272,697 gz. That is not a regression, and it is not
a solution either: at twenty-five indicators it becomes ~690 kB.

The answer is a second axis — `data/places/<code>.json`, one municipality across all indicators,
a few kB each, which is the natural shape for a panel that is per-municipality. It is **not in this
plan**, because at ten indicators it optimises a cost the site already pays, and it means
refactoring `ProfilePanel`, `ComparePanel` and `ProfileStory` onto a different accessor — front-end
work inside a plan that is otherwise about delivery. Plan 14 decides it, with the numbers this plan
records.

**D5 — Tests read the pantry through one helper.**
A single `src/test/pantry.ts` assembles a full `PantryData` from the split files, so the 37 test
files change an import line and nothing else. The helper is test-only and never ships.

## What this plan does not do

- Adds no indicator, changes no published value, touches no builder.
- Does not change `Indicator`, `IndicatorSeries`, `OBSERVATION_STATUS` or `Municipality`. The
  container schema changes; **every value semantic is untouched**, including the append-only status
  enum whose index is a persisted byte.
- Does not touch the picker, the profile's design, the facts engine or similarity.
- Does not build `data/places/` (D4).

## Tasks

Sequential. Each ends with the suite green.

### Task 1 — The split schemas

Add to `shared/pantry.ts`, beside `PantryData` rather than replacing its parts:

- `PantryIndex` — schemaVersion, municipalities, `IndicatorMeta[]`, priceIndex.
- `IndicatorMeta` — `Indicator` minus `description`, `caveat`, `derivation`, `sources`. Derived
  from the existing schema with `.omit()`, so a field added to `Indicator` cannot be forgotten here.
- `PantryIndicator` — `{ indicator: Indicator, series: IndicatorSeries }`.
- A function that assembles `PantryData` from a `PantryIndex` and a list of `PantryIndicator`, and
  the cross-checks `PantryData.superRefine` already makes (row count equals municipality count,
  every series has an indicator, every `priceBasisYear` is covered) applied per part.

**Acceptance:** `PantryData` still parses today's published file unchanged. Assembling from parts
and re-parsing gives a deep-equal object. Round-trip is proven by a test, not by inspection.
**Verify:** `yarn test kitchen`, `yarn typecheck`.
**TDD:** `shared/pantry.ts` is highest-stakes per `workflow-config.md`. Tests first, no exceptions.

### Task 2 — The kitchen writes the parts

`publish()` keeps assembling the full `PantryData` in memory — `buildSimilar()` and the facts build
both need it — and changes only what it writes: `data/index.json` plus one
`data/indicators/<id>.json` per indicator, each through `writePantryFile` as today. Delete the
write of `data/indicators.json`.

**Acceptance:** A published pantry contains `data/index.json` and ten indicator files and no
`data/indicators.json`. Reassembling the parts yields a `PantryData` deep-equal to what the old
single file contained at `43bbd62` — this is the byte-level proof that nothing changed but the
packaging. Publishing twice is byte-identical.
**Verify:** `yarn kitchen publish && git diff --stat public/pantry/` shows only the expected
adds and the one delete; `yarn kitchen publish` again shows nothing.

### Task 3 — One helper for every test fixture

Add `src/test/pantry.ts` exposing the assembled `PantryData`, reading the split files from disk.
Move all 37 test files onto it.

**Acceptance:** No test imports `public/pantry/data/indicators.json`. Both vitest projects green,
with the same test count as before.
**Verify:** `yarn test`; `grep -r "pantry/data/indicators.json" src shared kitchen` returns only
the helper.

### Task 4 — The loader fetches the index first

`loadPantry()` fetches the index, geometry, adjacency, bubbles, similar and facts, then the series
for the indicator the URL asks for — `metaFrom`/`parse` in `src/state/url.ts` already reads that
from the address bar without needing the data. It returns a data object carrying every indicator's
metadata and the one loaded series.

**Acceptance:** A cold load of `/sv/?i=population-change&y=2025` issues exactly one request under
`data/indicators/`. A malformed part still fails loudly with the file named, as today.
**Verify:** `yarn test site`; a network assertion in the browser suite.

### Task 5 — Changing indicator fetches its series

A small loader hook: when the chosen indicator has no series, fetch it, then re-render with a new
data object (D3). While it is in flight, the map keeps the previous indicator on screen rather than
blanking — a state the site already has no visual language for, and inventing one is not this
plan's job.

**Acceptance:** Switching indicators draws the new one. Switching back issues no second request.
Rapidly switching A→B→A settles on A, with no stale render from a late response. Keyboard focus and
the live region behave as before.
**Verify:** `yarn e2e` across three engines, including an out-of-order-response test.
**Risk:** this is the one task that can break behaviour rather than plumbing. It gets the most
browser coverage.

### Task 6 — The profile loads what it is missing

`ProfilePanel`, `ComparePanel` and `ProfileStory` need every series. On open, request the ones not
yet loaded, in parallel, and render when they land.

**Acceptance:** Opening a profile cold shows every indicator's row and sparkline. Opening a second
profile issues no further requests. Deep-linking straight to `?m=…` works on a cold load.
**Verify:** `yarn e2e`; record the transferred bytes on profile open for the plan's measurement
table.

### Task 7 — The build-time tools read the parts

`tools/build-pages.mjs` (580 pages), `tools/build-cards.mjs` (290 cards) and `tools/build-fonts.mjs`
(character sampling for the subset) each read everything. Point them at a shared Node-side reader
that assembles from the parts.

**Acceptance:** `yarn build` writes the same 580 pages as before, byte-identical. `yarn cards`
leaves `public/share/` byte-identical. The font subset covers the same character set.
**Verify:** `yarn build && git status --short` clean; `yarn cards && git diff --stat public/share/`
empty.

### Task 8 — Prove it, then write it down

Measure, then update `docs/kitchen.md` (the pantry layout and how to reassemble it),
`docs/architecture.md` (the data contract section), `docs/codebase.md` (the new helper and hook),
and `CLAUDE.md` if the generated-files list changes wording. Run the **writing-documentation**
skill, per the pre-PR checklist.

**Acceptance:** The measurement table below is filled with real numbers. A decision record is
written for D1, D2 and D4 — D4 especially, because it records a cost knowingly deferred.
**Verify:** `yarn typecheck && yarn lint && yarn test && yarn build && yarn e2e`; `yarn budget`.

## Verification, in one line each

| Task | Signal                                                                                  |
| ---- | --------------------------------------------------------------------------------------- |
| 1    | Assemble-from-parts is deep-equal to the published file; `PantryData` unchanged         |
| 2    | Parts reassemble to the pantry at `43bbd62`; second publish byte-identical              |
| 3    | No test imports `indicators.json`; test count unchanged                                 |
| 4    | Cold load issues exactly one `data/indicators/` request                                 |
| 5    | Indicator switch draws; A→B→A settles on A; no stale render; e2e green on three engines |
| 6    | Profile cold-open renders every row; second profile issues no request                   |
| 7    | 580 pages, 290 cards and the font subset all byte-identical                             |
| 8    | Budget within limits; docs updated; decisions recorded                                  |

## What must be measured when it is done

| Gate                                 | Target                         | Result |
| ------------------------------------ | ------------------------------ | ------ |
| Index, gzipped                       | ≤ 8,000 bytes                  |        |
| Blocking bytes before first paint    | ≤ 40,000 gz (from 275,842)     |        |
| Sum of all parts, gzipped            | within 2% of 275,842           |        |
| Transferred bytes on profile open    | record it — this is D4's cliff |        |
| Lighthouse, median of three          | within the existing budget     |        |
| Unit tests / browser tests           | no loss against 1,176 / 280    |        |
| `public/pantry/` second publish      | byte-identical                 |        |
| `dist/` pages, `public/share/` cards | byte-identical                 |        |

## Stop conditions

Per the workflow's unattended rules, and one specific to this plan: **if task 5 fails verification
three times, stop.** A race between the URL and an in-flight fetch is exactly the kind of defect
that looks fixed and is not, and the honest fallback — loading every series up front, as today,
while keeping the split for the tools and for plan 14 — is available and loses only the first-paint
win.
