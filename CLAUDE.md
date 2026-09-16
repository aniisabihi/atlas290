<!-- HAUS:BEGIN haus-imports v=1 -->

@.haus-workflow/WORKFLOW.md
@.haus-workflow/workflow-config.md
@docs/decisions/README.md
<!-- HAUS:END haus-imports -->

# Atlas 290

An interactive atlas of Sweden's 290 municipalities, built entirely from Statistics Sweden (SCB)
open data. Two programs live in this repo: **the kitchen**, an offline Node pipeline that fetches
and freezes SCB responses and publishes a static data "pantry"; and **the site**, a React + Vite
front end that reads only those committed files. Static output, no server, no runtime API, no
tracking.

## Setup

Node 22+ and Corepack (Yarn 4 is pinned in `package.json`). No database, no services, no `.env` —
the site reads the pantry committed under `public/pantry/`, so it runs with no network access.

```bash
corepack enable && yarn install && yarn dev
```

Detail, environment variables and troubleshooting: [docs/setup.md](docs/setup.md).

## Commands

| Command                | Action                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `yarn dev`             | Vite dev server; open `/sv/` or `/en/` (the bare root redirects)                      |
| `yarn build`           | Typecheck the app, build into `dist/`, then write the 580 municipality pages          |
| `yarn preview`         | Serve `dist/` exactly as a static host would                                          |
| `yarn test`            | Vitest — two projects, `kitchen` (Node) and `site` (jsdom)                            |
| `yarn typecheck`       | All three TS projects: app, kitchen, e2e                                              |
| `yarn lint`            | oxlint plus `prettier --check`                                                        |
| `yarn format`          | `prettier --write`                                                                    |
| `yarn e2e`             | Playwright against the built site in Chromium, Firefox and WebKit                     |
| `yarn kitchen fetch`   | The only command allowed to reach SCB; freezes responses under `kitchen/raw/`         |
| `yarn kitchen publish` | Rebuilds `public/pantry/` from frozen responses, offline and deterministically        |
| `yarn cards`           | Redraws the 290 preview cards in `public/share/` — deliberately not part of the build |
| `yarn budget`          | Lighthouse against the built site, with a measured budget                             |

## Key conventions

- **The URL is the state.** Everything the site renders is a function of path plus query string
  (`src/state/url.ts`, `src/state/useAppState.ts`). New view state belongs in the URL unless it is
  genuinely not worth sharing — playback, morph progress and pointer hover are the three
  documented exceptions.
- **Two programs, one repo.** The kitchen is Node-only and must never depend on a DOM; the site is
  browser-only. `shared/` is the only code both may import, so it may import nothing that needs
  either. `vitest.config.ts` splits the environments to keep this honest.
- **Generated, committed, never hand-edited:** `public/pantry/` (regenerate with
  `yarn kitchen publish`), `kitchen/raw/` (frozen SCB responses, from `yarn kitchen fetch`),
  `public/share/` (`yarn cards`), `dist/`.
- **Determinism is a requirement.** Publishing twice from the same frozen responses must produce
  byte-identical files; CI fails on any pantry diff. Ordering uses `kitchen/src/cmp.ts`, never
  `localeCompare`.
- **Only `yarn kitchen fetch` touches the network.** `publish()` refuses to, and the monthly
  refresh workflow is the only automated caller of `fetch`.
- **No verdicts.** There is no "higher is better" flag anywhere, and `src/data/compare.ts` will not
  add one. Similar municipalities are a set, never a ranking.
- **Both languages or neither.** `src/i18n/strings.ts` types English against Swedish, so a string
  added to one language fails `yarn typecheck`. Indicator prose comes from the pantry, in both
  languages, written by the kitchen.
- **Accessibility is a check, not an intention.** axe runs in CI across three engines; what is and
  is not covered is stated in [docs/accessibility.md](docs/accessibility.md).
- **Decisions get a record.** Anything that changes a decision in `docs/DESIGN.md` gets a dated
  file in [docs/decisions/](docs/decisions/README.md).
- **Docs are an index:** use path references in `docs/`; read source for implementation detail.
- **Keep docs in sync:** after setup, commands, env, deploy, or integration changes, run the
  **writing-documentation** skill in this repo and commit the doc updates with the code change.

## Before opening a PR

- [ ] `yarn typecheck && yarn lint && yarn test && yarn build`
- [ ] `yarn e2e` when behaviour, markup, keyboard handling or routing changed
- [ ] `yarn kitchen publish` leaves `public/pantry/` unchanged (CI enforces this)
- [ ] A decision record under `docs/decisions/` when a DESIGN decision changed (or N/A)
- [ ] Run the **writing-documentation** skill when setup, commands, env, deploy or integrations
      changed (or N/A)
- [ ] Docs reflect this change or explicitly N/A

## Docs

[docs/SUMMARY.md](docs/SUMMARY.md)
