# Setup

Local development for Atlas 290. The repo is self-contained: the published data it renders is
committed, so nothing has to be fetched, built or served before the site will run.

## Prerequisites

| Requirement         | Version                   | Notes                                                                                                 |
| ------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------- |
| Node                | ≥ 22 (`engines`)          | `.nvmrc` pins the version used in CI                                                                  |
| Yarn                | 4.18.0 (`packageManager`) | Installed by Corepack — `corepack enable`, do not install Yarn globally                               |
| Playwright browsers | on demand                 | `yarn playwright install chromium firefox webkit`, only for `yarn e2e` / `yarn cards` / `yarn budget` |

## Related systems

None. No database, no queue, no cache, no search index, no runtime API. The site fetches six JSON
files from its own origin (`src/data/pantry.ts`) and nothing else.

The one external system in the project is **Statistics Sweden's PxWeb v2 API**, and only
`yarn kitchen fetch` ever contacts it (`kitchen/src/scb/client.ts`). Everything else, including
the whole of `yarn build`, works offline.

## Install

```bash
corepack enable
yarn install
```

CI uses `yarn install --immutable`, so a change that would rewrite `yarn.lock` fails there.

## Environment

There is **no `.env.example` and no runtime environment at all** — nothing in `src/` reads
`process.env` or `import.meta.env`. The variables below are build-time and CI-time only.

| Variable                | Purpose                                                                                                                                                                                                                | Used by                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `SITE_ORIGIN`           | Absolute origin for `og:image`, `canonical` and `hreflang` on the 580 municipality pages. Unset is valid: the tags stay root-relative, correct for the site and invisible to a crawler. The build prints which it did. | `tools/build-pages.mjs` (`origin()`)   |
| `PAGES_PROJECT`         | The Cloudflare Pages project name, which is also the hostname. Declared once so the deploy target and `SITE_ORIGIN` cannot drift — see [decision 0006](decisions/0006-the-name.md).                                    | `.github/workflows/ci.yml`, deploy job |
| `CLOUDFLARE_API_TOKEN`  | Repository secret. Absent → the deploy job skips with a notice rather than failing.                                                                                                                                    | `.github/workflows/ci.yml`, deploy job |
| `CLOUDFLARE_ACCOUNT_ID` | Repository secret, as above.                                                                                                                                                                                           | `.github/workflows/ci.yml`, deploy job |
| `CI`                    | Set by GitHub Actions. Switches Playwright to `forbidOnly`, one retry, and the GitHub reporter.                                                                                                                        | `playwright.config.ts`                 |

Creating the two Cloudflare secrets is a one-time human task, with the exact minimum permissions,
in [README.md](../README.md#deploying-it). Never paste a token into an issue, a pull request, or a
chat with an assistant.

## Run locally

```bash
yarn dev
```

Then open `/sv/` or `/en/`. The bare root is a static language picker that redirects on the
visitor's `navigator.languages`.

A municipality page is `/{lang}/{slug}-{code}/`, for example `/en/malmo-1280/`. In production
those 580 files exist on disk; under `yarn dev` a Vite middleware in `vite.config.ts` serves them
from the language entry page, and 404s an unknown code exactly as a static host would.

## Verify

1. `yarn dev` → `/en/` draws a choropleth of 290 municipalities with a legend and a year slider.
2. `/en/malmo-1280/` opens with Malmö selected and its own title; `/en/atlantis-9999/` returns 404.
3. `yarn test` — two Vitest projects, `kitchen` and `site`.
4. `yarn typecheck` — three TS projects, all clean.
5. `yarn kitchen publish` leaves `git status public/pantry/` empty. This is the pipeline's central
   promise and CI checks it on every run.

## Troubleshooting

| Symptom                                                                      | Cause and fix                                                                                                                                                  |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pantry files missing; run yarn kitchen publish`                             | A pantry file under `public/pantry/` is absent or unreadable. Run `yarn kitchen publish` (offline, no SCB needed).                                             |
| `…municipalities.topo.json has no objects.municipalities.geometries array`   | The topology file is truncated or corrupt; republish as above.                                                                                                 |
| A municipality URL 404s in dev but the front page works                      | The four-digit code is not in the pantry. The code is the identifier; the slug is decoration (`shared/slug.ts`).                                               |
| Yarn refuses to install, or installs the wrong version                       | `corepack enable` first — the pinned Yarn 4 comes from `packageManager`, not from a global install.                                                            |
| `yarn e2e` cannot launch a browser                                           | `yarn playwright install --with-deps chromium firefox webkit`.                                                                                                 |
| CI fails with "Publishing from the committed frozen data changed the pantry" | A kitchen change altered published output. Commit the regenerated pantry with the code change, and read the diff.                                              |
| A browser test times out on `page.goto`, a different one each run            | Not your change. Firefox loses a navigation when `Cross-Origin-Opener-Policy` swaps the browsing-context group — [runbook.md](runbook.md) has the whole of it. |
| Link previews show no card                                                   | Expected locally: `SITE_ORIGIN` is unset, so `og:image` is root-relative. The deploy sets it.                                                                  |

## See also

- [development-workflow.md](development-workflow.md) — where to change what, and the quality gates
- [kitchen.md](kitchen.md) — running the data pipeline, table by table
- [deployment.md](deployment.md) — how a commit reaches the live site
