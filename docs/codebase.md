# Codebase map

A routing index, not a copy of the source. Every module here carries a doc comment explaining why
it exists; read that before changing it.

## Top-level directories

| Path                       | Purpose                                                                       |
| -------------------------- | ----------------------------------------------------------------------------- |
| `src/`                     | The site. Browser-only; may not import Node APIs.                             |
| `kitchen/src/`             | The data pipeline. Node-only; may not import DOM APIs.                        |
| `kitchen/raw/`             | **Generated, committed.** Frozen SCB responses, one file per fetched chunk.   |
| `kitchen/fixtures/`        | Small hand-made JSON-stat fixtures for the kitchen's tests.                   |
| `kitchen/spikes/`          | One-off investigation scripts kept as a record of how facts were learned.     |
| `shared/`                  | The only code both programs import. May import nothing needing a DOM or Node. |
| `tools/`                   | Build-time and CI Node scripts (`.mjs`), run through `yarn`.                  |
| `e2e/`                     | Playwright specs, run against the built site in three engines.                |
| `public/`                  | Served verbatim. Contains the pantry and the 290 preview cards.               |
| `sv/`, `en/`, `index.html` | The three entry documents Vite builds.                                        |
| `docs/`                    | This documentation, plus DESIGN, decisions, plans and the research record.    |
| `dist/`                    | **Generated.** Build output; never edited, never committed.                   |

## Entry points and wiring

| File                                 | Role                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------- |
| `src/main.tsx`                       | Browser entry: loads the pantry, then renders `App`.                                |
| `src/components/App.tsx`             | The shell. Composes every view from one `AppState`.                                 |
| `kitchen/src/cli.ts`                 | `yarn kitchen <fetch\|publish\|all>`.                                               |
| `kitchen/src/indicators/registry.ts` | **The central registry.** Every indicator is registered here.                       |
| `vite.config.ts`                     | Three build inputs, plus the dev/preview middleware for municipality paths.         |
| `vitest.config.ts`                   | Two test projects: `kitchen` (Node) and `site` (jsdom).                             |
| `playwright.config.ts`               | Builds the site and serves `dist/`; three engines.                                  |
| `tsconfig.json`                      | References the three TS projects; `tsconfig.base.json` holds the shared strictness. |

## The site — `src/`

| Path                                                  | Purpose                                                                                 |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `state/url.ts`                                        | The URL grammar. Parses path + query into `AppState` and back.                          |
| `state/useAppState.ts`                                | The only place that writes history.                                                     |
| `state/title.ts`                                      | The tab title for a given state.                                                        |
| `state/useMorph.ts`                                   | The clock driving the map↔cartogram morph. Deliberately not in the URL.                 |
| `state/useTween.ts`                                   | The clock that carries the bubbles to a new year's sizes or a new indicator's layout.   |
| `state/useMediaQuery.ts`, `state/useReducedMotion.ts` | Media queries read in JS where the difference is behavioural.                           |
| `data/pantry.ts`                                      | Loads the index, then each series as it is needed.                                      |
| `test/pantry.ts`                                      | Test-only: the published pantry, reassembled from its files.                            |
| `data/select.ts`                                      | The only module that knows the pantry's columnar layout.                                |
| `data/compare.ts`                                     | Two municipalities side by side, with no verdict.                                       |
| `data/similar.ts`                                     | Reads "places like this" from the published file; computes nothing.                     |
| `data/nominal.ts`                                     | Recovers the figure SCB actually published from the inflation-adjusted one.             |
| `map/geometry.ts`                                     | Projected shapes and centroids, computed once per topology.                             |
| `map/frame.ts`                                        | Puts an indicator's bubble layout in the map's coordinate system.                       |
| `map/morph.ts`                                        | Equal-length point lists so an outline can interpolate into whatever circle is current. |
| `map/colour.ts`                                       | The colour scale, and what absence looks like.                                          |
| `map/navigate.ts`                                     | Re-exports `shared/navigate.ts`, where arrow-key movement lives since Plan 21.          |
| `facts/facts.ts`                                      | Reads the five facts from the pantry.                                                   |
| `profile/story.ts`                                    | A municipality's story in sentences, generated from rules.                              |
| `search/match.ts`                                     | Finding a municipality by name.                                                         |
| `i18n/strings.ts`                                     | Every chrome string, both languages, English typed against Swedish.                     |
| `i18n/format.ts`                                      | Numbers and units, both locales, sharing the kitchen's `UNIT_DECIMALS`.                 |
| `notices/packages.ts`                                 | The runtime dependency tree with licences, shown on the notices page.                   |
| `styles/tokens.css`, `styles/app.css`                 | Design tokens and layout. `tokens.test.ts` asserts real contrast ratios.                |
| `components/`                                         | See below.                                                                              |

### Components — `src/components/`

| Component         | Purpose                                                                   |
| ----------------- | ------------------------------------------------------------------------- |
| `App`             | The shell; everything is a function of the URL.                           |
| `MapCanvas`       | Map and cartogram as one thing, with the 290 shapes travelling between.   |
| `Legend`          | The classes with their real break values and the absence keys that occur. |
| `NoDataPatterns`  | The four absence patterns, defined once for the whole page.               |
| `IndicatorPicker` | A native select for the measure.                                          |
| `YearSlider`      | A native range input, plus play.                                          |
| `SearchBox`       | The ARIA 1.2 combobox pattern.                                            |
| `ProfilePanel`    | Everything the pantry knows about one municipality. Not a dialog.         |
| `ProfileStory`    | That municipality in words.                                               |
| `SimilarPlaces`   | The five most similar places, presented as a set and never a ranking.     |
| `ComparePanel`    | Two municipalities, no winner.                                            |
| `DataTable`       | The plain sortable twin of whatever view is showing.                      |
| `FactsStrip`      | Five found facts, each a real link into the state that proves it.         |
| `Sparkline`       | One indicator's whole history for one municipality.                       |
| `AboutIndicator`  | The fine print: description, caveat, derivation, sources.                 |
| `Notices`         | Sources and licences, on the page.                                        |
| `LiveRegion`      | One debounced polite live region for the page.                            |
| `LanguageSwitch`  | A real link — the languages are separate documents.                       |
| `EmptyYear`       | What the map says when the chosen year has no data.                       |
| `SmokeProbe`      | Proves the component test environment is real.                            |

## The kitchen — `kitchen/src/`

| Path                       | Purpose                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| `cli.ts`                   | The three stages.                                                                         |
| `indicators/registry.ts`   | The registry and the shared build context every indicator uses.                           |
| `indicators/population.ts` | Population; also owns the CKM cutover between the old and new tables.                     |
| `indicators/derived.ts`    | `population-change`, computed from population — fetches nothing.                          |
| `indicators/tax.ts`        | Municipal tax rate, 2000–2026.                                                            |
| `indicators/density.ts`    | Inhabitants per km², and land area.                                                       |
| `indicators/migration.ts`  | Net migration rate, stitched across three tables.                                         |
| `indicators/income.ts`     | Median income, inflation-adjusted.                                                        |
| `indicators/housing.ts`    | House prices, with a minimum-sale-count rule.                                             |
| `indicators/education.ts`  | Post-secondary education share.                                                           |
| `indicators/cpi.ts`        | The national CPI deflator — the one table with no `Region` dimension.                     |
| `municipalities.ts`        | The 290, their codes, and the code-history fixes SCB's data needs.                        |
| `scb/client.ts`            | PxWeb v2 requests, cell-limit splitting, rate limiting.                                   |
| `scb/freeze.ts`            | Writing and reading frozen response chunks.                                               |
| `scb/jsonstat.ts`          | Parsing JSON-stat into series.                                                            |
| `check.ts`, `breaks.ts`    | The check stage, and parent-municipality break years.                                     |
| `geometry/build.ts`        | Topology from the SCB boundary shapefile.                                                 |
| `geometry/adjacency.ts`    | Keyboard adjacency, including curated edges with recorded reasons.                        |
| `geometry/bubbles.ts`      | One Dorling layout per indicator, deterministic, proven reachable before it is published. |
| `geometry/props.ts`        | Validated `{ code, name }` extraction from a geometry's properties.                       |
| `similar/standardise.ts`   | Ten units into comparable numbers.                                                        |
| `similar/distance.ts`      | The metric itself, knowing nothing about indicators.                                      |
| `similar/build.ts`         | Five nearest per municipality.                                                            |
| `facts/families.ts`        | The five families of fact and how each ranks candidates.                                  |
| `facts/build.ts`           | One fact per family, assembled.                                                           |
| `facts/phrasing.ts`        | Candidate → sentence, written out in both languages.                                      |
| `stats.ts`                 | The arithmetic behind the facts, and nothing else.                                        |
| `round.ts`                 | Rounding to the precision each unit honestly carries.                                     |
| `cmp.ts`                   | Structural ordering for anything whose order lands in a committed file.                   |
| `publish.ts`               | Assembles, verifies and lands the pantry; `writePantryParts` / `readPantryParts`.         |
| `no-dom.test.ts`           | Asserts the kitchen depends on no browser API.                                            |

## Shared — `shared/`

| File          | Purpose                                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `pantry.ts`   | zod schemas for every pantry file, plus `splitPantry`/`assemblePantry`, which are inverse. The absence-status enum is append-only. |
| `geometry.ts` | The projection and render frame, identical on both sides.                                                                          |
| `slug.ts`     | The `name-code` path grammar. The code is the identifier; the slug is decoration.                                                  |
| `bubbles.ts`  | How a value becomes a bubble: the one sizing rule the kitchen lays out with and the site draws with.                               |
| `navigate.ts` | Arrow-key movement, and `strandedIn`, which the kitchen proves every layout with and the site navigates by.                        |

## Tools — `tools/`

| File                    | Run by               | Purpose                                               |
| ----------------------- | -------------------- | ----------------------------------------------------- |
| `read-pantry.mjs`       | the three below      | Reassembles the pantry from its files, in plain JS.   |
| `build-pages.mjs`       | `yarn build`         | The 580 municipality pages, with their own head tags. |
| `build-cards.mjs`       | `yarn cards`         | The 290 preview PNGs. Deliberately outside the build. |
| `pantry-guard.mjs`      | the refresh workflow | Refuses a refresh that loses observations.            |
| `lighthouse-budget.mjs` | `yarn budget`        | Measured budget, root and a municipality page.        |

## Generated — do not hand-edit

| Path             | Regenerate with        |
| ---------------- | ---------------------- |
| `public/pantry/` | `yarn kitchen publish` |
| `kitchen/raw/`   | `yarn kitchen fetch`   |
| `public/share/`  | `yarn cards`           |
| `dist/`          | `yarn build`           |

## Where to change what

| Task                                 | Start here                                   | Also touch                                                                  |
| ------------------------------------ | -------------------------------------------- | --------------------------------------------------------------------------- |
| Add or change an indicator           | `kitchen/src/indicators/` + `registry.ts`    | Republish the pantry; [kitchen.md](kitchen.md)                              |
| Change what a published number means | the indicator module, `check.ts`, `round.ts` | A decision record; republish                                                |
| Change the pantry's shape            | `shared/pantry.ts`                           | `kitchen/src/publish.ts`, `src/data/select.ts`; republish                   |
| Add state to the URL                 | `src/state/url.ts`                           | `useAppState.ts`, `state/title.ts`, the e2e specs                           |
| Change the map, cartogram or morph   | `src/map/`, `src/components/MapCanvas.tsx`   | `e2e/morph.spec.ts`                                                         |
| Change wording or add a string       | `src/i18n/strings.ts` (both languages)       | —                                                                           |
| Change indicator prose or caveats    | the kitchen — it writes them into the pantry | Republish                                                                   |
| Change colours, spacing or contrast  | `src/styles/tokens.css`                      | `src/styles/tokens.test.ts`                                                 |
| Change a municipality URL            | `shared/slug.ts`                             | `tools/build-pages.mjs`, `vite.config.ts`, `e2e/municipality-pages.spec.ts` |
| Change CI, the gate or the deploy    | `.github/workflows/`                         | [deployment.md](deployment.md)                                              |

## Tests

| Suite                 | Lives in                                                            | Run with                               |
| --------------------- | ------------------------------------------------------------------- | -------------------------------------- |
| Kitchen + tools unit  | `kitchen/**/*.test.ts`, `tools/**/*.test.ts`, `shared/**/*.test.ts` | `yarn test` (project `kitchen`, Node)  |
| Site unit + component | `src/**/*.test.{ts,tsx}`                                            | `yarn test` (project `site`, jsdom)    |
| Browser               | `e2e/*.spec.ts`                                                     | `yarn e2e` (Chromium, Firefox, WebKit) |

Tests sit beside the code they cover. The e2e suite covers state and URLs, keyboard navigation,
accessibility (axe), reflow, the morph, similar places, and the built municipality pages.
