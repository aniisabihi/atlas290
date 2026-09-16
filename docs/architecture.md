# Architecture

Two programs in one repository, joined by a committed data directory and nothing else.

```
SCB PxWeb v2 API
      │  (only `yarn kitchen fetch`)
      ▼
kitchen/raw/<table>/<lang>/*.json      frozen responses, committed
      │  (`yarn kitchen publish`, offline, deterministic)
      ▼
public/pantry/**                        the pantry: six JSON files, committed
      │  (`fetch()` at runtime, validated with zod)
      ▼
the site (React 19 + Vite 8)  ──build──▶ dist/ ──▶ Cloudflare Pages (static)
```

## Runtime model

**The deployed site is a single-process static bundle.** No server, no runtime API, no database,
no scheduler. Three entry documents are built (`vite.config.ts` `rollupOptions.input`): the root
language picker, `/sv/` and `/en/`. After the Vite build, `tools/build-pages.mjs` writes 580 more
HTML files — one per municipality per language — by rewriting each language page's `<head>`. Every
one of them loads the same bundle and the same pantry.

**The kitchen is a separate Node CLI** (`kitchen/src/cli.ts`, `yarn kitchen <fetch|publish|all>`)
that never runs in production. It is a build-time program whose output is committed.

**Scheduled work** is a GitHub Actions job, not a process: `.github/workflows/refresh.yml` runs the
kitchen monthly and opens a pull request. See [deployment.md](deployment.md).

## Core components

| Component          | Where                                                            | Role                                                                                       |
| ------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| SCB client         | `kitchen/src/scb/`                                               | PxWeb v2 requests, cell-limit splitting, rate limiting, response freezing                  |
| Indicator registry | `kitchen/src/indicators/registry.ts`                             | Every indicator's definition and the one pipeline that drives them all                     |
| Check stage        | `kitchen/src/check.ts`, `breaks.ts`                              | Rejects implausible values and flags parent-municipality breaks before anything is written |
| Publisher          | `kitchen/src/publish.ts`                                         | Builds the pantry into a scratch dir, verifies, then lands it atomically                   |
| Geometry builder   | `kitchen/src/geometry/`                                          | Topology, keyboard adjacency, Dorling bubble layout                                        |
| Similarity builder | `kitchen/src/similar/`                                           | Standardise → distance → five nearest, per municipality                                    |
| Facts engine       | `kitchen/src/facts/`                                             | Five families of candidate fact, ranked and phrased in both languages                      |
| Pantry contract    | `shared/pantry.ts` (zod), `shared/geometry.ts`, `shared/slug.ts` | The only code both programs import                                                         |
| Site data layer    | `src/data/`                                                      | Loads and validates the pantry; the one place that knows its columnar layout               |
| URL state          | `src/state/url.ts`, `useAppState.ts`                             | Parses and writes the whole application state                                              |
| Render layer       | `src/components/`, `src/map/`                                    | Map, cartogram and the morph between them; panels, table, legend                           |

## Extension model

Domain logic is organised as **indicator definitions in a registry**, not as a pipeline per
indicator. Adding a measure means adding a module under `kitchen/src/indicators/` and registering
it in `registry.ts`; the shared context supplies fetching, freezing, code-history fixes, CKM
stitching and checking. One indicator (`population-change`, in `derived.ts`) fetches nothing and is
computed from another's built series.

The site has no plugin model. Views are components composed by `src/components/App.tsx`, and every
one of them is driven by the single `AppState`.

Full inventory: [codebase.md](codebase.md). Registration mechanics: [conventions.md](conventions.md).

## Data flow

**Build-time (the kitchen):**

1. `fetch` — `buildAll()` drives each registered indicator's own fetch against SCB; each response
   chunk is frozen under `kitchen/raw/<table>/<lang>/<selectionKey>.json`.
2. `publish` — reads only `kitchen/raw/`; builds geometry into a scratch directory, joins the
   topology's municipality codes against the statistics' codes and aborts on any mismatch, runs the
   check stage over every built indicator, rounds to each unit's honest precision, and only then
   writes `public/pantry/`. A failing check leaves nothing on disk.
3. `yarn build` — Vite builds three documents, then `tools/build-pages.mjs` writes the 580
   municipality pages with their own titles, descriptions and preview tags.

**Runtime (the site):**

1. `src/main.tsx` calls `loadPantry()`, which fetches the six pantry files in parallel and validates
   five of them against zod schemas (the topology gets a structural check — see the note in
   `src/data/pantry.ts`).
2. `App` parses the URL into `AppState` (`src/state/url.ts`) and renders everything from it.
3. An interaction calls `update()`, which writes a new URL through `history.pushState` (or
   `replaceState` during playback) — state and address bar cannot disagree.

## Integration boundaries

| External system  | Reached by                                                 | Configured with                                                              |
| ---------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| SCB PxWeb v2 API | `kitchen/src/scb/client.ts`, only via `yarn kitchen fetch` | Nothing — table ids and content codes resolve from each table's own metadata |
| Cloudflare Pages | `wrangler pages deploy` in `.github/workflows/ci.yml`      | `PAGES_PROJECT`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`             |
| GitHub Actions   | `.github/workflows/`                                       | Repository secrets only                                                      |

The site itself integrates with nothing at runtime, and sets no cookies and no analytics.

## Schema evolution

There are no database migrations. The published data has two contracts, both in `shared/`:

- `shared/pantry.ts` — zod schemas for the pantry files. The absence-status enum is **append-only**:
  the index is a status byte persisted in every published series, so inserting or reordering would
  silently relabel every cell.
- `shared/geometry.ts` — the projection and render frame, which must be byte-identical in the
  kitchen and the browser.

A change to either means republishing the pantry in the same commit. CI proves the rebuild is
byte-identical, so a schema change that is not republished fails the build rather than shipping.

## See also

- [DESIGN.md](DESIGN.md) — why the architecture is this shape, and what is still open
- [decisions/](decisions/README.md) — every decision taken since the first increment
- [kitchen.md](kitchen.md) — every SCB table, content code and coverage range
