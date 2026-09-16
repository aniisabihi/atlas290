# 0008 — Response headers, and how these pages get found

**Date:** 2026-09-16
**Status:** accepted

## Context

A review of the repository after [decision 0006](0006-the-name.md) found three gaps that shared a
root: the project had spent two plans making individual municipality pages _work_, and none making
them _reachable_ or _defended_.

- No `_headers` file existed, so the site served only whatever Cloudflare adds by itself.
- There was no sitemap, and `robots.txt` did not name one.
- A documented optimisation in `src/data/select.ts` — "built once per load" — was not holding.

None of these was breaking anything visible, which is why none had been noticed.

### Checked against production, not against the build

[Decision 0007](0007-the-404-that-was-not.md) had just finished demonstrating what it costs to
reason about Cloudflare from a local simulation, so the deployed site was asked directly on
2026-09-16, before any of this was written:

```
GET /en/              referrer-policy: strict-origin-when-cross-origin
                      x-content-type-options: nosniff
GET /sitemap.xml      404
GET /robots.txt       no Sitemap: line
GET /en/atlantis-9999/  404          ← 0007's fix, confirmed live
```

**This corrected the review that prompted it.** "Nothing served a single security header" was
wrong: Cloudflare Pages sets `x-content-type-options` and `referrer-policy` on its own. What was
missing was everything else — no Content Security Policy, no `X-Frame-Options`, no
`Cross-Origin-Opener-Policy`, no `Permissions-Policy`.

It also means this change **overrides** a default rather than filling a hole: `no-referrer`
replaces Cloudflare's `strict-origin-when-cross-origin`. That is deliberate and it is a choice,
not a tightening for its own sake. The site has exactly one outbound link, carries no analytics,
and says on its own front page that it does not track anyone; sending an origin to a third party
buys nothing that the project wants.

## Decision 1 — a sitemap, because nothing else can find these pages

[Plan 9](../plans/2026-09-15-09-a-page-per-municipality.md) is half-delivered without one, and the
missing half is not obvious from the plan.

Every page this site serves is a shell: `<div id="root">`, a bundle, and a head full of correct
meta tags. A crawler that runs JavaScript sees the whole application. A crawler that does not sees
an empty document **and no links whatsoever** — there is no server-rendered navigation anywhere,
so the 580 municipality pages have nothing pointing at them from anywhere on the web, including
from each other.

The preview cards solve a different problem than the one this solves. A card makes a **pasted**
link show the place. It does nothing to make an **unpasted** one exist. The sitemap is the only
discovery path a static site of shells has, and 582 URLs is small enough that there is no reason
to be clever about it.

**It is generated, not committed, and absent without an origin.** The protocol requires
fully-qualified URLs; a sitemap of relative paths is not a lenient sitemap but an invalid one. A
local build writes none and says so, exactly as it already does for `og:image`.

## Decision 2 — a strict policy, with a hash rather than `'unsafe-inline'`

The site turned out to be an unusually easy Content Security Policy target, and this was checked
rather than assumed: one self-hosted bundle, one self-hosted stylesheet, no third-party origin, no
`data:` URI, nothing fetched cross-origin. So the policy denies everything by default and names
the four things that are real.

Two entries needed a decision.

**The root page's inline script.** `/index.html` is a static language picker whose redirect is an
inline `<script>` — the one thing on the site `script-src 'self'` blocks. The failure shape is the
worst available: the bare domain silently stops redirecting while all 581 other pages keep working
perfectly. It is allowed by a **hash computed from the built file** at build time, so editing the
picker cannot lock it out and a stale hand-written copy cannot exist. This is also why `_headers`
is generated rather than committed.

**`'unsafe-inline'` for styles, and only styles.** Two components set a React `style` prop —
`Legend`'s per-class colour swatch and `NoDataPatterns`' offscreen SVG — which become `style`
attributes. There is no hash for an attribute, and the alternative is moving a per-item colour
into a stylesheet that cannot know it. Scripts were not given the same licence, and a test asserts
they never are.

**The preview server serves the same file.** `vite.config.ts` reads `dist/_headers` and applies
it, so `yarn e2e` exercises the real policy in three engines. This follows the reasoning already
written into that file for the 404 behaviour: the preview server should answer the same question
Cloudflare answers, so the two cannot drift. A policy that blocks the application's own bundle
looks exactly like a correct one until something tries to load, and there is no staging
environment here to find that out in.

**Proven able to fail.** A deliberately corrupted hash was served to the suite and the redirect
test failed, in the specific way predicted. The same standard [docs/accessibility.md](../accessibility.md)
holds the axe scan to.

## Decision 3 — zod is told about the policy rather than discovering it

Turning the policy on dropped Lighthouse's best-practices score from 100 to 96, which is how a
real finding surfaced: the production bundle attempts `new Function`.

It is zod, feature-detecting whether it may JIT-compile its validators. The call is wrapped in
`try`/`catch`, so the deployed site was **already** falling back to the interpreted parser and
nothing was broken — but it discovered this by triggering a genuine CSP violation on every single
page load, which Chrome logs and Lighthouse counts.

`z.config({ jitless: true })` says the same thing up front. zod's own source names this exact
case. It changes no behaviour and removes the violation.

It is set in `shared/pantry.ts`, above the schemas, and **not** in `src/main.tsx`, which is where
it was tried first and does not work: the flag is read when a schema is _constructed_, which for
that file is at import, and an ES module's imports are all evaluated before any importing module's
body runs. It is guarded on `globalThis.document` so the kitchen keeps the fast path — it parses
far more than the site does, runs in Node under no policy at all, and should not pay for a
restriction that does not apply to it.

## Decision 4 — the budget measures what actually deploys

Fixing the above revealed that the performance budget had been measuring a build nobody visits.
The budget job built without `SITE_ORIGIN`, so the canonical, the `hreflang` alternates and the
sitemap were all absent or relative — and the SEO score was **91 for want of exactly those**,
against a deployed artefact that scores 100.

The job now builds the way the deploy builds. The origin does not have to match the host serving
the files for Lighthouse to score it correctly, which was checked rather than assumed.
`PAGES_PROJECT` moved to the top of the workflow because three things now need it.

## Decision 5 — the budget stops passing by luck

This branch's first CI run failed the budget at **performance 79 against a floor of 80**, which
turned out to be the most useful thing in it.

The first question was whether this change caused it. Two candidates: the `useMemo`, which can
only help, and zod losing its JIT path. The second was measured rather than argued — parsing the
real 1.05 MB pantry, five timed runs each:

|         | median  | range     |
| ------- | ------- | --------- |
| JIT     | 20.1 ms | 19.1–21.6 |
| jitless | 21.7 ms | 21.2–22.1 |

**1.6 ms.** Nothing that moves a Lighthouse score by six points. So the next question was what the
floor had actually been doing, and the answer is in the eight CI runs recorded between 2026-09-15
and 2026-09-16: **79, 80, 80, 80, 81, 83, 84, 85.** Three landed exactly on the floor. One fell a
single point through it.

The floor was **inside the noise of the thing it measures**. It had been passing by luck, and this
run was the first to be unlucky. The docstring in `tools/lighthouse-budget.mjs` had already
written the rule this broke — _"a score that has to be exactly right is a score that fails for
reasons nobody can act on"_ — which makes this a case of the number drifting away from its own
stated intent rather than the intent being wrong.

**Two changes, and the order matters.** Lowering the floor alone would have been fitting the
budget to the failure. So first the measurement got better: Lighthouse's own guidance is to run
several times and take the median, and the budget now runs three and does that — three being the
compromise between that advice and a job nobody wants to wait for. **Then** the floor moved to 72,
about ten points below anything yet observed, so it marks a regression somebody caused rather than
a runner somebody drew.

Every run's score is printed, not just the median. A median that passes while the spread beneath
it widens is exactly what a single number hides, and hiding it is how this got here.

The other three categories are held at exactly where they sit. They have returned the same figure
on every run ever recorded, so unlike performance they are not samples, and one point of movement
in any of them is a real change.

## Consequences

- **`_headers` and `sitemap.xml` are build output, not source.** Neither can be edited by hand,
  and `_headers` carries a generated comment saying so.
- **A new inline script anywhere gets hashed automatically**, because the generator reads every
  hand-written document rather than the root alone. `404.html` is in that list although
  [0007](0007-the-404-that-was-not.md) D2 says it must never gain a script: if it ever does, it is
  covered, rather than being the single page on the site that silently breaks under the policy.
- **`Referrer-Policy` is now `no-referrer`**, replacing the `strict-origin-when-cross-origin`
  Cloudflare sets by default. Anyone adding an outbound integration that needs a referrer will
  find it here rather than wondering why it is absent.
- **The rank cache now survives a render.** `ranksFor` caches into a `WeakMap` keyed on the
  `Lookup` object, and `App` was rebuilding that object on every render — so the cache was thrown
  away every render and all 290 municipalities re-sorted each time. The fix is a `useMemo`; the
  coupling is invisible from either file alone, so a test in `select.test.ts` now states it.
- **Warnings fail the build.** `oxlint` exits 0 on warnings, so the eight the project carried
  could never fail CI. All eight were false positives on deliberate patterns; each is now turned
  off with its reason written next to it, and `--deny-warnings` means the next one is real.
- **Still not done:** no screen-reader pass, unchanged from
  [docs/accessibility.md](../accessibility.md) and still the largest quality gap in the project.
  The monthly refresh has also never run end to end — its first scheduled firing is 2026-10-01.
