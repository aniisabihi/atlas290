# 0012 — Releases, and a changelog generated from commits

**Date:** 2026-09-17
**Status:** accepted
**Affects:** `CHANGELOG.md`, `package.json`, `release-please-config.json`,
`.release-please-manifest.json`, `.github/workflows/release.yml`,
`.github/workflows/pr-title.yml`, `docs/deployment.md`

## Context

Eleven plans, nineteen pull requests and a live site, and no way to say which version anyone is
looking at. `git tag -l` was empty and `package.json` had no `version` field at all — the package
is private and npm never asked for one.

That was liveable while the only readers were the two people building it. It stops being liveable
the moment the site has an audience: every green push to `main` silently replaces what is
deployed, and nothing anywhere records what changed between one visit and the next. The decision
records explain _why_ each choice was made, and the plans explain what each increment set out to
do, but neither answers "what is live right now, and what changed".

The architect asked for releases and a changelog on 2026-09-17, starting by naming the current
state release 1, and chose the three open questions: SemVer, entries generated from commits, and a
full retrospective for 1.0.0.

## Decision 1 — SemVer, and it versions the software, not the data

`1.0.0` is the state of `main` at `d0ee8d0`.

The monthly SCB refresh does **not** cut a release. It already arrives as its own reviewable pull
request and writes its own line to `docs/refresh-log.md`; twelve releases a year reading "data
refreshed" would bury the entries that mean something, and the version would then be claiming to
describe data it does not describe. A refresh that changes _code_ — a migration, a new content
code, a boundary rule — is an ordinary `fix:` or `feat:` and releases like anything else.

The alternative considered was CalVer (`2026.09.0`), which suits a project whose content is dated
statistics. It was rejected for the reason in Decision 2: this project has exactly one promise
that can break, and a version scheme that cannot express breaking it would waste the only signal
worth having.

## Decision 2 — the major version is the URL grammar

The only promise Atlas 290 makes outward is that a link keeps working: `?m=`, `/sv/malmo-1280/`,
580 pre-rendered pages and 290 preview cards that exist so a pasted link shows the place
([0005](0005-a-page-per-municipality.md), [0008](0008-headers-and-discoverability.md)).

So: **a major version means a published URL stopped working.** A redesign is not a breaking
change — [0009](0009-the-design-language.md) rebuilt the entire visual language and broke no
link. A renamed path is a breaking change even if it is one municipality.

This makes the major version mean something a reader can act on, and it puts `src/state/url.ts`
and `shared/slug.ts` — already the highest-stakes code in the repository — behind the loudest
signal the scheme has.

## Decision 3 — release-please, on `main`, in manifest mode

`googleapis/release-please-action@v4` reads the Conventional Commit subjects since the last tag
and keeps one open pull request proposing the next version: the changelog entry, the bumped
`package.json`, the updated manifest. Merging it tags the commit and publishes the GitHub Release.

The human step is reviewing one pull request — the same step this project already uses for data,
which is the point. Nothing releases itself, and nothing requires remembering a command.

**1.0.0 is tagged at `d0ee8d0`** — the state of `main` when the architect asked for releases, and
therefore the state this changelog entry describes. `bootstrap-sha` in the config pins that same
commit as the baseline, so release-please's first run considers only what came after it. Without
it, the first run would read all 184 historical commits and propose a version derived from work
that predates the convention. The consequence is that the `v1.0.0` tree does not itself contain
`CHANGELOG.md`: 1.0.0 is the software as it was before this record existed, and the changelog
describes it from the outside. The first _generated_ release is 1.1.0 — the release process
itself — which proves the machinery on the change that introduced it.

`release-type: node` bumps `package.json`. Yarn 4 records the root workspace as
`0.0.0-use.local` regardless of what `package.json` says, so a version bump cannot make
`yarn install --immutable` fail; this was verified by running it rather than assumed.
`include-component-in-tag: false` gives tags `v1.1.0` rather than `atlas290-v1.1.0`, because there
is one thing here to version.

The alternative was writing every entry by hand. It produces better prose — this record is
evidence — and it is exactly the kind of step that gets skipped on the release where it mattered.

## Decision 4 — the default `GITHUB_TOKEN`, and what that gives up

The workflow passes no `token:` input, so it runs as the default `GITHUB_TOKEN`. A pull request
opened by that token does not start other workflows, so **CI and the haus gate do not run on the
release pull request.**

Stated plainly because it is a real gap. It is accepted because the release pull request touches
`CHANGELOG.md`, `package.json` and `.release-please-manifest.json` and nothing else — a diff that
cannot break a build — and because merging it is a human push, which runs the full pipeline and
deploys. The alternative buys checks on that diff with a long-lived personal access token living
in repository secrets, which is a standing credential in exchange for a formality.

## Decision 5 — five visible sections, four hidden

`feat` → Added, `fix` → Fixed, `perf` → Performance, `refactor` → Changed, `docs` →
Documentation. `chore`, `test`, `style` and `ci` are recorded in git and left out of the
changelog.

`docs` is visible, which is unusual, because in this repository a documentation commit is usually
a decision record — the thing a reader most wants to follow.

## Decision 6 — a pull request title that is not a Conventional Commit fails CI

Generating from commits is only as good as the commits, and the failure is **silent**: a
well-built increment simply does not appear in the release notes, and nobody notices until they
look for it. This is the same shape as the `Closes #1, #2, #3` trap the workflow standard warns
about, and it deserves the same answer.

The evidence is in this repository. Checking the regex against every merged pull request title
found that **none of the nineteen** would have passed — including
"The place beside the map, and a pointer that can read it", which was squash-merged and is
therefore the commit subject on `main` for the whole of Plan 11. Under Decision 3 and nothing
else, that increment would have been invisible.

`.github/workflows/pr-title.yml` checks the title against the nine allowed types and fails with a
message that says what to write and why. It is a shell step against
`github.event.pull_request.title` rather than a third-party action, for the same reason Wrangler
is a pinned devDependency rather than a marketplace action: what runs is visible in the file.

## Decision 7 — 1.0.0 is written by hand, once

Everything before this record predates the convention; generating it would produce 184 commit
subjects, most of them steps within a plan. The 1.0.0 entry is written from
`docs/plans/README.md` and decision records 0001–0011, and it is the only entry that will ever be
written by a person. It links to the decision records instead of restating them.

## Consequences

- **The version is not visible on the site.** No footer badge, no meta tag, no build stamp.
  Nothing a visitor reads depends on it, and putting it in the page would make every release a
  visual diff and a new axe surface. If a released version should be visible to a visitor, that is
  a design decision and gets its own record.
- **Deploys and releases are now separate things.** `ci.yml` is untouched: every green push to
  `main` still deploys. A release labels what is already live. This is worth saying out loud
  because "release" in `docs/deployment.md` previously meant "deploy", and it no longer does.
- **Every pull request from now on must be titled as a Conventional Commit**, where none of the
  first nineteen were. This is a new habit, enforced rather than trusted.
- **The release pull request merges as a push to `main`**, which redeploys a site whose content
  has not changed by a byte. Harmless, and cheaper than excluding it.
- **Plans 1–11 get no retroactive tags.** They have plans and decision records, which say more
  than `v0.7.0` would.
