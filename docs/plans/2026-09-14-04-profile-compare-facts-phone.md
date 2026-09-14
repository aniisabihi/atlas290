# Plan 4: Dining room — profile, compare, facts and the phone

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the map somewhere to go. Clicking a municipality opens a profile with ten small charts of its whole history; an explicit "compare with" puts a second one beside it; a strip of five hand-written facts offers things nobody thought to ask; a plain sortable table is the twin of every map; and the bubble cartogram becomes a real view rather than a file nobody reads.

**Architecture:** Plan 3 established that everything rendered is a function of the URL. This plan adds three pieces of state to that URL and four views that read it. Nothing here changes how the map works; it plugs new views into the same socket.

**Tech stack:** Unchanged. No new dependency — the sparklines are twenty lines of SVG, and d3-scale is already here.

**Spec:** [docs/DESIGN.md](../DESIGN.md), sections 3 (the website), 5 (accessibility), 7 (scope).

## Global constraints

Unchanged from Plan 3, and worth repeating the two that bind hardest:

- **The site reads `public/pantry/` and nothing else.** No runtime request of any kind.
- **Same URL, same view.** Every new piece of state goes in the address bar or it does not exist.
- **Absence is never zero**, in a chart as much as on a map: a gap in a sparkline is a gap, not a line through it.
- **No "higher is better" anywhere.** Comparison says "higher on 7 of 10", never "wins". If the visitor wants a direction, they supply it.
- Both languages on every visible string, enforced by the type.
- Conventional Commits. Trailer: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Never `--no-verify`. Work on `feat/plan-04-profile-compare-facts`; do not push, merge or change branches from inside a task.

## Verified facts

Established on 2026-09-14 against the published pantry and the frozen SCB responses, before any of this was planned.

| Fact                                                                                                                                                    | How it was verified                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `public/pantry/layout/bubbles.json` holds **290 circles, no overlapping pairs**, based on population 2024, x in 0.060–0.891 and y in 0.063–1.049        | read the file and checked every pair                                                |
| **Nominal money is exactly recoverable** from the stored adjusted figure plus the price index — all 20,260 money cells, no approximation                | re-derived every cell against the frozen SCB responses                              |
| …but only at each table's **own** published precision: house prices are whole thousands of kronor, median income is thousands to one decimal, so 100 kr | first attempt snapped both to 1,000 kr and recovered only 797 of 7,537 income cells |
| Storing nominal as a second series would cost **+69 kB gzipped** (272 → 341); publishing the price index instead costs about **400 bytes**              | built both and measured                                                             |
| The facts below are true of the committed pantry                                                                                                        | queried each one                                                                    |

### The five facts, chosen by the architect

Each is a real figure from the pantry, and each links into the view that proves it.

| Fact                                                               | Figures                                                           | Links to                              |
| ------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------- |
| Håbo has grown 406% since 1968; Åsele has lost 53%                 | 4,542 → 22,973 and 5,764 → 2,694                                  | population, 2024, Håbo selected       |
| 124 of 284 municipalities have fewer people than in 1968           | six municipalities have no 1968 figure because they did not exist | population change, 2024               |
| Borgholm's average resident is 53.3 years old; Knivsta's is 37.8   | 2025                                                              | mean age, 2025, Borgholm selected     |
| A house in Danderyd costs 22 times one in Malå                     | 13,813,000 kr against 634,000 kr, both in 2025 kronor             | house prices, 2025, Danderyd selected |
| Arjeplog has 0.2 people per square kilometre; Sundbyberg has 6,529 | 2025                                                              | density, 2025, Arjeplog selected      |

**Every fact gets a test that re-derives its claim from the pantry.** A fact strip that drifts out of step with the data it links to would be worse than no fact strip, and a data refresh is exactly when that happens.

## State shape

```ts
type AppState = {
  lang: 'sv' | 'en'
  indicator: IndicatorId
  year: number
  selected: string | null
  compare: string | null // ?c  — the second municipality
  view: 'map' | 'cartogram' // ?v — default depends on screen width
  table: boolean // ?t  — the plain table twin
}
```

**The cartogram is a view anyone can switch to, not a phone consolation.** DESIGN calls it the phone view; making it addressable everywhere costs nothing extra and is the whole point of the idea — a normal Swedish map tells a visual lie about where people are, and one control fixes it. Narrow screens default to it; the URL always wins over the default.

## File structure

```
kitchen/src/indicators/cpi.ts          publishes the index series and each money
                                       indicator's published granularity
shared/pantry.ts                       PriceIndex, Indicator.publishedStep

src/
  data/nominal.ts                      recovering the figure SCB actually published
  data/nominal.test.ts
  data/compare.ts                      the ten-indicator comparison, no winner
  facts/facts.ts                       five hand-written facts, both languages
  facts/facts.test.ts                  each one re-derived from the pantry
  components/Sparkline.tsx             one indicator's history, with a year cursor
  components/ProfilePanel.tsx          ten of them, plus the current readings
  components/CompareControl.tsx
  components/DataTable.tsx             the sortable twin of the map
  components/Cartogram.tsx             290 bubbles, same socket as the map
  components/BottomSheet.tsx           the profile on a phone
  state/title.ts                       document.title from the state
```

---

### Task 1: The figure SCB actually published

**Files:**

- Modify: `shared/pantry.ts`, `kitchen/src/indicators/cpi.ts`, `kitchen/src/publish.ts`
- Create: `src/data/nominal.ts`, `src/data/nominal.test.ts`

**Interfaces:**

- Produces: `PantryData.priceIndex` — `{ base: number, values: Record<year, number> }`
- Produces: `Indicator.publishedStep` — the smallest step the source publishes, in the indicator's own unit
- Produces: `nominalOf(data, indicator, value, year): number | null`

DESIGN says nominal money stays visible in the profile and the table. The pantry stores only the inflation-adjusted figure, so today it cannot be. Two ways to fix that, and the cheap one is also the exact one: **storing nominal as a second series costs 69 kB gzipped, publishing the price index costs about 400 bytes**, and the recovery is exact rather than approximate — verified over all 20,260 money cells before this plan was written.

It is exact because SCB publishes these in thousands of kronor, so the original figure always lands on a known step. Snap to that step and the rounding that the pantry applied on the way out is undone exactly. **The step differs per table** and must be published rather than assumed: house prices are whole thousands, median income is thousands to one decimal. Snapping both to 1,000 recovered only 797 of 7,537 income cells.

- [ ] **Step 1: Write the failing test, and make it the proof rather than a sample**

`nominal.test.ts` must re-derive **every** money cell — all 20,260 — from the published pantry and compare each against the frozen SCB response under `kitchen/raw/`. Not a sample: the claim being made on screen is "this is what it cost at the time", and a sampled test would let a handful of wrong figures through.

Run: `yarn vitest run src/data/nominal.test.ts`
Expected: FAIL — `priceIndex` is not in the pantry.

- [ ] **Step 2: Publish the index and the step**

`PriceIndex` in the schema; `cpi.ts` returns the series alongside the map it already builds; `publish.ts` writes it. `Indicator.publishedStep` is set by each money indicator from its own table's real precision — read from the frozen data, not hardcoded from memory.

- [ ] **Step 3: Republish and confirm nothing else moved**

Run: `yarn kitchen publish`
Expected: every existing value byte-identical; only the new fields appear. Diff `series` before and after to prove it, the way Plan 3's Task 4 did.

- [ ] **Step 4: Commit**

`feat(kitchen): publish the price index, so the site can show what things actually cost`

---

### Task 2: Three more pieces of state

**Files:**

- Modify: `src/state/url.ts`, `src/state/url.test.ts`, `src/state/useAppState.ts`

**Interfaces:**

- Produces: `AppState` gains `compare`, `view` and `table`

- [ ] **Step 1: Write the failing tests**

Extend the round-trip property to cover the new fields — it is now over several thousand combinations and still runs in milliseconds. Plus:

- `?c=` accepts only a known code, and **never the same code as `?m=`**: comparing Malmö with Malmö is not a view, and the parser should drop it rather than render a panel of zeroes.
- `?c=` without `?m=` is dropped: a comparison needs something to compare against.
- `?v=cartogram` and `?v=map` parse; anything else falls back.
- `?t=1` parses; `?t=0` and absence both mean no table.
- Defaults are still omitted from the output, so a plain map link stays `/sv/`.

- [ ] **Step 2: Implement**

- [ ] **Step 3: Commit**

`feat(site): put comparison, the cartogram and the table in the URL`

---

### Task 3: The page says where you are

**Files:**

- Create: `src/state/title.ts`, `src/state/title.test.ts`

**Interfaces:**

- Produces: `titleFor(lk, state): string`

A shared link that says "Sweden's municipalities in data" in every browser tab tells the recipient nothing, and a screen reader announces the title on every navigation. The title is built from the state: municipality first where one is selected, because that is what the visitor came for.

- [ ] **Step 1: Write the failing tests**

- Nothing selected: `Population 2024 · Sweden's municipalities in data`
- Selected: `Stockholm · Population 2024 · Sweden's municipalities in data`
- Comparing: `Stockholm and Malmö · Population 2024 · …`
- Table view and cartogram view each say so.
- Swedish throughout, from the pantry's own indicator names.
- The title never contains a raw indicator id or a four-digit code.

- [ ] **Step 2: Implement and set it from `App`**

- [ ] **Step 3: Commit**

`feat(site): name the view in the page title`

---

### Task 4: One indicator's whole history, small

**Files:**

- Create: `src/components/Sparkline.tsx`, `src/components/Sparkline.test.tsx`

**Interfaces:**

- Produces: `<Sparkline lk indicatorId code year lang />`

Twenty lines of SVG, no library. The one thing it must get right is **absence**: a gap in the series is a gap in the line, not a straight segment across it. Drawing through the years Knivsta did not exist would invent a history.

- [ ] **Step 1: Write the failing tests**

- A municipality with a complete series draws one path.
- **Knivsta's population draws a path that starts in 2003**, not 1968, and the line has no segment spanning the gap.
- A municipality with a hole in the middle (house prices with a suppressed year) draws **more than one** path.
- The year cursor sits at the current year, and moves when the year changes.
- The whole thing is `aria-hidden`, and the accessible description is text alongside it — a sparkline is a picture of numbers that are already on the page.
- The chart's vertical scale is the municipality's own range, and it says so, because a shared scale across ten indicators of different units would be meaningless.

Run: `yarn vitest run src/components/Sparkline.test.tsx`
Expected: FAIL.

- [ ] **Step 2: Implement**

- [ ] **Step 3: Commit**

`feat(site): a small chart per indicator that leaves gaps as gaps`

---

### Task 5: The profile panel

**Files:**

- Create: `src/components/ProfilePanel.tsx`, `src/components/ProfilePanel.test.tsx`

Non-modal, per DESIGN section 5, with a declared focus target on open, close, back and deep link. Ten rows: indicator name, the current year's reading with its unit and status, the rank, and the sparkline. Money rows also show what the figure was at the time, from Task 1.

- [ ] **Step 1: Write the failing tests**

- Ten rows, one per indicator, in the pantry's order.
- Each row carries the value, the unit and the rank for the current year.
- A row whose indicator does not cover the current year says so rather than showing a blank.
- A money row shows both the adjusted figure and the nominal one, each labelled with its year.
- Opening the panel moves focus to its heading; closing returns focus to the map shape that opened it.
- The close control is a real button with a name, not an icon with a title attribute.
- It is not a dialog: no `role="dialog"`, no focus trap, and the map stays reachable behind it.

- [ ] **Step 2: Implement**

- [ ] **Step 3: Commit**

`feat(site): a profile panel with ten small histories`

---

### Task 6: Compare, without a winner

**Files:**

- Create: `src/data/compare.ts`, `src/data/compare.test.ts`, `src/components/CompareControl.tsx` and its test

**Interfaces:**

- Produces: `compareOf(lk, a, b, year)` → per-indicator `{ a, b, higher: 'a' | 'b' | 'equal' | null }`

**There is no "higher is better" flag anywhere in this project and this task does not add one.** The summary is "higher on 7 of 10", never "wins". `null` where either side has no value that year — and the count says how many were comparable, because "higher on 7 of 10" is a different claim from "higher on 7 of the 8 we could compare".

- [ ] **Step 1: Write the failing tests**

- Two municipalities with full data: ten comparisons, the counts adding up.
- A year where one side is suppressed: that indicator is `null` and excluded from the denominator.
- The summary sentence names the denominator honestly.
- Nothing in the module, or in the strings it uses, contains the words "better", "worse", "wins" or "loses" — asserted by reading the source, because this is a rule about the product and not only about this function.
- The compare control offers the same search as the main box and cannot select the already-selected municipality.

- [ ] **Step 2: Implement**

- [ ] **Step 3: Commit**

`feat(site): compare two municipalities without declaring a winner`

---

### Task 7: The plain table

**Files:**

- Create: `src/components/DataTable.tsx`, `src/components/DataTable.test.tsx`

The twin of the map: 290 rows, the current indicator and year, sortable by name, value or rank. Reached as a URL view, so it is shareable and so a screen-reader user can choose it deliberately rather than being given a lesser version by default.

- [ ] **Step 1: Write the failing tests**

- A real `<table>` with a `<caption>` naming the indicator and year, and `<th scope="col">` headers.
- 290 rows, including the ones with no value — which show the reason, not a blank.
- Sorting by value puts the largest first and sets `aria-sort` on the right header; sorting again reverses it and updates `aria-sort`.
- Rows with no value sort to the end in both directions, rather than counting as zero.
- Sorting by name uses the Swedish collation, like search.
- Selecting a row reports the code, so the table and the map share one selection.

- [ ] **Step 2: Implement**

- [ ] **Step 3: Commit**

`feat(site): a sortable table twin of every map`

---

### Task 8: The cartogram

**Files:**

- Create: `src/components/Cartogram.tsx`, `src/components/Cartogram.test.tsx`
- Modify: `src/data/pantry.ts` to load the bubble layout

290 circles from `public/pantry/layout/bubbles.json`, sized by population and placed by the kitchen's Dorling layout. Same colours, same statuses, same selection, same roving tabindex, same arrow keys — it plugs into the socket the map already uses.

The animated morph between the two is explicitly **not** in this plan; it is an increment beyond the first slice. Switching views swaps one for the other.

- [ ] **Step 1: Write the failing tests**

- 290 circles, each with the same accessible name the map gives that municipality.
- A circle's fill comes from the same `fillFor` the map uses — assert one known cell matches between the two views.
- The selected municipality gets the same two-tone ring.
- Arrow keys work, using the **bubble** positions rather than the geographic centroids, because that is where the shapes now are.
- The layout's own bounds are respected: nothing is clipped by the viewBox.

- [ ] **Step 2: Implement, and check the arrow-key guarantee still holds**

Plan 3 proved every municipality is reachable by arrow keys **on the geographic layout**. The bubble layout moves every centroid, so that guarantee has to be re-established rather than assumed: run the same reachability assertion against the bubble positions. If it fails, say so and fix it here, with the numbers.

- [ ] **Step 3: Commit**

`feat(site): the bubble cartogram, as a view anyone can switch to`

---

### Task 9: The phone

**Files:**

- Create: `src/components/BottomSheet.tsx` and its test
- Modify: `src/components/App.tsx`, `src/styles/app.css`

Below the layout's breakpoint the cartogram is the default view — bubbles give equal tap targets and waste no width on a country three times taller than it is wide — and the profile arrives as a bottom sheet rather than a side panel.

**The default is a default, not an override.** `?v=map` on a phone shows the map. Whatever is in the URL wins, always.

- [ ] **Step 1: Write the failing tests**

- With no `?v=` and a narrow viewport, the cartogram renders; with `?v=map`, the map does.
- With no `?v=` and a wide viewport, the map renders.
- The sheet is non-modal like the panel: no focus trap, and the view behind it stays reachable.
- The sheet can be dismissed by its close button and by Escape, and focus returns where it came from.

- [ ] **Step 2: Implement**

- [ ] **Step 3: Commit**

`feat(site): bubbles and a bottom sheet on a phone`

---

### Task 10: Five facts that have to stay true

**Files:**

- Create: `src/facts/facts.ts`, `src/facts/facts.test.ts`, `src/components/FactsStrip.tsx` and its test

The five facts the architect chose, in both languages, each a link straight into the view that proves it.

**Each fact carries a check that re-derives its own claim from the pantry**, so a data refresh that falsifies one fails the build rather than leaving a confident false sentence on the front page. A fact is a `{ text, href, check }` triple and the test runs every `check`.

- [ ] **Step 1: Write the failing tests**

One test per fact, re-deriving the claim:

- Håbo's 1968 and 2024 populations give a rise of about 406%, and Åsele's a fall of about 53%.
- Counting municipalities whose 2024 population is below their 1968 population gives 124, out of 284 that have both figures. **The test must also assert the denominator**, because "124 of 290" would be wrong and is the easy mistake.
- Borgholm and Knivsta's 2025 mean ages are 53.3 and 37.8.
- Danderyd's 2025 house price divided by Malå's is about 22.
- Arjeplog's and Sundbyberg's 2025 densities are 0.2 and 6,529.

Every link must resolve to a state the site can render: parse each `href` with `parseState` and assert the municipality it names is the one the fact is about, and that the indicator and year are the ones that show it.

- [ ] **Step 2: Implement**

- [ ] **Step 3: Commit**

`feat(site): five facts, each one link away from its own proof`

---

### Task 11: Verify the whole thing

- [ ] **Step 1: The full suite**

`yarn typecheck`, `yarn lint`, `yarn test`, `yarn build`, and `yarn kitchen publish` reproducing the pantry. Report the test count, the bundle size and the pantry size — Plan 3 ended at 600 tests, 370 kB (116 kB gzipped) and a 272 kB gzipped pantry.

- [ ] **Step 2: A manual pass, written down**

Keyboard from the top of the page to the bottom in both views. Open a profile, compare, sort the table, switch to the cartogram, and check focus goes where each task said it would. Record what was checked and anything that felt wrong even if it was not fixed.

- [ ] **Step 3: Check the five facts on the live page**

Click each one and confirm it lands on a view that actually shows what it claims. A test proving the arithmetic is not the same as a link landing somewhere sensible.

- [ ] **Step 4: Update the docs and commit**

`docs: mark plan 4 done`

---

## What this plan deliberately leaves out

The animated morph between map and cartogram, the automatic facts engine, similar-municipality search, rule-generated profile prose, and pre-rendered municipality pages. All are increments beyond the first slice, each with its own decision record.

Plan 5 remains: Playwright, axe in CI, the Lighthouse budget, Cloudflare Pages, the monthly refresh job and the manual WCAG pass. **There is still no CI on this repository**, so nothing runs these tests automatically on a pull request.
