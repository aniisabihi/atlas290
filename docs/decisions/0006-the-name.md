# 0006 — The name

**Date:** 2026-09-15
**Status:** accepted

## Context

[DESIGN section 9](../DESIGN.md#9-still-open) had carried the project name as open since the first
day, with one hard constraint: **it must not suggest affiliation with SCB.**

It stopped being cosmetic when [Plan 9](../plans/2026-09-15-09-a-page-per-municipality.md) shipped
580 pre-rendered pages and 290 preview cards. `og:image` resolves for a crawler only when it is
absolute, so the cards could not render anywhere until the site had an origin — and the origin was
waiting on the name. 7.9 MB of committed images were doing nothing until this was decided.

## What was checked first

### An origin costs nothing

The name was framed as blocking a _custom domain_, which would cost money and so sits awkwardly
against the project's founding constraint that it must be free to build, deploy and run. It does
not: Cloudflare Pages serves every project at `<project-name>.pages.dev`, which is an absolute
origin and is free. The name unblocks the previews at no cost; a `.se` is a later nicety and
nothing depends on it.

### One trap, verified

**"Sverige i siffror" is SCB's own** — their public-facing statistics site at
`scb.se/hitta-statistik/sverige-i-siffror`, checked on 2026-09-15. Any name in that shape fails
the hard constraint outright rather than borderline.

### Availability, as of 2026-09-15

Checked by DNS and by whois against `whois.iis.se` rather than assumed:

| Candidate    | `.pages.dev`                 | `.se` |
| ------------ | ---------------------------- | ----- |
| **atlas290** | nothing served               | free  |
| kartogram    | nothing served               | free  |
| omritad      | nothing served               | free  |
| utsikt       | nothing served               | taken |
| kommunkartan | nothing served               | taken |
| kommunatlas  | **already serves something** | taken |

`kommunatlas` was the first instinct and is gone, which is the argument for checking. Two caveats
on the rest: Cloudflare does not document whether `pages.dev` names are unique across accounts, so
"nothing served" is evidence rather than a reservation; and a `.se` record shows registration, not
whether anyone would sell.

## Decision

**The project is called Atlas 290.** Chosen by the architect from a shortlist of five.

**Why it beat the others.** It is the only candidate that is identical in Swedish and English. The
site is equally both — two entry pages, two of every string, one URL grammar carrying the language
in its path — and every other candidate was a Swedish word an English visitor bounces off, or an
English word a Swedish visitor does. `siteName` is now the one string in `src/i18n/strings.ts`
that is deliberately the same in both tables, and the preview card dropped from two site lines to
one for the same reason.

It also states the scale without claiming authority. "Atlas" is a book of maps, not an institution;
the number is a fact about Sweden, not a claim about who published it.

**The risk, stated rather than discovered later:** 290 is only true until Sweden changes its
municipalities. The count has held since Knivsta was created in 2003, and a change would date the
name — not break it, but date it.

## Consequences

- `siteName` is `Atlas 290` in both languages. Tab titles end `· Atlas 290`, where before they
  ended with a sentence describing the site — which, as `src/state/title.ts` already argued, told
  the person you sent the link to nothing at all.
- The taglines absorbed the description the name used to carry, and dropped the "290" they now
  duplicate.
- **The Cloudflare Pages project must be named `atlas290`,** because that name _is_ the hostname.
  The deploy job declares it once as `PAGES_PROJECT` and derives `SITE_ORIGIN` from it, so the
  deploy target and the origin the previews are built against cannot drift. A project created
  under another name deploys perfectly and shows no preview cards anywhere — a failure with no
  error message, which is why the two are tied together in one variable.
- **The link previews are now unblocked** and will render from the first successful deploy. That
  deploy is still waiting on the repository owner's Cloudflare token; nothing in this repository
  can create it.
- The npm package and the GitHub repository are both renamed to `atlas290`, the latter by the
  owner. GitHub 301-redirects the old path, verified after the rename, so links and clones that
  already exist keep working — including the CI badge, which was updated anyway rather than left
  to lean on a redirect.
- The plan documents under `docs/plans/` still say "Sweden Data Explorer" and are left alone. They
  are a record of what was decided when, not a description of the current site.

## Where this is re-derived

- `src/state/title.test.ts` and `src/components/App.test.tsx` — every tab title.
- `tools/build-pages.test.ts` and `e2e/municipality-pages.spec.ts` — the generated pages, as
  strings and in three browsers.
