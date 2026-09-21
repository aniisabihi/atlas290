# ADR-0019: The view is built once

- **Status:** Accepted | **Date:** 2026-09-21
- **Decided by:** Aniisa Bihi (draft by Claude Opus 5)
- **Affects:** `shared/pantry.ts`, `tools/lighthouse-budget.mjs`, `.github/workflows/ci.yml`
- **Related:** [Issue #35](https://github.com/aniisabihi/atlas290/issues/35),
  [Plan 18](../plans/2026-09-21-18-the-view-is-built-once.md),
  [0013](0013-the-pantry-splits.md)

## Context

A municipality page scored **68** against a floor of 72, having scored 86 at ten indicators and
82 at twenty-seven. Nothing went red, because nothing was measuring that page.

[0013](0013-the-pantry-splits.md) predicted the cause exactly and deferred it:

> Rebuilding the view on each arrival is quadratic, and measured rather than assumed. […] At
> twenty-five it is roughly six times the work, so plan 15 should either validate each part once
> on arrival instead of re-parsing the view, or adopt the per-municipality file that removes the
> profile's need for every series at all.

Plan 15 was the deletion of the old indicator implementations and did neither. Nobody re-measured
until plan 17, two slices later.

## Decision

**D1 — `viewOf` stops re-validating what it was handed.** `index` came out of
`PantryIndex.parse` and every part out of `PantryIndicator.parse`, both at the fetch boundary
where the bytes were untrusted. `viewOf` now assembles the object directly and runs only
`checkPantryCrossReferences`, which is the single thing `PantryView.parse` was doing that the
inputs' own parses had not already done. It is O(series); the parse was O(cells), once per
arrival, cumulatively.

**D2 — Validation belongs at the boundary, and this is now written down.** Stated as a rule in
[architecture.md](../architecture.md#schema-evolution) rather than left as a property of one
function, because the next person to add a derived view will face the same choice.

**D3 — The assembled view shares `municipalities`, `indicators` and `priceIndex` with the index**
rather than deep-copying them, which is what `parse` returned. Nothing in this project mutates
published data, and copying 290 municipalities per arrival was part of the cost.

**D4 — The 580 municipality pages join the performance budget, in the same change as the fix and
not before.** A gate on a page that is already failing blocks every unrelated pull request, so
the order matters. `yarn budget` now defaults to two URLs — the root and `/en/stockholm-0180/` —
and CI passes no URL at all, so nobody has to remember.

**D5 — One floor for both pages, not two.** After the fix the municipality page measures 90, 92,
95 against the root's 91, 92, 91 on the same machine. They are no longer distinguishable, so a
second number would invent a precision the measurements do not support. 72 stays, for the reasons
[0008](0008-headers-and-discoverability.md) gives.

**D6 — Neither of 0013's two options was taken whole.** The per-municipality file would also cut
the 49 requests, and it is a change to the published shape. It is not needed: see Consequences.

## Motivation (why)

Same machine, same preview server, `/en/stockholm-0180/` built the way CI builds it, median of 3.

|                                   |              Before |               After |
| --------------------------------- | ------------------: | ------------------: |
| Lighthouse performance            | **68** (63, 68, 68) | **92** (90, 92, 95) |
| Total blocking time               |            3,850 ms |              150 ms |
| Main-thread work                  |               4.9 s |               1.0 s |
| of which script evaluation        |            4,437 ms |              678 ms |
| Long tasks over 50 ms             |                   5 |                   1 |
| Time to interactive               |               6.4 s |               2.4 s |
| `bench-view.ts`, one profile open |        **1,023 ms** |            **1 ms** |
| Requests                          |                  48 |                  48 |
| Root page performance             |                  91 |                  91 |

## Alternatives considered

- **A per-municipality pantry file** — 0013's second suggestion, which would also cut the request
  count from 48. Rejected for now: the cheaper change put the page at 92 with twenty points of
  headroom, and this one adds 290 published files and a new shape to the contract. It stays
  available if stage B's seven indicators eat that headroom.
- **Batching arrivals so the view rebuilds once rather than thirty-five times.** The profile says
  React is ~150 ms of a 4.9 s page. It would have been work aimed at something that is not a
  problem.
- **Keeping the parse and accepting the cost.** It is quadratic in the indicator count and the
  next slice adds seven more.

## Consequences

- **The issue's two named suspects were both wrong, and profiling is why we know.** #35 offered
  the rank `WeakMap` being discarded per arrival, and 35 sparklines rendered 35 times, as
  plausible mechanisms read out of the code. A CPU profile of the real page at 4× throttling —
  the rate Lighthouse applies — shows **neither appearing at all**. Zod accounted for ~3,700 ms of
  ~4,900 ms of non-idle main thread; React, including every sparkline, for ~150 ms.

- **The "unattributed 2.9 s" never existed.** The issue subtracted `bench-view.ts`'s 1,023 ms from
  Lighthouse's 3,940 ms and called the remainder undiagnosed. The benchmark runs unthrottled in
  Node and Lighthouse throttles the CPU 4×: 1,023 × 4 ≈ 4,100 ms against 4,437 ms of measured
  script evaluation. There was one cause, and the gap was a unit error. Recorded rather than
  quietly dropped, because the issue was careful to label those hypotheses unverified and the
  discipline that made the correction findable is the part worth keeping.

- **The checks did not go with the speed, and there are tests saying so.** Five new cases in
  `shared/pantry-split.test.ts` pin each thing `PantryView.parse` was the only one performing: a
  series whose rows do not match the municipality list, an indicator adjusted to a year the price
  index does not cover, all failures reported together rather than the first, and — the property
  that makes the shortcut honest — that `PantryView.parse` accepts what `viewOf` returns
  unchanged, at every size from zero series to all of them.

- **A page that scores 92 today scored 68 yesterday and nothing knew.** The budget had measured
  only the root since it was written; 86 and 82 in earlier slices were above the floor by luck.
  That second finding in #35 is the more expensive one: the fix here is one function, and the
  reason it took two slices to find is a gate that was never pointed at the product.

- **`yarn budget` now takes about twice as long**, locally and in CI, because it measures two
  pages at three runs each. That is the price of the gate.

- **Stage B is unblocked.** The fifth slice's seven remaining indicators can land without each one
  making every other one slower to load.
