# Plan 18 — The view is built once

> [Issue #35](https://github.com/aniisabihi/atlas290/issues/35). A municipality page scores 68
> against a floor of 72. Fix it before the fifth slice's stage B, whose seven further indicators
> each make it worse.

## What the issue got right, and the one thing it got wrong

Right: `viewOf` re-parses every already-loaded series each time one more arrives, so opening a
profile costs 35 rebuilds of a growing view. Re-measured here on `main` at 35 indicators:
**1,023 ms**, against the 131 ms ADR-0013 measured at ten. That ADR predicted this exactly and
deferred it to plan 15, which was scoped to something else and did not do it.

Wrong: the issue called roughly 2.9 s of the 3,940 ms **unattributed**, and offered the rank cache
and 35 sparklines as unverified hypotheses. Both are wrong, and the gap was never real. A CPU
profile of the actual page (Chromium, 4× throttling, the rate Lighthouse itself applies, 200 µs
sampling) attributes the main thread like this:

| Sampled self time                                              |                            |
| -------------------------------------------------------------- | -------------------------: |
| zod (`_zod.run`, `_zod.parse`, `_zod.check` and their callees) |              **~3,700 ms** |
| React (render, commit, everything on the React chunk)          |                    ~150 ms |
| Garbage collection                                             |                    ~130 ms |
| `rankOf` / `ranksFor`                                          | not present in the profile |
| `Sparkline`                                                    | not present in the profile |

The arithmetic nobody did: `bench-view.ts` runs **unthrottled in Node**, and Lighthouse throttles
the CPU 4×. 1,023 ms × 4 ≈ 4,100 ms, against the 4,437 ms of script evaluation Lighthouse reports.
There was never a second cause to find. The "unattributed 2.9 s" was the throttling factor.

That is worth recording rather than quietly fixing: two plausible mechanisms were read out of the
code and written into an issue, and profiling found neither of them doing any measurable work.

## The fix

`viewOf(index, loaded)` is handed two things that have **already been validated**:

- `index` is a parsed `PantryIndex` — its municipalities, its `IndicatorMeta`s and its price index
  all went through zod when `loadPantry` fetched `data/index.json`.
- each `part` is a parsed `PantryIndicator` — its `series` went through `IndicatorSeries` when
  `fetchIndicatorPart` fetched it.

`PantryView.parse` then validates all of that again, per arrival, cumulatively. The only thing it
checks that the inputs' own parses did not is `checkPantryCrossReferences` — row counts against
the municipality list, a series with no indicator, a price basis the index does not cover — and
that is O(series), not O(cells).

So: assemble the object directly and run the cross-reference check alone. **Nothing is dropped.**
Validation moves to the boundary where it belongs — once, on arrival, against untrusted bytes —
instead of being repeated inside a function whose inputs are already trustworthy by type.

This is ADR-0013's own first suggestion, in its words: "validate each part once on arrival instead
of re-parsing the view, keeping whatever cross-reference check it also performs".

## What this plan does NOT do

- **No per-municipality pantry file.** ADR-0013's second suggestion would also cut the 49 requests,
  and it is a much larger change to the published shape. Measure this fix first; if the score
  clears the floor with room, that file is not needed yet.
- **No batching of arrivals.** React is 150 ms of the 4.9 s. Batching would be work aimed at
  something the profile says is not a problem.
- **No new CI gate in this change.** See task 4 — the gate lands here, but only because the fix
  lands with it.

## Tasks

### Task 1 — `viewOf` stops re-parsing what it was handed

`shared/pantry.ts`. TDD: this is the highest-stakes file in the repository, and the test has to
prove the checks survived, not just that the function got faster.

**Acceptance**

- [x] `checkPantryCrossReferences` is reachable outside a parse and throws an `Error` carrying the
      same messages, all of them rather than the first — matching what zod reported and what every
      other guard in `viewOf` already throws.
- [x] `viewOf` returns an object that `PantryView.parse` accepts unchanged — the existing test
      already asserts this and must keep passing.
- [x] Every cross-reference failure `PantryView.parse` used to catch inside `viewOf` still throws:
      a series whose row count does not match the municipalities, a series with no indicator in
      the index, an indicator adjusted to a year the price index does not cover.
- [x] A series with a bad cell (`null` value at status `present`) is still refused **at the
      boundary** — `PantryIndicator.parse` in `fetchIndicatorPart` — and there is a test saying so,
      because that is the check this change is relying on and it must be pinned.
- [x] `yarn kitchen publish` leaves `public/pantry/` byte-identical.

**Verification** `yarn test`, `yarn typecheck`, `npx tsx kitchen/spikes/bench-view.ts`.

### Task 2 — Re-measure, honestly

**Acceptance**

- [x] `bench-view.ts` re-run and its cumulative figure recorded below.
- [x] `yarn budget` re-run, median of 3, recorded
      below with every run's score, not just the median.
- [x] The CPU profile re-taken and zod's share recorded. If something else now dominates, it is
      written down rather than declared fixed.

### Task 3 — The browser suite, because this is site behaviour

**Verification** `yarn e2e`, all three engines. `test-results/.last-run.json` is what decides,
not the printed line.

### Task 4 — Gate the page that was never gated

The second finding in #35: `tools/lighthouse-budget.mjs` defaults to the root, and
`.github/workflows/ci.yml` passes that same root URL, so the 580 municipality pages have never
been measured by CI at all. 86 and 82 in earlier slices were above the floor by luck.

This lands **after** the fix in the same change, never before: a failing gate on an unfixed page
blocks every unrelated pull request.

**Acceptance**

- [x] CI runs the budget against a municipality page as well as the root.
- [x] The floor for it is chosen from measured runs here, in the spirit of decision 0008 — clear of
      the spread, not inside it — and the reasoning is written next to the number.
- [x] Both budget runs report, and either one failing fails the job — proved by raising the floor
      to 99 and checking the exit code is 1 and both URLs are named.

### Task 5 — The record

- [x] ADR under `docs/decisions/`, indexed in its README.
- [x] ADR-0013's deferral is answered explicitly: it named plan 15 and plan 15 did not do it.
- [x] The two hypotheses in #35 that profiling disproved are named as disproved.
- [x] Docs: there is no `docs/performance.md`, so the budget is described in `deployment.md`,
      `development-workflow.md` and `codebase.md`, and the boundary rule in `architecture.md`.

## Measurements

`/en/stockholm-0180/` — the real shareable page, built with `SITE_ORIGIN` set the way CI builds
it, and the URL the new gate measures. Same machine, same preview server, median of 3. The
`?m=0180&i=population` form measured 63 and 90 on the same two builds, so the two agree.

|                                   | Before (`main`, a766afd) |               After |
| --------------------------------- | -----------------------: | ------------------: |
| Performance, median of 3          |      **68** (63, 68, 68) | **92** (90, 92, 95) |
| Total blocking time               |                 3,850 ms |              150 ms |
| Main-thread work                  |                    4.9 s |               1.0 s |
| of which script evaluation        |                 4,437 ms |              678 ms |
| Long tasks over 50 ms             |                        5 |                   1 |
| Time to interactive               |                    6.4 s |               2.4 s |
| Requests                          |                       48 |                  48 |
| `bench-view.ts`, one profile open |             **1,023 ms** |            **1 ms** |
| Root page performance             |                       91 |                  91 |
| Script bytes                      |                  127,887 |             127,936 |

CPU profile, Chromium at 4x throttling, self time over the 12 s after navigation:

|                                 |    Before |   After |
| ------------------------------- | --------: | ------: |
| zod                             | ~3,700 ms | ~170 ms |
| React, every sparkline included |   ~150 ms | ~130 ms |
| Garbage collection              |    129 ms |   46 ms |
| `rankOf` / `ranksFor`           |    absent |  absent |

The ~170 ms that remains is the thirty-five `PantryIndicator.parse` calls at the fetch boundary,
which is the validation this change relies on and deliberately keeps.
