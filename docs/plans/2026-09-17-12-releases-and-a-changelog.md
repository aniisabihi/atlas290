# Plan 12: Releases and a changelog

> **For agentic workers:** Steps use checkbox (`- [x]`) syntax for tracking. **Awaiting architect
> approval.** Nothing here touches the site, the kitchen, the pantry or the URL grammar.

**Goal:** The project has shipped eleven plans, nineteen pull requests and a live deploy, and has
no way to say which version anyone is looking at. Every green push to `main` replaces the site
silently and nothing records what changed. This plan gives the repository a version number, a
changelog generated from the commit messages the workflow standard already mandates, and a first
release — **1.0.0** — describing what the current state actually contains.

**Architecture:** No runtime dependency and no shipped code. Four new files at the root
(`CHANGELOG.md`, `release-please-config.json`, `.release-please-manifest.json`, and a `version`
field in `package.json`), one new workflow, and documentation. The version is **not** rendered
anywhere on the site: nothing a visitor reads depends on it, and putting it in the footer would
make every release a visual diff.

**Spec:** the architect's four answers of 2026-09-17 — SemVer for code only, releases generated
from commits, and a full retrospective entry for 1.0.0.

## What was checked before this was written

On `main` at `d0ee8d0`, 2026-09-17:

| Checked                    | Found                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing tags and releases | None. `git tag -l` is empty; there has never been a release.                                                                                                                                                                                                                                                                                                                                                                                         |
| Version in `package.json`  | No `version` field at all. `private: true`, so npm never required one.                                                                                                                                                                                                                                                                                                                                                                               |
| Does `yarn.lock` hold it   | No. Yarn 4 records the root workspace as `atlas290@workspace:.` at `version: 0.0.0-use.local` regardless of `package.json` — so adding a version cannot make `--immutable` fail. Verified by running it in task 1.                                                                                                                                                                                                                                   |
| Anything reading a version | Nothing. `grep -rniE '\bversion\b' src shared tools` finds only prose, the SCB table version date in `shared/pantry.ts:488`, and the XML declaration in `tools/build-pages.mjs`.                                                                                                                                                                                                                                                                     |
| Are commit subjects usable | **No — and worse than expected.** The regex in task 6 was run against every merged pull request title: **none of the nineteen** passes. Fifteen PRs were merge-committed, so their conventional branch commits survive in history; but PR #18 was squash-merged as "The place beside the map, and a pointer that can read it (#18)", which is the commit subject on `main` for the whole of Plan 11 and carries no type. Task 6 is what closes this. |
| Release tooling            | `googleapis/release-please-action@v4`, actively maintained, manifest-driven config. Verified against the action's README on 2026-09-17, not from memory.                                                                                                                                                                                                                                                                                             |

## The decisions this plan makes

**D1 — SemVer, and it versions the software, not the data.** `1.0.0` is the current state. The
monthly SCB refresh does not cut a release: it already arrives as its own reviewable pull request
and writes its own line to `docs/refresh-log.md`, and twelve releases a year saying "data
refreshed" would bury the entries that mean something. A refresh that changes _code_ — a
migration, a new content code — is a normal `fix:` or `feat:` and releases like anything else.

**D2 — The major version is the URL grammar.** This is the only promise the project makes to the
outside world: `?m=`, `/sv/malmo-1280/`, every pasted link. Breaking a published URL is the one
thing that costs a major version. A redesign is not a breaking change; a renamed path is.

**D3 — release-please, on `main`, manifest mode.** It reads Conventional Commits since the last
tag, opens a "release 1.1.0" pull request holding the changelog entry and the bumped
`package.json`, and on merge tags the commit and publishes the GitHub Release. The human step is
reviewing one pull request, which is the same step the project already uses for data.

**D4 — Releases are cut with the default `GITHUB_TOKEN`.** A pull request opened by that token
does not start other workflows, so **CI and the haus gate will not run on the release pull
request**. That is acceptable and deliberate: the release pull request touches only `CHANGELOG.md`,
`package.json` and the manifest, and merging it is a human push that runs the full pipeline and
deploys. A personal access token would buy checks on a diff that cannot break the build, at the
cost of a long-lived credential in repository secrets.

**D5 — Five visible sections, the rest hidden.** `feat` → Added, `fix` → Fixed, `perf` →
Performance, `docs` → Documentation, `refactor` → Changed. `chore`, `test`, `style` and `ci` are
recorded in git and left out of the changelog: a reader wants to know what the site does now, not
that a cache key changed. `docs` is visible because in this repository a documentation commit is
usually a decision record.

**D6 — A pull request title that is not a Conventional Commit fails CI.** "Generated from
commits" is only as good as the commits, and the failure mode is silent — a well-described
increment vanishing from the changelog, exactly like the `Closes #1, #2, #3` trap the workflow
standard warns about. A check on the pull request title is what makes D3 honest. Measured, not
assumed: none of the nineteen merged titles would pass it today.

**D7 — The 1.0.0 entry is written by hand, once.** Everything before this plan predates the
convention, and generating it would produce 184 commit subjects. It is written from
`docs/plans/README.md` and the eleven decision records, and it is the only entry that will ever be
written by a person.

## Tasks

### Task 1 — The version exists

- [ ] Add `"version": "1.0.0"` to `package.json`, after `"private": true`.
- [ ] Create `.release-please-manifest.json`: `{ ".": "1.0.0" }`.
- [ ] Create `release-please-config.json`: one package at `.`, `release-type: node`,
      `changelog-path: CHANGELOG.md`, the sections from D5, `include-component-in-tag: false`
      (tags are `v1.1.0`, not `atlas290-v1.1.0`).

**Acceptance:** `yarn install --immutable` succeeds unchanged — proving the Yarn 4 finding above,
which is the one way this task could break CI.
**Verification:** `yarn install --immutable && git status --porcelain yarn.lock` prints nothing.

### Task 2 — The changelog, with 1.0.0 written out

- [ ] Write `CHANGELOG.md` in Keep a Changelog form, with a header explaining that entries from
      1.1.0 onward are generated by release-please from Conventional Commits, and what a major
      version means here (D2).
- [ ] One `## [1.0.0] — 2026-09-17` entry under `### Added`, covering what the release contains:
      the kitchen and the deterministic pantry, ten indicators 1968–2026, map, cartogram and the
      morph between them, time travel and playback, search, profile and comparison, the facts
      engine, similar municipalities, the table twin of every view, 580 pre-rendered municipality
      pages with preview cards, both languages, the design language and themes, and the
      accessibility and performance gates. Written from `docs/plans/README.md` and decisions
      0001–0011, linking to each decision record rather than restating it.
- [ ] A closing "before 1.0.0" line pointing at `docs/plans/` for the build history.

**Acceptance:** a reader who has never seen the repository learns what the software is, in under
two screens, with every claim traceable to a decision record or a plan.
**Verification:** `yarn lint` — prettier formats and checks Markdown, so a malformed table or a
stray line width fails it.

### Task 3 — The workflow

- [ ] `.github/workflows/release.yml`: on push to `main`, `permissions: contents: write` and
      `pull-requests: write`, a single `googleapis/release-please-action@v4` step with no `token`
      input (D4), commented in this repository's voice — why manifest mode, why no PAT, what the
      human step is.
- [ ] Exclude `docs/refresh-log.md` from its triggers, matching `ci.yml`: the refresh heartbeat
      must not open a release pull request.

**Acceptance:** the workflow parses, and it cannot release anything on its own — every release
passes through a pull request a person merges.
**Verification:** `yarn lint` (prettier checks YAML), plus `gh workflow list` showing it after the
branch is pushed. The first genuine run happens when this plan's own pull request lands.

### Task 4 — The first release

- [ ] Pin `bootstrap-sha` in `release-please-config.json` to `main`'s head at the time of the
      request (`d0ee8d0`), so release-please's first run reads only commits after it instead of all 184. Verified against the release-please manifest documentation, not assumed.
- [ ] Tag `d0ee8d0` as `v1.0.0` and publish a GitHub Release whose body is the 1.0.0 section of
      `CHANGELOG.md`. That commit is "the current state" the architect named release 1; the tree it
      points at predates `CHANGELOG.md`, which is correct — 1.0.0 is the software as it was before
      this plan.
- [ ] Merging this plan's own pull request must then open a release pull request proposing
      **1.1.0**, not 1.0.1 and not 2.0.0. The first generated release is the release process
      itself.

**Acceptance:** `https://github.com/aniisabihi/atlas290/releases` shows 1.0.0, and `git describe
--tags origin/main` answers `v1.0.0`.
**Verification:** `gh release view v1.0.0`; then, after merge, `gh pr list` shows one
`chore(main): release 1.1.0` pull request.

### Task 5 — Documentation

- [ ] `docs/deployment.md`: replace the current "Release steps" section — which describes a deploy,
      not a release — with both, and say plainly that a deploy happens on every green `main` and a
      release is cut on top of it.
- [ ] `docs/development-workflow.md`: how to get your change into a release (write a Conventional
      Commit; that is the whole of it).
- [ ] `docs/SUMMARY.md`: a row for `CHANGELOG.md`.
- [ ] `CLAUDE.md`: one line under key conventions — the commit subject is the changelog entry.
- [ ] `docs/decisions/0012-releases-and-a-changelog.md` and its row in `docs/decisions/README.md`,
      recording D1–D7 and, honestly, what D4 gives up.

**Acceptance:** nothing in `docs/` still claims the project has no versions, and the pre-PR
checklist in `CLAUDE.md` is satisfied.
**Verification:** `yarn lint`; `grep -rn "Release steps" docs/` returns only the rewritten section.

### Task 6 — The check that keeps the changelog honest

- [ ] A `pr-title` job (in `haus-gate.yml` or its own workflow) asserting the pull request title
      matches `^(feat|fix|chore|docs|refactor|test|style|ci|perf)(\(.+\))?!?: .+`, with a failure
      message naming the allowed types and saying why: **this title becomes the squash commit, and
      the squash commit becomes the changelog entry.**
- [ ] Written as a shell step against `github.event.pull_request.title`, not a third-party action —
      the same reasoning that made Wrangler a pinned devDependency rather than an action.

**Acceptance:** a pull request titled "The place beside the map" fails with a message that tells
the author exactly what to do; one titled `feat(map): the place beside the map` passes.
**Verification:** run the regex locally against all nineteen historical PR titles
(`gh pr list --state merged --limit 30 --json title`) and against synthetic passing cases. Result:
0 of 19 historical titles pass; `feat(map): the place beside the map`, `feat!: rename every
municipality path` and `fix: a thing` pass; `The place beside the map` and `wip` fail.

**This task can be dropped** if the architect would rather trust the convention than enforce it.
Dropping it leaves D3 working and D6 unmet: the changelog would then miss increments silently.

## What this plan does not do

- **No version in the UI.** No footer badge, no `<meta>`, no build stamp. If a released version
  should be visible to a visitor, that is a design decision and gets its own record.
- **No release notes for the data.** D1. The pantry's provenance is already published per table.
- **No changed deploy.** `ci.yml` is untouched. Deploys stay continuous; releases are a label on
  top of them.
- **No backfilled tags.** Plans 1–11 do not get retroactive versions; they have plans and decision
  records, which say more than `v0.7.0` would.
