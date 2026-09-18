# ADR-0013: The pantry splits

- **Status:** Accepted | **Date:** 2026-09-18
- **Decided by:** Aniisa Bihi (draft by Claude Opus 5)
- **Affects:** `shared/pantry.ts`, `kitchen/src/publish.ts`, `src/data/pantry.ts`, `src/data/select.ts`, `src/components/App.tsx`, `tools/`, `public/pantry/data/`
- **Related:** [Plan 13](../plans/2026-09-17-13-the-pantry-splits.md), [fourth slice design](../plans/2026-09-17-fourth-slice-design.md)

## Context

The site fetched `public/pantry/data/indicators.json` — 1,045,616 bytes, 272,475 gzipped, every
cell of all ten indicators — before React rendered anything, for an opening view that draws one
indicator. At the twenty-five indicators the fourth slice plans, the same path would be roughly
690 kB before first paint.

## Decision

Six decisions, taken while building Plan 13.

**D1 — An index, plus one file per indicator.** `data/index.json` carries the municipalities, the
price index and every indicator's metadata. `data/indicators/<id>.json` carries one indicator in
full and its series. Nothing else moves.

**D2 — Prose lives in the per-indicator file.** `description`, `caveat`, `derivation` and `sources`
are read by `AboutIndicator` alone, for the indicator already on screen. `IndicatorMeta` is derived
from the indicator's fields with `.omit()` rather than restated, so a field added later cannot be
forgotten in the index.

**D3 — `data/indicators.json` is deleted, not kept as a compatibility copy.** It is a generated
file, documented as regenerable, not a published interface. Before deleting it, the eleven files
were verified to reassemble to an object equal to it.

**D4 — There are two pantry shapes, not one.** This was not in the plan. The site cannot hold a
`PantryData` once series load lazily, because an indicator whose file has not arrived has no prose
to put in one. `PantryView` is that shape: every indicator's metadata, and the series fetched so
far. A `PantryData` is structurally a valid `PantryView`, so the kitchen, the build-time tools and
every test that holds a whole pantry need no second code path.

**D5 — The year axis comes from declared coverage, not from loaded series.** Also not in the plan,
and the one defect that would have shipped silently: `metaFrom` derived the slider's span from
whatever series were loaded, so a partial pantry would have given the slider a different length
depending on which indicator a visitor arrived on. Verified first that `coverage` equals the
series' own first and last year for all ten indicators, so this reads the same numbers off a
different field.

**D6 — An indicator still in flight is not an indicator with no value.** `ProfilePanel` and
`compareOf` walk every indicator and now ask `lk.hasSeries` first. For the comparison this is a
correctness point rather than a crash guard: counting an unfetched indicator would inflate "higher
on 7 of the 8 we could compare" with an unknown.

## Motivation (why)

Measured on the real published output, gzip -9 throughout:

|                                            | gzipped |
| ------------------------------------------ | ------- |
| The single file, blocking first paint      | 272,475 |
| The index, ten indicators                  | 6,433   |
| Opening view (index + `population-change`) | 35,301  |
| The ten indicator files, summed            | 272,879 |

The split costs 404 bytes in total and saves 237,174 before first paint. The index barely grows
with the indicator count — 6,433 at ten, 6,524 extrapolated to twenty-five — because the 290
municipalities dominate it, so this holds as the fourth slice adds indicators.

## Alternatives considered

- **Keep one file and compress harder.** The bytes are data, not formatting; the file was already
  minified and rounded to each unit's honest precision in Plan 2.
- **Split by municipality instead of by indicator.** Right for the profile, wrong for the map,
  which needs one indicator across all 290. It is the answer to the profile's remaining cost, under
  Consequences, and is deferred rather than rejected.
- **Load every series in the background after first paint.** Moves the bytes rather than removing
  them, and makes what a visitor waits for depend on timing rather than on what they asked for.

## Consequences

- First paint drops from 272,475 to about 35,301 gzipped bytes.
- **The profile's cost moved rather than disappeared.** Opening a profile needs every series, so it
  now fetches what is missing on open: unchanged at ten indicators, and roughly 690 kB at
  twenty-five. The answer is a second axis — `data/places/<code>.json`, one municipality across all
  indicators — and it is deliberately not in this plan. Plan 15 decides it.
- While a newly chosen indicator is in flight the map keeps the previous one on screen. This site
  has no visual language for a map that is loading, and inventing one was out of scope.
- Out-of-order responses need no guard, which is a property of the design rather than luck: an
  arriving series is added under its own id and never replaces the one being drawn, and what is
  drawn is chosen by the URL.
- Two implementations of one ordering rule now exist, because the build-time tools are plain
  JavaScript and cannot import the kitchen's TypeScript. `tools/read-pantry.test.ts` holds them
  together by asserting they agree on the real pantry.
- The 290 preview cards come out byte-identical, which is an end-to-end proof that the split lost
  nothing: they are drawn from the reassembled data and were generated from the single file.
