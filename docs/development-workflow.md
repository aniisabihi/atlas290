# Development workflow

## Scope of this repo

Everything: the data pipeline, the site, the build, the tests and the deploy. There is no second
repository and no external service to coordinate with.

## Common changes

**A site change** — edit under `src/`, run `yarn test` and `yarn typecheck`, and run `yarn e2e`
if behaviour, markup, keyboard handling or routing moved. The pantry is untouched.

**A kitchen change** — edit under `kitchen/src/`, then `yarn kitchen publish` (offline) and commit
the regenerated `public/pantry/` **in the same commit**. CI republishes and fails on any diff, so
a kitchen change that forgets this is caught, not shipped.

**A data refresh** — normally nobody does this by hand. The monthly workflow fetches, publishes,
guards against loss, runs the full suite and opens a pull request. To do it locally:
`yarn kitchen all` (this is the one command that reaches SCB).

**A new indicator** — a module under `kitchen/src/indicators/` plus an entry in `registry.ts`; the
shared context handles fetching, freezing and checking. See [conventions.md](conventions.md).

**A decision** — anything that changes a decision in [DESIGN.md](DESIGN.md) gets a dated record in
[decisions/](decisions/README.md). The haus gate checks that a decision-worthy diff carries one.

## Where to change what

The full table is in [codebase.md](codebase.md#where-to-change-what). The three rules behind it:

- The pantry's shape is defined once, in `shared/pantry.ts`, and read once, in `src/data/select.ts`.
- The URL grammar is defined once, in `src/state/url.ts`; the path grammar for a municipality page
  is defined once, in `shared/slug.ts`, and shared with the page generator.
- Strings live in `src/i18n/strings.ts` for the site's own chrome, and in the pantry for anything
  describing an indicator.

## Quality checks

| Command          | What it covers                                                             |
| ---------------- | -------------------------------------------------------------------------- |
| `yarn typecheck` | Three TS projects: app (`src` + `shared`), kitchen (+ spikes), e2e         |
| `yarn lint`      | oxlint (`correctness` = error, `suspicious` = warn) and `prettier --check` |
| `yarn test`      | Vitest, two projects — `kitchen` in Node, `site` in jsdom                  |
| `yarn build`     | Typecheck + Vite build + the 580 municipality pages                        |
| `yarn e2e`       | Playwright against `dist/` in Chromium, Firefox and WebKit                 |
| `yarn budget`    | Lighthouse against the served build, with measured thresholds              |

**No pre-commit hook is installed** — no lefthook, no husky. The gate is CI, and the checklist in
[CLAUDE.md](../CLAUDE.md#before-opening-a-pr) before you open a pull request.

`.claude/settings.json` installs haus hooks for Claude Code sessions (file and bash guards, a
decision-record guard, a session-start update check). Those are agent guardrails, not git hooks.

## Regenerating artifacts

| Artifact         | Command                | Notes                                                                                                                                                                                                                                  |
| ---------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/pantry/` | `yarn kitchen publish` | Offline. Must be byte-identical on a rebuild; commit with the change.                                                                                                                                                                  |
| `kitchen/raw/`   | `yarn kitchen fetch`   | The only command that reaches SCB. Already-frozen chunks are skipped.                                                                                                                                                                  |
| `public/share/`  | `yarn cards`           | **Not** part of the build: text renders differently on macOS and Linux, so CI would diff on every run. Run it when the design changes or a municipality is added; the cards carry no figures, so data refreshes never invalidate them. |
| `dist/`          | `yarn build`           | Never committed.                                                                                                                                                                                                                       |

None of these are hand-edited. Ever.

## Testing notes

Tests sit beside the code they cover. Two Vitest environments are deliberate: a jsdom global
leaking into the kitchen would let a Node module start depending on a browser API that will not
exist when the pipeline runs, and `kitchen/src/no-dom.test.ts` asserts the separation.

The browser suite runs against the **built** site via `yarn preview`, not the dev server, and in
three engines — keyboard behaviour in particular differs, and a WebKit-only pass has already
misled this project once. Coverage and its gaps: [accessibility.md](accessibility.md).

## Verify before you push

```bash
yarn typecheck && yarn lint && yarn test && yarn build
yarn kitchen publish && git status --porcelain public/pantry/   # must print nothing
```

## See also

- [setup.md](setup.md) — install, environment, troubleshooting
- [deployment.md](deployment.md) — what CI runs and how a commit reaches the live site
- [kitchen.md](kitchen.md) — the pipeline in detail
- [plans/](plans/README.md) — how each increment was planned and what it delivered
