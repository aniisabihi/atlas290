# Runbook

One entry per non-obvious failure, with what it looked like and what fixed it. Failures whose
message already says what to do do not belong here.

## release-please fails: "not permitted to create or approve pull requests"

**Symptom:** the Release workflow fails on the first run after a merge to `main`. Everything in the
log looks right — it resolves the next version, builds the changelog entry, creates the branch and
commits to it — and then:

```
release-please failed: GitHub Actions is not permitted to create or approve pull requests.
```

**Cause:** a repository setting, not anything in `release-please-config.json`. GitHub ships
**Settings → Actions → General → Workflow permissions → "Allow GitHub Actions to create and
approve pull requests"** switched off by default. Despite the name, that one checkbox governs
_creating_ pull requests as well as approving them, and no `permissions:` block in the workflow can
override it — `pull-requests: write` grants the token the scope, and the repository setting still
refuses the call.

**Fix:** tick the checkbox, or:

```bash
gh api -X PUT repos/<owner>/<repo>/actions/permissions/workflow \
  -f default_workflow_permissions=read \
  -F can_approve_pull_request_reviews=true
```

Pass `default_workflow_permissions` as it already reads (`gh api
repos/<owner>/<repo>/actions/permissions/workflow`) — the `PUT` replaces the whole object, so
omitting it silently widens the default token for every workflow in the repository.
`release.yml` declares its own `contents: write` and `pull-requests: write`, so the default stays
`read`.

Then re-run the failed run — the release branch it already pushed is reused, nothing is lost:

```bash
gh run rerun <run-id>
```

**Seen:** 2026-09-17, the first run of `release.yml` after
[decision 0012](decisions/0012-releases-and-a-changelog.md). Nothing in the setup could have
caught it earlier: the workflow cannot run until it is on `main`, and on `main` its first run is
the real one.

## `yarn lint` fails on `main` right after a release merges

**Symptom:** the release pull request merges cleanly (it carries no checks of its own — see
[decision 0012](decisions/0012-releases-and-a-changelog.md)), and then CI on `main` fails at
`yarn lint`:

```
[warn] CHANGELOG.md
[warn] Code style issues found in the above file.
```

The deploy is gated behind `check`, so `main` is red and the site does not update.

**Cause:** release-please writes `CHANGELOG.md` in its own Markdown dialect — `*` bullets,
unwrapped lines — which is not what `prettier` produces. Nothing in the repository can reformat it
first: it arrives inside release-please's own commit, on release-please's own branch, and the
release pull request runs no workflows that could fix it.

**Fix:** `CHANGELOG.md` is listed in `.prettierignore`. If that line is ever removed, every release
from then on turns `main` red on merge.

**Seen:** 2026-09-17, caught by running `prettier --check` against the generated file on the
release branch before the first release pull request was merged. It would otherwise have failed on
`main`, after the release, on every release.

## `page.goto` never returns, in Firefox, on a page that has clearly loaded

**Symptom:** a browser test fails with a timeout on its first navigation, and the call log says the
navigation simply never finished:

```
Error: page.goto: Test timeout of 30000ms exceeded.
Call log:
  - navigating to "http://localhost:4173/en/atlantis-9999/", waiting until "load"
```

A different test every run, Firefox and WebKit but never Chromium, and a re-run of the same commit
goes green. Read at the moment it fails, the page is fine: `document.readyState` is `complete`,
the `load` event has already fired, and no request is in flight.

**Cause:** `Cross-Origin-Opener-Policy: same-origin`, which `dist/_headers` serves and the preview
server replays. A page starts life at `about:blank`, which carries no COOP; its first navigation to
a document that does swaps the browsing-context group, and Playwright's Firefox driver
intermittently loses the navigation. It is a hang, not slowness — measured against a 90-second
ceiling on a median of 27 ms — so no timeout rescues it. Only the first navigation of a page is at
risk, which is why the culprit was never one test: every test navigates once.

**Fix:** already in place. `playwright.config.ts` gives the Firefox project
`firefoxUserPrefs: { 'browser.tabs.remote.useCrossOriginOpenerPolicy': false }`. The site still
serves the header and `e2e/headers.spec.ts` still asserts it arrives; only the test browser stops
acting on it. If that line is ever removed, this comes back — see
[decision 0017](decisions/0017-the-flake-was-a-security-header.md).

**Seen:** five CI runs across PRs #23, #25, #29 and #30, filed as
[issue #26](https://github.com/aniisabihi/atlas290/issues/26), diagnosed 2026-09-18 by serving each
response header on its own from a bare Node server: COOP alone reproduced it 29 times in 150 fresh
pages, every other header 0.
