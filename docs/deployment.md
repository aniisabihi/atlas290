# Deployment

## Hosting

A static site on **Cloudflare Pages**, project `atlas290`, served at
`https://atlas290.pages.dev`. No server, no runtime, no origin to keep alive. The project name is
also the hostname, which is why it is a decision rather than a setting —
[decision 0006](decisions/0006-the-name.md).

Deploys are **pushed from GitHub Actions with Wrangler**, not built by Cloudflare's git
integration. Cloudflare would publish whatever lands on `main` regardless of CI, which means a red
build and a live site could coexist.

## Triggers

| Workflow                          | Trigger                                    | Does                                                         |
| --------------------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| `.github/workflows/ci.yml`        | every pull request; every push to `main`   | Checks, browsers, budget — and on `main` only, deploy        |
| `.github/workflows/haus-gate.yml` | every pull request                         | `haus doctor`, `haus decisions check`, `haus update --check` |
| `.github/workflows/refresh.yml`   | `17 4 1 * *` (monthly) and manual dispatch | Refetches from SCB and opens a data pull request             |
| `.github/workflows/release.yml`   | every push to `main`                       | Keeps the release pull request up to date; on merge, tags    |
| `.github/workflows/pr-title.yml`  | every pull request                         | Fails a title that is not a Conventional Commit              |

A second push to the same ref cancels the first (`concurrency` on `ci.yml`).

## What gates the deploy

The `deploy` job needs **all three** of `check`, `browsers` and `budget`, and runs only on a push
to `main`:

1. **check** — `yarn install --immutable`, `yarn typecheck`, `yarn lint`, `yarn test`,
   `yarn build`, then republishes the pantry and fails if `public/pantry/` changed.
2. **browsers** — `yarn e2e` in Chromium, Firefox and WebKit, including the axe scan. The
   Playwright report is uploaded as an artifact for 7 days.
3. **budget** — builds, serves `dist/`, and runs Lighthouse against `/en/`.

## Deploy steps

A deploy is automatic and continuous. Nothing here is manual.

1. Merge to `main`.
2. `check`, `browsers` and `budget` run; any failure stops the deploy.
3. The deploy job checks whether `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` exist. If they
   do not, it **skips with a notice** rather than failing — a permanently red badge for a step
   nobody has asked for teaches everyone to ignore the badge.
4. `yarn build` runs again with `SITE_ORIGIN=https://${PAGES_PROJECT}.pages.dev`, so `og:image`,
   `canonical` and `hreflang` are absolute and link previews resolve for a crawler.
5. `yarn wrangler pages deploy dist --project-name=atlas290 --branch=main`. Wrangler is a pinned
   devDependency, not a third-party action, so what runs is whatever `yarn.lock` says.

The one-time Cloudflare account, project and token setup — with the minimum permissions — is in
[README.md](../README.md#deploying-it). It has to be done by the repository owner, and nothing in
this repository can or should do it.

## Releases

**A release is not a deploy.** Every green push to `main` is already live; a release is a version
number and a changelog entry put on top of what is live, so a reader can say what changed between
one visit and the next. Full reasoning:
[decision 0012](decisions/0012-releases-and-a-changelog.md).

| Workflow                         | Trigger              | Does                                                              |
| -------------------------------- | -------------------- | ----------------------------------------------------------------- |
| `.github/workflows/release.yml`  | every push to `main` | Keeps one open release pull request; on merge, tags and publishes |
| `.github/workflows/pr-title.yml` | every pull request   | Fails a title that is not a Conventional Commit                   |

How a release happens:

1. Changes land on `main` as Conventional Commits. **The pull request title is the squash commit,
   and the squash commit is the changelog entry** — `pr-title.yml` fails the pull request if that
   title has no type, because the alternative failure is silent: the increment simply never
   appears in the release notes.
2. `release-please` keeps one open pull request, titled `chore(main): release X.Y.Z`, holding the
   generated `CHANGELOG.md` entry, the bumped `package.json` and
   `.release-please-manifest.json`.
3. Review it like any other pull request and merge it. That tags the commit `vX.Y.Z` and publishes
   the GitHub Release.
4. Merging it is a push to `main`, so CI runs and redeploys a site whose content has not changed.
   Harmless.

What the number means — MAJOR is a published URL that stopped working, and nothing else; the
monthly data refresh does not cut a release at all. Both are stated at the top of
[CHANGELOG.md](../CHANGELOG.md).

> The release pull request is opened by the default `GITHUB_TOKEN`, and a pull request opened by
> that token does not start other workflows — so **CI and the haus gate do not run on it**. It
> touches three files that cannot break a build, and merging it runs the full pipeline. Decision
> 0012 records what that gives up and why a personal access token was not the answer.

## Artifacts

| Artifact                         | Where it lands                                                 |
| -------------------------------- | -------------------------------------------------------------- |
| Site bundle + 583 HTML documents | `dist/`, uploaded to Cloudflare Pages                          |
| Playwright report                | Actions artifact `playwright-report`, 7 days                   |
| Lighthouse result                | Written by `tools/lighthouse-budget.mjs` during the budget job |

## Environment differences

The only difference between a local build and the deployed one is `SITE_ORIGIN`. Unset (local) the
head tags are root-relative, which is correct for the site and invisible to a crawler; set (deploy)
they are absolute. The build prints which it did on every run. There is no staging environment.

## Post-deploy verification

> CONFIRM-WITH-TEAM: no automated post-deploy smoke check exists. Nothing in the workflows probes
> the live URL after `wrangler pages deploy` returns.

Manually: load `https://atlas290.pages.dev/en/`, confirm the map draws, open a municipality page
such as `/en/malmo-1280/`, and check that a pasted link shows its preview card.

## Rollback

> CONFIRM-WITH-TEAM: no rollback procedure is defined in this repository. Cloudflare Pages keeps
> previous deployments and can roll back from its dashboard, and reverting the commit on `main`
> re-runs the pipeline — but neither is written down as the agreed procedure.

## The monthly refresh

`refresh.yml` is the only automated caller of `yarn kitchen fetch`. It:

1. Keeps a copy of the committed pantry to compare against.
2. Fetches from SCB, publishes, and runs `tools/pantry-guard.mjs` — which **fails** if the count of
   actual observations has fallen at all. A genuine SCB withdrawal therefore stops the job and a
   person looks at it, which is the intended outcome.
3. Runs typecheck, lint, tests and build exactly as a pull request would.
4. Opens a pull request on a `data/refresh-YYYY-MM-DD` branch if anything changed. Data arrives as
   a readable diff, never as a silent change to a live site.
5. Appends one line to `docs/refresh-log.md` and commits it — **whether or not the data changed,
   and even if the job failed**. GitHub disables scheduled workflows in a public repository after
   60 days without activity, which would silence the very job whose failures are the warning.

## See also

- [development-workflow.md](development-workflow.md) — the checks, locally
- [setup.md](setup.md#environment) — every variable and secret, and what reads it
