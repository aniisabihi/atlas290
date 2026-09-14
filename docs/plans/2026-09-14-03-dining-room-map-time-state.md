# Plan 3: Dining room — map, time and state

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the pantry into a website a person can actually use. A choropleth of Sweden that reads its entire state from the URL, a year you can drag and play, ten indicators you can switch between, search and arrow keys that land in the same place a click does, everything in both languages, and a screen-reader experience designed in rather than bolted on.

**Architecture:** Plan 2 finished the kitchen. This plan builds the dining room against the pantry files it produced and nothing else — no network at runtime, no third-party request, no key. The site becomes a pure function of the URL: `(path, query) -> view`. That is what makes it testable as text in and description out, and it is why the state module is built before anything that renders.

**Tech stack:** Unchanged plus two test-only additions (jsdom, @testing-library/react). No new runtime dependency: d3-geo, d3-scale, d3-scale-chromatic, topojson-client and React are already here and already enough.

**Spec:** [docs/DESIGN.md](../DESIGN.md), sections 3 (the website), 4 (data model), 5 (accessibility), 6 (testing).

## Global constraints

- **The site reads `public/pantry/` and nothing else.** No runtime API call, no analytics, no CDN font, no third-party request of any kind. If a task thinks it needs one, it is wrong.
- **`src/` never imports from `kitchen/`.** Shared code goes in `shared/`. The wall is the safety net.
- **Both languages on every visible string**, and typed so that adding a string in one language without the other fails `yarn typecheck`.
- **Same URL, same view.** No hidden state in React that the URL cannot reproduce. Reloading a link must land on exactly the view that was shared.
- **Accessibility ships with the feature, never after it.** A task that adds a control adds its keyboard path, its accessible name and its announcement in the same task. There is no later cleanup task.
- **Absence is never zero and never silently grey.** The three statuses with no value (`did-not-exist`, `not-yet-published`, `too-few-cases`) are visually distinct from each other and from every class in the colour ramp, by something other than colour alone.
- Conventional Commits. Commit trailer, exactly: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Never `--no-verify`. Work on `feat/plan-03-dining-room`; do not push, merge or change branches from inside a task.

## Verified facts

Established on 2026-09-14 by reading the published pantry and running the real toolchain — not from the design doc, and not from memory. Plan 2's retrospective found that every defect in its task briefs was a remembered factual claim; these were checked.

| Fact                                                                                                                                                                           | How it was verified                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Pantry holds 290 municipalities, 10 indicators, and spans **1968–2026** — 59 distinct years                                                                                    | read `public/pantry/data/indicators.json`                                              |
| **All 290 municipality names are byte-identical in Swedish and English.** Search is a diacritics problem, not a translation problem                                            | compared `name.sv` to `name.en` for all 290; zero differ                               |
| Coverage is ragged at both ends: `tax-rate` is the only indicator reaching 2026, `mean-age` starts in 1998, `median-income` stops at 2024                                      | `coverage` fields, cross-checked against each series' `years`                          |
| **All six observation statuses occur in real data**, including 5 `structural-break` cells, 227 `too-few-cases` and 1,423 `not-yet-published`                                   | counted every status byte in all ten series                                            |
| `house-prices` is the only indicator with a `minCount` (20)                                                                                                                    | `minCount` field                                                                       |
| Adjacency is **symmetric, one connected component, all 290 reachable**, minimum degree 1. `synthetic` is empty because Plan 1's six curated edges already connect every island | graph walk from `0180`; checked every edge for a reverse edge                          |
| Vite 8 multi-page build emits `dist/sv/index.html` and `dist/en/index.html` sharing **one** JS chunk (348.89 kB, 108.57 kB gzipped)                                            | built it with two entry points, then reverted the probe                                |
| Money indicators state "the latest covered year's kronor", which is `indicator.coverage.to` — 2024 for income, 2025 for house prices                                           | read the `derivation` strings; **Task 4 must confirm this empirically, not assume it** |

### The design doc asks for something impossible

DESIGN §5 says "adjacent classes keep at least 3:1 contrast". That cannot be built, and the arithmetic is not close.

WCAG contrast ratios telescope along a monotonic lightness sequence: the ratio between the first and last class is the product of the ratios between each adjacent pair. The maximum possible ratio between any two colours is 21:1 (black on white). Requiring 3:1 between each adjacent pair of `n` classes requires `3^(n-1) <= 21`, so **at most 3 classes**. Every indicator here has 6 breaks, which is 7 classes.

Measured on the real palettes:

| Palette            | Adjacent-pair contrast, 7 classes | Lightest to darkest |
| ------------------ | --------------------------------- | ------------------- |
| Blues (sequential) | 1.23 – 1.79 : 1                   | 8.27 : 1            |
| RdBu (diverging)   | 1.21 – 2.77 : 1                   | **1.16 : 1**        |
| BrBG (diverging)   | 1.12 – 3.20 : 1                   | **1.08 : 1**        |

Two consequences worth stating plainly:

1. No seven-class scale can meet the clause. It has to be replaced with a requirement that can be met and still means something.
2. A diverging ramp's two **ends** are nearly identical in lightness — 1.16:1 for RdBu. Strong in-migration and strong out-migration look the same in greyscale and to someone with no colour vision at all. That is inherent to diverging palettes, not a bad palette choice, and it is why the legend, the announcement and Plan 4's table twin are load-bearing rather than decorative for the two diverging indicators.

Task 6 replaces the clause with four achievable requirements and amends DESIGN §5.

## State shape

```ts
type AppState = {
  lang: 'sv' | 'en' // from the path: /sv/ or /en/
  indicator: IndicatorId // ?i  — default 'population'
  year: number // ?y  — default 2025
  selected: string | null // ?m  — municipality code, default null
}
```

Plan 4 adds `compare`, `view` (map or cartogram) and `table`. The parser is written so those are additive.

**Out-of-coverage years are honoured, never clamped.** `?i=mean-age&y=1970` is a legal URL: mean age is not published for 1970, so the map renders its empty state naming the coverage and offering one click to the nearest covered year. Clamping would quietly rewrite a link someone shared, and it would hide the fact that the ten indicators do not cover the same span — which is a true and interesting thing about this data, not a defect to paper over.

## File structure

```
sv/index.html                    Swedish entry page
en/index.html                    English entry page
index.html                       root: picks a language and redirects

src/
  state/url.ts                   parse and serialise AppState
  state/url.test.ts
  i18n/strings.ts                every UI string, both languages, typed
  i18n/strings.test.ts
  i18n/format.ts                 numbers, units, price basis, per language
  i18n/format.test.ts
  data/pantry.ts                 existing loader, extended with adjacency
  data/select.ts                 pure selectors over PantryData
  data/select.test.ts
  map/geometry.ts                paths and centroids, memoised
  map/colour.ts                  classes, palettes, status fills
  map/colour.test.ts
  map/navigate.ts                arrow keys over the adjacency graph
  map/navigate.test.ts
  search/match.ts                diacritic-folding search
  search/match.test.ts
  components/                    App, MapView, Legend, YearSlider, SearchBox,
                                 IndicatorPicker, AboutIndicator, LiveRegion,
                                 LanguageSwitch, EmptyYear
  styles/tokens.css              palette, spacing, motion, dark mode
  styles/app.css
```

`src/RenderCheck.tsx` and its test are deleted in Task 7 — they were Plan 1's scaffold and the real map replaces them.

---

### Task 1: Two language entry pages

**Files:**

- Create: `sv/index.html`, `en/index.html`
- Modify: `index.html` (becomes the language picker), `vite.config.ts`
- Create: `.claude/launch.json` (so later tasks can run the dev server through the browser pane)

**Interfaces:**

- Produces: a build emitting `dist/sv/index.html` and `dist/en/index.html`, both loading the same JS chunk.

The language lives in the path so that Plan 5 can pre-render a genuinely Swedish page and a genuinely English page, each with a correct `<html lang>` on the first byte and a matching `hreflang`. A runtime language switch cannot give a search engine or a screen reader that.

- [ ] **Step 1: Write the failing build test**

Create `src/entry-pages.test.ts` asserting that `sv/index.html` exists, has `lang="sv"`, a Swedish `<title>`, and a `<script type="module" src="/src/main.tsx">`; likewise `en/index.html` with `lang="en"`. Read the files with `node:fs` — this is a build-shape test, not a DOM test.

Run: `yarn vitest run src/entry-pages.test.ts`
Expected: FAIL — the files do not exist.

- [ ] **Step 2: Create both entry pages and the root redirect**

`sv/index.html` and `en/index.html` are near-identical, differing in `lang`, `<title>` and the `<meta name="description">`. Each carries `<link rel="alternate" hreflang="…">` pointing at the other and at itself.

The root `index.html` renders a plain two-link page — "Svenska" and "English" — that works with no JavaScript at all, plus a small inline script that reads `navigator.languages` and redirects to `/sv/` when Swedish is preferred and `/en/` otherwise, preserving `location.search`. Use `location.replace` so the root does not become a back-button trap. A visitor with JavaScript disabled sees two working links, which is the whole point of not making this a client-side route.

- [ ] **Step 3: Teach Vite about the two entry points**

Add `build.rollupOptions.input` mapping `sv` and `en` to the two files. Verified working against Vite 8.3 during planning: it produces `dist/sv/index.html`, `dist/en/index.html` and a single shared chunk.

Run: `yarn build`
Expected: PASS, and `dist/sv/index.html` plus `dist/en/index.html` both exist.

- [ ] **Step 4: Verify the dev server serves the language paths**

This was **not** verified during planning and must not be assumed. Create `.claude/launch.json` with a `dev` configuration (`yarn dev`, port 5173), start it, and confirm that `/sv/` and `/en/` both load and that `/` redirects. If Vite's dev server does not resolve a bare `/sv/` to `sv/index.html`, fix it here rather than discovering it in Task 7 — the likely fix is an `appType`/middleware adjustment, and the report must say which was needed.

- [ ] **Step 5: Commit**

`feat(site): serve Swedish and English from their own paths`

---

### Task 2: A place to test components

**Files:**

- Modify: `package.json`, `vitest.config.ts`
- Create: `src/test-setup.ts`, `src/components/SmokeProbe.tsx`, `src/components/SmokeProbe.test.tsx`

**Interfaces:**

- Produces: `yarn test` runs React component tests in jsdom alongside the existing node-environment kitchen tests.

DESIGN §6 already commits to a Component testing layer; this is the machinery, built before anything needs it. Add `jsdom`, `@testing-library/react`, `@testing-library/jest-dom` and `@testing-library/user-event` as devDependencies — all MIT, all build-time only, nothing shipped to a visitor and nothing that can start costing money.

**Split the environment, do not replace it.** The kitchen's tests must keep running in `node`. Use vitest's `environmentMatchGlobs` (or two projects) so only `src/**/*.test.tsx` gets jsdom. A kitchen test silently gaining a DOM would be a slow, confusing regression.

- [ ] **Step 1: Write a component test before the environment exists**

`SmokeProbe.tsx` is three lines: a button that increments a counter. Its test renders it, clicks with `user-event`, and asserts the count changed.

Run: `yarn vitest run src/components/SmokeProbe.test.tsx`
Expected: FAIL — `document is not defined`.

- [ ] **Step 2: Add the dependencies and split the environment**

- [ ] **Step 3: Run the whole suite**

Run: `yarn test`
Expected: PASS, all 305 existing tests plus the new one.

- [ ] **Step 4: Prove the split actually holds**

A test that cannot fail is worse than no test. Temporarily add `expect(typeof document).toBe('undefined')` to any existing `kitchen/**` test and run it; it must pass, proving jsdom did not leak into the node environment. Remove the assertion afterwards and say in the report that it was run and what it printed.

- [ ] **Step 5: Commit**

`test(site): run component tests in jsdom without giving the kitchen a DOM`

---

### Task 3: The URL is the application's memory

**Files:**

- Create: `src/state/url.ts`, `src/state/url.test.ts`

**Interfaces:**

- Produces: `parseState(pathname: string, search: string, pantry: PantryMeta): AppState` and `toUrl(state: AppState): string`
- Produces: `DEFAULTS`, and `LANGS = ['sv','en'] as const`

`PantryMeta` is the minimum the parser needs to validate against — the list of indicator ids and the list of municipality codes. Pass it in rather than importing the pantry, so the parser stays pure and its tests need no fixture files.

- [ ] **Step 1: Write the failing tests**

Cover, at minimum:

- `/sv/` with no query yields every default, and `parseState` never returns an invalid indicator id.
- `/en/?i=mean-age&y=2010&m=0180` round-trips through `toUrl` unchanged.
- **Defaults are omitted from the output.** `toUrl(DEFAULTS)` is `/sv/` — not `/sv/?i=population&y=2025&m=`. A shared link should be short and should not pin values the visitor never chose.
- Garbage is survivable and never throws: `?i=not-an-indicator`, `?y=banana`, `?y=1700`, `?m=9999`, `?m=180` (three digits — the code is a string and `0180` must never be accepted as `180`).
- An **out-of-coverage but in-range** year is preserved, not clamped: `?i=mean-age&y=1970` parses to year 1970.
- An **out-of-axis** year is clamped to the 1968–2026 axis, because there is no view that can render it at all.
- Unknown query parameters are dropped rather than preserved, and the test says so explicitly, so Plan 4 adding `?compare=` is a deliberate change to this module and not an accident.
- A path that is neither `/sv/` nor `/en/` yields… (decide and test it; the root redirect means this should not happen, but `parseState` must not throw).

Run: `yarn vitest run src/state/url.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 2: Implement, and make the round-trip a property**

Beyond the example tests, write one loop that generates every combination of `{2 languages} × {10 indicators} × {a sample of years} × {a sample of codes, plus null}` and asserts `parseState(toUrl(s)) === s`. That is a few thousand cases, runs in milliseconds, and catches the encoding mistakes examples miss.

- [ ] **Step 3: Mutation-check the property**

Break `toUrl` so it omits the year, run the property test, confirm red, restore. Report what the failure message said — if it was not obvious which field was lost, improve the assertion.

- [ ] **Step 4: Commit**

`feat(site): read and write the whole application state from the URL`

---

### Task 4: Words and numbers, in two languages

**Files:**

- Create: `src/i18n/strings.ts`, `src/i18n/strings.test.ts`, `src/i18n/format.ts`, `src/i18n/format.test.ts`

**Interfaces:**

- Produces: `t(lang)` returning a typed object of UI strings
- Produces: `formatValue(value, indicator, lang)`, `formatUnit(indicator, lang)`, `priceBasisYear(indicator)`

**Typing that makes a missing translation a compile error.** Define the strings as `Record<Lang, T>` where `T` is inferred from the Swedish table, so adding a Swedish key without an English one fails `yarn typecheck`. Prove it: the report must show the compiler error from deliberately deleting one English key.

Municipality and indicator names come from the pantry, not from this module. This file holds only chrome — button labels, the legend heading, the empty-year sentence, the announcement template.

- [ ] **Step 1: Write the failing formatting tests**

Real values from the published pantry, not invented ones. Include at least:

- `population` in Swedish uses a non-breaking space as the thousands separator; in English, a comma.
- `tax-rate` renders as a percentage with two decimals in both languages, with the comma decimal separator in Swedish.
- `median-income` renders as kronor **and states the price basis year**.
- `net-migration-rate` renders per 1,000 with an explicit sign for positive values — the direction is the entire point of a diverging indicator.
- `density` uses `inv/km²` and `people/km²`.
- `null` never formats as `0`; it formats as the status's own phrase.

Run: `yarn vitest run src/i18n/`
Expected: FAIL.

- [ ] **Step 2: Confirm the price-basis year empirically before implementing it**

The planning note says `priceBasisYear(indicator)` is `indicator.coverage.to`. **Verify it rather than trusting it.** An inflation adjustment to year Y leaves year Y's own value unchanged, so: pick one municipality, read its stored `median-income` for 2024 and for `house-prices` for 2025, and check each against the nominal figure in the frozen raw file under `kitchen/raw/` (thousands of kronor there, kronor here). If the base year is not `coverage.to`, find what it actually is and say so — this string is shown to visitors as a factual claim about the money.

- [ ] **Step 3: Implement with `Intl.NumberFormat`**

Locales `sv-SE` and `en-GB`. Do not hand-roll separators.

- [ ] **Step 4: Commit**

`feat(site): format every value and label in both languages`

---

### Task 5: Selectors over the pantry

**Files:**

- Create: `src/data/select.ts`, `src/data/select.test.ts`
- Modify: `src/pantry.ts` → move to `src/data/pantry.ts`, extended to load adjacency

**Interfaces:**

- Produces: `observationAt(data, indicatorId, code, year)` → `{ value: number | null, status: ObservationStatus }`
- Produces: `classOf(indicator, value)` → class index 0–6, or null
- Produces: `rankOf(data, indicatorId, year, code)` → `{ rank, outOf }` counting only municipalities with a present value that year
- Produces: `coverageOf(indicator)` → `{ from, to, nearestCoveredYear(y) }`
- Produces: `yearSummary(data, indicatorId, year, lang)` → the one sentence the live region and Plan 4's table both use

These are the only place that knows the columnar layout. Every component reads through them, so a change to the pantry's shape lands in one file.

- [ ] **Step 1: Write the failing tests against real published values**

Assert concrete figures read out of `public/pantry/data/indicators.json` — a self-proving test, the way Plan 2's `src/indicators.headline.test.ts` works. At minimum: a known population, a `too-few-cases` house-price cell, a `did-not-exist` cell for Knivsta before 2003, and the `structural-break` cell for a split parent.

Also assert that **rank skips absent values**: in a year where some municipalities have no value, `outOf` is the count of present values, not 290. Ranking a municipality "180th of 290" when 60 of those had no data is a false statement.

Run: `yarn vitest run src/data/select.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implement**

- [ ] **Step 3: Commit**

`feat(site): read the pantry through one set of selectors`

---

### Task 6: Colour, and what absence looks like

**Files:**

- Create: `src/map/colour.ts`, `src/map/colour.test.ts`
- Modify: `docs/DESIGN.md` (§5)

**Interfaces:**

- Produces: `paletteFor(indicator)` → seven fills
- Produces: `fillFor(indicator, value, status)` → a colour or a pattern reference
- Produces: `STATUS_PATTERNS` → the SVG `<pattern>` definitions the map renders once in `<defs>`
- Produces: `FOCUS_RING` → the two-tone ring used for focus and selection

**Amend DESIGN §5 first.** Replace "adjacent classes keep at least 3:1 contrast" — shown impossible above — with four requirements that can be met and can be tested:

1. Class colours come from a ColorBrewer scheme that ColorBrewer itself flags colour-blind safe. **Check the flag; do not assume it from the scheme's name.**
2. Sequential ramps have monotonic lightness, so class order survives greyscale and a monochrome print.
3. The focus and selection indicator meets **3:1 against every one of the seven class fills and against both no-data patterns**. This is the contrast requirement that genuinely applies here (WCAG 2.2 SC 1.4.11, non-text contrast), and unlike the old clause it is achievable — a two-tone ring (dark core, light halo) passes on both ends of every ramp.
4. Value, class and status are always available as text, so no reading of the map depends on colour alone.

Record the amendment as a dated correction in §5 the way Task 6 of Plan 2 did, including the arithmetic, so a future reader sees why the original was dropped rather than assuming it was forgotten.

- [ ] **Step 1: Write the failing contrast tests**

These are real assertions with real numbers, not a rubber stamp:

- Compute the WCAG ratio between `FOCUS_RING`'s core and each of the seven class fills; assert every one is ≥ 3:1. Do the same for the halo.
- Assert sequential palette lightness is strictly monotonic.
- Assert the page background is distinct in lightness from every class fill, so the lightest class is visible against it. (Measured during planning: Blues' lightest class is **1.11:1 against white** — effectively invisible on a white page. Whatever palette is chosen, this test is the one that catches it.)
- Assert `fillFor` returns three _different_ patterns for `did-not-exist`, `not-yet-published` and `too-few-cases`, and that none of them is a flat colour from the ramp.
- Assert `perturbed` and `structural-break` return the **class colour**, not a pattern — those cells have real values and hiding them would be the wrong kind of honesty. They are annotated in the legend and the announcement instead.

Run: `yarn vitest run src/map/colour.test.ts`
Expected: FAIL.

- [ ] **Step 2: Choose the palettes and implement**

Sequential and diverging, both verified colour-blind safe. For the two diverging indicators the breaks are quantile-based and **zero does not fall on a break** — `net-migration-rate` breaks are `[-6.47, -2.32, 0.61, 3.28, 6.15, 10.5]`, so zero sits inside the third class. Put the neutral colour on the class that contains zero and have the legend mark where zero actually falls within it. Do not silently pretend the ramp is centred.

- [ ] **Step 3: Commit**

`feat(site): a colour scale that survives colour blindness, and absence you can see`

---

### Task 7: The map

**Files:**

- Create: `src/map/geometry.ts`, `src/components/MapView.tsx`, `src/components/MapView.test.tsx`
- Delete: `src/RenderCheck.tsx`, `src/RenderCheck.test.ts`

**Interfaces:**

- Produces: `pathsFor(topology)` and `centroidsFor(topology)`, both memoised — 290 projected paths are computed once per session, never per render or per year
- Produces: `<MapView state pantry onSelect />`

**290 SVG paths, one tab stop.** Making every municipality tabbable would put 290 stops between the map and whatever follows it, which is hostile with a keyboard and worse with a screen reader. Use a **roving tabindex**: the map is a `role="group"` with an accessible name, exactly one path carries `tabindex="0"` (the selected one, or the first when nothing is selected), every other path carries `tabindex="-1"`. Tab enters and leaves the map as a unit; arrow keys move within it (Task 8).

- [ ] **Step 1: Verify SVG focusability before designing around it**

`tabindex` on an SVG `<path>` is not uniformly supported historically. Before building on it, confirm in the browser pane that a `<path tabindex="0">` receives focus, shows a focus ring, and fires `keydown`. If it does not, the fallback is a transparent `<rect>` overlay or moving focus to a wrapping `<g>` — pick one and record which, and why, in the report. **Do not let the component test in jsdom stand in for this**: jsdom implements no SVG layout and will happily focus something a browser will not.

- [ ] **Step 2: Write the failing component tests**

- Renders exactly 290 paths.
- Exactly one path has `tabindex="0"`; the other 289 have `tabindex="-1"`.
- Each path has an accessible name carrying municipality, value and status — the map is content, not a picture.
- Clicking a path calls `onSelect` with its four-digit code.
- A `too-few-cases` cell renders with its pattern, not a ramp colour.
- The selected municipality renders the focus ring and is drawn last, so its outline is not overdrawn by a neighbour.

Run: `yarn vitest run src/components/MapView.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement, and keep the path data out of the render loop**

Project once, memoise by topology identity. Changing year or indicator must change only `fill` and the accessible name — never recompute geometry. Note in the report roughly how long `pathsFor` takes, so Plan 5's performance budget has a real number to start from.

- [ ] **Step 4: Delete Plan 1's scaffold**

`RenderCheck` was built to prove the pantry contract and has done its job. Remove it and its test, and point `main.tsx` at the real app shell.

- [ ] **Step 5: Commit**

`feat(site): the map of Sweden, as content rather than a picture`

---

### Task 8: Arrow keys that go where you point them

**Files:**

- Create: `src/map/navigate.ts`, `src/map/navigate.test.ts`
- Modify: `src/components/MapView.tsx`

**Interfaces:**

- Produces: `step(from: string, direction: 'up'|'down'|'left'|'right', adjacency, centroids): string | null`

The adjacency graph gives neighbours, not directions. The rule: among the neighbours of the current municipality, take the vector to each neighbour's projected centroid, and choose the one whose angle is closest to the pressed direction — **but only if it lies within 90° of it**. Ties break by shorter distance, then by municipality code, so the behaviour is deterministic and testable.

**If nothing lies in that direction, do not move.** Höganäs has exactly one neighbour (Helsingborg, to the south); pressing Up must not teleport the visitor southwards because that was the only option. The live region announces that there is no neighbour that way. Predictable beats clever.

- [ ] **Step 1: Write the failing tests against the real graph**

Use the published adjacency and real centroids, not a fixture — this is a behaviour a synthetic four-node graph cannot validate.

- From Stockholm (`0180`), each of the four directions lands somewhere, and each lands somewhere different.
- From Höganäs (`1284`), Down reaches Helsingborg and Up returns `null`.
- From Gotland (`0980`), the only edge is the curated Nynäshamn ferry link, so exactly one direction moves and the other three return `null`.
- `step` is never a no-op loop: it never returns its own input.
- Walking from Kiruna to Malmö is possible — assert reachability by running the stepper, not by trusting the graph walk done during planning.

Run: `yarn vitest run src/map/navigate.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implement, and remember the y axis points down**

Projected screen coordinates put north at smaller y. Getting this backwards makes Up go south and every test above will catch it — confirm at least one of them does by mutating the sign and watching it go red.

- [ ] **Step 3: Wire it to the map with Home, End, Enter and Escape**

Arrow keys move; Enter or Space selects; Escape clears the selection; Home goes to the first municipality by name. `preventDefault` on the arrows so the page does not scroll underneath.

- [ ] **Step 4: Commit**

`feat(site): walk the map with the arrow keys, and stop at the edges`

---

### Task 9: The legend

**Files:**

- Create: `src/components/Legend.tsx`, `src/components/Legend.test.tsx`

The legend is where the honesty lives. It shows seven classes with their real break values formatted in the current language and unit, plus a swatch for each no-data pattern that actually occurs **in the year being shown** — showing a "too few sales" key on the population map would be noise.

For a diverging indicator it marks where zero falls inside its class, because the quantile breaks do not sit on zero.

For `perturbed` and `structural-break` it adds a short note rather than a swatch, since those cells keep their class colour.

- [ ] **Step 1: Write the failing tests**

- Seven classes, labelled with the actual breaks, formatted per language and unit.
- The house-price legend in a year with suppressed cells shows the "too few sales" key; the population legend never does.
- The diverging legend marks zero; the sequential legend does not.
- The legend is a real list with an accessible name, not a row of unlabelled coloured boxes.

Run: `yarn vitest run src/components/Legend.test.tsx`
Expected: FAIL.

- [ ] **Step 2: Implement**

- [ ] **Step 3: Commit**

`feat(site): a legend that shows the breaks and admits what is missing`

---

### Task 10: Time, and a play button

**Files:**

- Create: `src/components/YearSlider.tsx`, `src/components/YearSlider.test.tsx`, `src/components/EmptyYear.tsx`

**Interfaces:**

- Produces: `<YearSlider state onYear />`, `<EmptyYear indicator year lang onJump />`

A native `<input type="range" min="1968" max="2026" step="1">`, because the browser already gives it keyboard support, touch support and a screen-reader announcement that nothing hand-built will match. `aria-valuetext` carries the year plus, when the year is outside the current indicator's coverage, the reason.

Behind it, a tick strip dims the years the current indicator does not cover — `aria-hidden`, since `aria-valuetext` already says it. The axis is always the full 1968–2026 whatever indicator is chosen: the ragged coverage is a fact about the data, and showing it is more useful than hiding it.

**Play** advances one year per second, stops at the end of the axis, and pauses on any interaction with the slider, the map or the search box. Under `prefers-reduced-motion: reduce` the colour transition between years is removed — play still works, it simply steps.

When the year is outside coverage, `EmptyYear` replaces the map's colours with a sentence naming the coverage — "Mean age is published from 1998" — and one button that jumps to the nearest covered year.

- [ ] **Step 1: Write the failing tests**

- Dragging the slider reports the year and nothing else changes.
- `aria-valuetext` says the year, and for an uncovered year says why it is empty.
- Play advances the year on a fake timer and stops at 2026 rather than running past it.
- Pressing a key on the map pauses play.
- With `prefers-reduced-motion: reduce` matched, the transition class is absent.
- From `mean-age` at 1970, the jump button goes to 1998 — and from 2030-clamped-to-2026 it goes to 2025, i.e. the _nearest_ covered year in either direction, not always the first.

Run: `yarn vitest run src/components/YearSlider.test.tsx`
Expected: FAIL.

- [ ] **Step 2: Implement**

Use vitest's fake timers for play. Mock `matchMedia` in the setup file — jsdom does not implement it, and every reduced-motion test depends on it.

- [ ] **Step 3: Commit**

`feat(site): drag or play through 59 years, and say when there is nothing to show`

---

### Task 11: Search

**Files:**

- Create: `src/search/match.ts`, `src/search/match.test.ts`, `src/components/SearchBox.tsx`, `src/components/SearchBox.test.tsx`

**Interfaces:**

- Produces: `searchMunicipalities(query, municipalities, lang)` → ranked matches

**All 290 names are identical in both languages** (verified), so this is not a translation problem. It is a diacritics problem: someone typing `Malmo`, `Angelholm` or `Ostersund` on a non-Swedish keyboard must find `Malmö`, `Ängelholm` and `Östersund`. Fold with `normalize('NFD')` and strip combining marks, on both the query and the name.

Ranking: exact match, then prefix, then substring, then alphabetical within each tier using `localeCompare` with the **Swedish** collation regardless of interface language — å, ä and ö sort at the end of the Swedish alphabet, and the names are Swedish in both languages.

A four-digit query matches by code.

- [ ] **Step 1: Write the failing matcher tests**

Against all 290 real names:

- `Malmo` finds Malmö; `malmö` finds it; `MALMÖ` finds it.
- `Ostersund`, `Angelholm`, `Savsjo` find their accented forms.
- `0180` finds Stockholm by code; `180` does not (codes are four-digit strings).
- `Upplands` returns both Upplands Väsby and Upplands-Bro, prefix matches first.
- Sorting puts Åre after Örkelljunga? — assert the actual Swedish order for a set containing å, ä, ö, and state the expected order explicitly in the test rather than trusting the implementation to define it.
- An empty query returns nothing, not all 290.

Run: `yarn vitest run src/search/match.test.ts`
Expected: FAIL.

- [ ] **Step 2: Write the failing combobox tests**

The ARIA 1.2 combobox pattern: `role="combobox"` on the input with `aria-expanded` and `aria-controls`, a `role="listbox"` of `role="option"`, active option tracked with `aria-activedescendant` and **never** by moving DOM focus. Down and Up move the active option, Enter selects, Escape closes and keeps the typed text, Escape again clears it.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Commit**

`feat(site): find any municipality without a Swedish keyboard`

---

### Task 12: Choosing an indicator, and reading its fine print

**Files:**

- Create: `src/components/IndicatorPicker.tsx`, `src/components/AboutIndicator.tsx`, and tests for both

The pantry carries a name, description, caveat, derivation and source list for every indicator, in both languages. Plan 2 spent real effort making those accurate — a caveat that says a mean price rests on fewer than 20 sales, a derivation that names the exact content code and why a different table was rejected. This task puts them on screen.

The picker is a `<fieldset>` of radios, not a `<select>`: ten options where switching is the main interaction, and radios announce "3 of 10" while a select does not.

`AboutIndicator` is a `<details>` disclosure under the map holding the description, the caveat, the price basis where money is involved, the coverage years, and the source tables with their content codes. It is collapsed by default and its content is never truncated — the caveats are long because the truth is long, and cutting them off would undo the point.

- [ ] **Step 1: Write the failing tests**

- Ten radios, exactly one checked, matching the URL state.
- Switching indicator keeps the year, even when the new indicator does not cover it (Task 10's empty state then takes over).
- The caveat text is rendered **in full** for `house-prices` — assert on a distinctive phrase near the end of it, so truncation fails the test.
- Every source table and content code appears.
- Swedish and English both render, from the pantry rather than from `strings.ts`.

Run: `yarn vitest run src/components/IndicatorPicker.test.tsx src/components/AboutIndicator.test.tsx`
Expected: FAIL.

- [ ] **Step 2: Implement**

- [ ] **Step 3: Commit**

`feat(site): choose an indicator and read what it actually measures`

---

### Task 13: Saying out loud what the map shows

**Files:**

- Create: `src/components/LiveRegion.tsx`, `src/components/LiveRegion.test.tsx`

A single `aria-live="polite"` region, anchored to the selected municipality, announcing name, indicator, year, value with unit, status and rank.

**Debounced, or it is useless.** Dragging the slider across 59 years would otherwise queue 59 announcements; the range input already announces its own value while dragging. The live region waits until things settle (about 500 ms) and then says one sentence. When play is running it does not announce at all — a sentence per second is noise, and the visitor asked for motion, not narration.

The sentence is the same one `yearSummary` produces in Task 5, so the announcement, Plan 4's table and any future prose cannot drift apart.

- [ ] **Step 1: Write the failing tests**

- Selecting a municipality announces one sentence containing name, value, unit and rank.
- Nine rapid year changes on a fake timer produce **one** announcement, not nine.
- A `too-few-cases` cell announces the reason, never "0".
- A `perturbed` cell announces the value **and** that SCB has added noise to it.
- Play running suppresses announcements; stopping play announces once.

Run: `yarn vitest run src/components/LiveRegion.test.tsx`
Expected: FAIL.

- [ ] **Step 2: Implement**

- [ ] **Step 3: Commit**

`feat(site): announce the map, once, when it settles`

---

### Task 14: Making it look like something

**Files:**

- Create: `src/styles/tokens.css`, `src/styles/app.css`
- Modify: `src/components/App.tsx` and siblings

Hand-written CSS, no framework. Custom properties for palette, spacing, type scale and motion, so dark mode and reduced motion are token swaps rather than rewrites.

- Layout: map beside the controls on a wide screen, stacked on a narrow one. Down to 360 px the map stays usable and nothing scrolls sideways. (The cartogram and the bottom sheet are Plan 4; this is the plain responsive map.)
- `prefers-color-scheme` supported through tokens. **Re-run Task 6's contrast tests against the dark palette** — a focus ring that passes on a light background can fail on a dark one, and a palette swap that is not re-tested is a regression waiting to happen.
- `prefers-reduced-motion: reduce` removes every transition, not only the map's.
- Focus visible everywhere, using the two-tone ring from Task 6.
- The language switch is a real `<a href>` to the other path carrying the current query, so it works without JavaScript and appears in the browser's history the way a page change should.

- [ ] **Step 1: Write the failing tests**

Component tests, not screenshots — jsdom has no layout engine and a test asserting pixel positions there would be a test that cannot fail honestly. Assert: the language switch is an anchor with the correct `href` and preserved query; dark-mode tokens exist for every light-mode token; the contrast suite passes against both palettes.

- [ ] **Step 2: Implement, then look at it**

Run the dev server through the browser pane and check the real thing at desktop and at 360 px, in light and dark, with reduced motion on. Screenshot both widths into the report — this is the one task where the proof is visual.

- [ ] **Step 3: Commit**

`feat(site): dress the dining room`

---

### Task 15: Verify the whole thing

**Files:**

- Modify: `docs/DESIGN.md` (status), `docs/plans/README.md` (Plan 3 done, Plan 4 next), `README.md`

- [ ] **Step 1: The full suite**

`yarn typecheck`, `yarn lint`, `yarn test`, `yarn build`. All clean. Report the test count and the bundle size — Plan 2 ended at 305 tests and 348.89 kB (108.57 kB gzipped), and Plan 5 needs a real number to set a budget against.

- [ ] **Step 2: A manual keyboard pass, written down**

Tab from the top of the page to the bottom without a mouse: reach the language switch, the search box, the indicator radios, the year slider, play, and the map; walk the map with arrow keys; select with Enter; clear with Escape. Record what was checked and anything that felt wrong, even if it was not fixed. An honest note beats a green tick.

- [ ] **Step 3: Confirm the URL really is the memory**

Open three different states, copy each URL, reload each in a fresh tab, and confirm each lands exactly where it was. Include one out-of-coverage year and one deep link with a selected municipality.

- [ ] **Step 4: Update the docs**

`docs/plans/README.md`: Plan 3 done, Plan 4 next. `docs/DESIGN.md`: status line, and confirm the §5 amendment from Task 6 reads correctly in context. `README.md`: how to run it.

- [ ] **Step 5: Commit**

`docs: mark plan 3 done and record what the site now does`

---

## What this plan deliberately leaves for Plan 4

The profile panel and its ten small charts, explicit comparison between two municipalities, the hand-written facts strip, the plain sortable table twin, the cartogram and the phone bottom sheet, and per-state page titles. Plan 3 stops at a map you can read, drive and link to.

## What this plan leaves for Plan 5

Playwright, axe in CI, the Lighthouse budget, the Cloudflare Pages deploy, the monthly refresh job, and the manual WCAG pass. **There is currently no CI on this repository at all** — no workflow runs `yarn test` on a pull request. Plan 3's quality argument rests entirely on tests run locally. That is a known gap, deliberately scheduled, and worth remembering when reviewing the pull request this plan produces.
