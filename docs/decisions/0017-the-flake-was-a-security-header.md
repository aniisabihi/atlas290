# ADR-0017: The flake was a security header

- **Status:** Accepted | **Date:** 2026-09-18
- **Decided by:** Aniisa Bihi (draft by Claude Opus 5)
- **Affects:** `playwright.config.ts`, `e2e/morph.spec.ts`, `e2e/accessibility.spec.ts`,
  `e2e/municipality-pages.spec.ts`, `e2e/similar.spec.ts`
- **Related:** [issue #26](https://github.com/aniisabihi/atlas290/issues/26),
  [0008](0008-headers-and-discoverability.md) D2

## Context

Five CI runs across four pull requests failed the browser job on changes that touched no
browser-facing behaviour — one of them a documentation-only pull request — and a re-run of the
same commit went green. A different test failed every time, in Firefox and in WebKit, never in
Chromium, which is what the issue was named for: there was no culprit to point at, and the report
deliberately stopped at leads rather than asserting a cause.

The leads on file were parallelism, animation timing, and `page.waitForTimeout`. All three were
wrong, and in an instructive way: they were properties the failures shared, not the thing that
caused them.

## Decision

**D1 — The cause was found by bisecting the response headers, not the tests.** A failing run was
reproduced locally in two minutes, and the failure carried its own diagnosis once anyone read it:
`page.goto` timed out `waiting until "load"` while `document.readyState` was `complete`, the
`load` event had already fired, and nothing was in flight. The page had loaded. Playwright had
not noticed.

Measured against a bare Node server serving one static document, 50 fresh pages per process,
three processes at a time:

| Response headers served                                        | First navigation hung |
| -------------------------------------------------------------- | --------------------- |
| None                                                           | 0 / 150               |
| The Content Security Policy alone                              | 0 / 150               |
| `X-Frame-Options`, `Referrer-Policy`, `X-Content-Type-Options` | 0 / 150               |
| **`Cross-Origin-Opener-Policy: same-origin` alone**            | **29 / 150**          |

WebKit and Chromium: 0 / 150 with the same header. It is a hang, not slowness — measured against a
90-second ceiling, on a median of 27 ms.

**D2 — The mechanism, which explains every property the issue recorded.** A page begins life at
`about:blank`, which carries no `Cross-Origin-Opener-Policy`. Its first navigation to a document
that does swaps the browsing-context group, and Firefox's Playwright driver intermittently loses
that navigation. Everything the report found follows from it:

- _A different test every run._ Every test opens a page and navigates once. There is no culprit
  test because the vulnerable operation is the one they all begin with.
- _Only the first navigation._ Once the page is inside the policy's group there is no second swap;
  a second `goto` never hung, across every run measured.
- _Never in Chromium._ Only Firefox's driver mishandles the swap.
- _Firefox alone passed 95 of 95._ It is a race, so a quiet machine loses it less often — which is
  exactly the shape that made "resource contention" the obvious and wrong reading.

**D3 — Firefox stops enforcing the policy; the site never stops serving it.** `dist/_headers`
still carries `COOP: same-origin`, the preview server still serves it, `e2e/headers.spec.ts`
still asserts it arrives on all five kinds of page, and Chromium and WebKit still enforce it. One
launch preference, scoped to the Firefox project, removes the browsing-context-group swap from the
test browser. Eight consecutive full runs of the whole suite after it, 283 passing each time, and
zero navigation hangs in any run since — including nine more at twelve workers on eight cores.

The honest cost is stated rather than waved past: the Firefox run no longer exercises COOP's
process isolation. Nothing was lost that was being tested, because nothing tested it — this site
never calls `window.open` and never reads `window.opener`, so the policy has no behavioural
surface here at all. It is defence in depth against a future that does, and the header that ships
is unchanged.

**D4 — The axe scans get the budget the parameterised ones already have.** Five scans were still
running under the default 30 seconds while their neighbours in `e2e/accessibility.spec.ts` had
been marked slow, with a comment saying why: an axe analysis is CPU-bound, and it is the work that
is slow, not the page. Under a deliberately over-subscribed machine those five, and only those
five, timed out. `test.slow()` widens the budget and weakens nothing: a violation still fails.

**D5 — The morph's frame sampler waits for frames, not for a clock.** It asked for 30 frames and
then waited 1200 ms, which assumed a frame rate nobody had promised. On a busy machine the sample
was truncated exactly when contention made it shortest. It now waits for the frames themselves,
which is also faster on an idle machine — 30 frames arrive in about half a second.

**D6 — And its assertion is now the claim rather than a margin above it.** "The shape passes
through states that are neither end" is `distinct > 2`; the bar was 6. A sample can hold no more
states than the engine drew during the morph, so six was a statement about the machine, and on a
starved one it became five. Two is the exact complement of what the reduced-motion test asserts
about the same quantity — at most two — so the pair now asserts opposite things about one number.
Whether a 290-shape flight draws enough frames is a question for the performance budget, which
measures it properly.

## Motivation (why)

The issue argued its own case: a genuine Firefox regression would have been indistinguishable from
this noise, and four re-runs had already trained everyone to re-run first and read second. It also
ruled out the fix that would have made the symptom go away — raising `retries` — on the grounds
that it hides the signal rather than removing the cause. That ruling is what made the work worth
doing properly: the cause is gone, not absorbed.

## Alternatives considered

- **Raise `retries`, or retry `page.goto`.** A goto retry works — measured at 0/150 failures with
  11 retries per 50 pages — and it would have covered any engine, including the Linux WebKit this
  machine cannot run. It was rejected for the reason the issue gave: roughly one navigation in
  five would have been silently retried, costing a timeout each, and the suite would have been
  reporting health it did not have. Removing the trigger costs nothing and hides nothing.
- **Stop serving `Cross-Origin-Opener-Policy`, or stop serving it from the preview server.** The
  first weakens the deployed site to please a test driver. The second breaks the point of
  [0008](0008-headers-and-discoverability.md) D2, which is that the browser suite exercises the
  real policy rather than a second copy of the intent.
- **Upgrade Playwright.** 1.63.0 is the current release; there is nothing to upgrade to.
- **Prime each page with a throwaway navigation first.** Measured, and it does not work: the swap
  follows the page, not the context, so the priming navigation hangs at the same rate the real one
  did.

## Consequences

- The Firefox project runs without COOP process isolation. If this site ever opens a cross-origin
  window, that gap becomes real and this decision needs revisiting.
- **The WebKit strand of #26 is not closed by this.** Two CI observations — a focus that never
  lands (`similar.spec.ts:46`) and a focus ring that never appears (`morph.spec.ts:108`) — are not
  explained by any of the above. WebKit was measured clean under COOP for both navigation and
  focus, 0 / 150 and 0 / 120, but that was the macOS build; CI runs the Linux one, and this
  machine has no way to run it. Said plainly rather than folded into the fix: if WebKit keeps
  failing after this, it is a second cause and the evidence for it starts now, from a suite whose
  Firefox noise is gone.
- CI's single retry stays at 1. It was masking most of this; with the cause removed it goes back to
  meaning what it should — a genuine one-off, worth a second look.
- The suite is also about 20% faster, because a hung navigation was costing a full test timeout
  each time it happened.
