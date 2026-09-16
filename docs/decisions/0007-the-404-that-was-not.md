# 0007 — The 404 that was not

**Date:** 2026-09-16
**Status:** accepted
**Corrects:** [0005 D6](0005-a-page-per-municipality.md#d6--dev-and-preview-404-exactly-where-production-will)

## Context

The site went live at `https://atlas290.pages.dev` on 2026-09-15. Checking the deployed paths the
way a visitor would, rather than the way the test suite does:

```
/en/malmo-1280/      200   correct
/en/atlantis-9999/   200   WRONG — should be 404
/en/nowhere/         200   WRONG — should be 404
```

Production served **the root page with a 200** for every path that matched no file. The root page
is the language picker, whose script redirects to the visitor's language — so a mistyped or dead
link silently landed on the front page, looking exactly like a working one.

That is the bug [Plan 9](../plans/2026-09-15-09-a-page-per-municipality.md) was written to remove,
reappearing for the URLs nobody checked.

## Why the tests said otherwise

[0005 D6](0005-a-page-per-municipality.md) claims: _"Dev and preview 404 exactly where production
will."_ `e2e/municipality-pages.spec.ts` asserted it and passed in three browsers.

It passed against `vite preview`, whose 404 came from a middleware **written to match what
production was assumed to do.** Production did not exist yet — the Cloudflare account came later —
so the assertion compared a simulation with the assumption it was built from. It could not have
failed, and it proved nothing about Cloudflare.

The comment in `vite.config.ts` even argued the right principle: ask the file system, "the same
question a static host asks, and so cannot drift". The reasoning was sound and the premise was
wrong. Cloudflare does not ask that question.

**What it actually does**, from Cloudflare's own serving-pages documentation, checked 2026-09-16:
with no top-level `404.html`, Pages assumes you are deploying a single-page application and
matches all incoming paths to the root.

## Decisions

### D1 — `public/404.html`, committed, not generated

One file at the root of the build is the entire fix. It lives in `public/` because
`publicDir: 'public'` copies it verbatim to `dist/404.html`, which is where Pages looks — and
because nothing about it changes when the data does.

### D2 — It carries no script, in particular no redirect

The root page redirects to the visitor's language. Doing the same here is what made the failure
invisible in the first place: the visitor ended up somewhere real and never learned the address
was wrong. A person who mistyped needs to be told, not moved.

It is also `noindex`. Every unmatched URL now serves this one document, and without that a
crawler can index an unbounded number of distinct addresses showing the same page.

### D3 — It is bilingual, and does not guess

A path that matched nothing names no language. Choosing one would be inventing information, so
the page says both and offers both entries.

### D4 — The test asserts the artefact, not our own server

`tools/not-found.test.ts` checks the property Cloudflare reads, in the place it reads it: that
the document exists at the root of the build, has no script, and asks not to be indexed. It runs
offline and does not depend on any server we wrote.

`e2e/not-found.spec.ts` additionally fetches `/404.html` by its own path rather than through the
middleware, so it fails if the file stops reaching `dist/` even while the middleware keeps
answering correctly.

### D5 — Dev and preview now serve that same document

They already returned 404; they returned it as plain text. Now all three serve the same page, so
the thing being read locally is the thing that ships.

## The lesson, stated plainly

**A test that asserts your own simulation of a third party tells you nothing about the third
party.** The preview middleware was a model of Cloudflare; the test checked the model against
itself. The only assertions that could have caught this are the one that reads the third party's
documentation for what it requires, and the one that fetches the deployed site.

This is the second time on this project that a test measured the wrong program and passed:
[0004](0004-the-morph.md) records a benchmark that measured the mechanism rather than the
implementation. Both were found by checking the real thing rather than the stand-in.

## Consequences

- Unknown paths now answer 404 with a page that says so, in both languages, and are not indexed.
- **0005 D6's claim is corrected rather than deleted.** It was true of `vite preview` and false of
  production, and the record of having believed it is more useful than a tidy one.
- The accessibility scan covers the 404 page too. It needed a `main` landmark to pass, which the
  first draft did not have.

## Where this is re-derived

- `tools/not-found.test.ts` — the file, offline.
- `e2e/not-found.spec.ts` — the status, the body, the absence of a redirect, and axe, in three
  browsers.
