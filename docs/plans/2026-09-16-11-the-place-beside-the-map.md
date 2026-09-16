# Plan 11: The place beside the map

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. **Approved by the architect on 2026-09-16 and executed the same day; every task below is done.**

**Goal:** Plan 10 gave the site a voice; this plan makes it answer. Today a visitor who clicks a
municipality sees nothing change above the fold — the profile renders below the facts strip,
beneath the fold, while the left column sits empty under "Om det här måttet". Hovering a shape
does nothing. The table view stretches the page to 13,000 pixels. Two disclosures look like
labels, and the same search box is dressed twice. This plan fixes the five defects the architect
reported on 2026-09-16, one more found while reproducing them, and adds the small interactions
that make the map, the prose and the facts read as one instrument.

**Architecture:** No new runtime dependency, no change to the kitchen, the pantry, the URL grammar
or the state model. This is CSS, the placement of elements in `App.tsx`, one new component (the
tooltip), and behaviour added to components that already exist. Hover and highlight are
**not** URL state: they are transient pointer feedback, like morph progress, and are the third
documented exception to "the URL is the state".

**Spec:** the architect's report of 2026-09-16, [decision 0009](../decisions/0009-the-design-language.md)
(which this plan does not overturn) and DESIGN section 5 (accessibility).

## What was checked before this was written

Reproduced on the dev server at 1440×900 and 390×844, in both themes, on 2026-09-16.

| Reported                                             | Found                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compare search box differs from the bar's            | Same `SearchBox` component. The bar wraps it in `.search`, which carries the input width, the mono label and the listbox styling; inside `ComparePanel` it renders bare, so it is a default-sized input with a tiny label above the profile name.                                 |
| Municipality information lands under the "questions" | `<main>` is `.layout` (view + reading columns), then `FactsStrip` ("Sådant du inte tänkt fråga om"), then `ComparePanel`, then `ProfilePanel` (`App.tsx:275–320`). On desktop the profile heading receives focus and the browser scrolls, but the visitor sees the map jump away. |
| "Om det här måttet" has no disclosure affordance     | `.about-indicator summary { display: flex }` removes the native `::marker` (a summary only draws it as `list-item`). The footer's "Källor och licenser" summary is `list-item` and shows ▶. No hover style either.                                                                |
| Table takes the full height                          | `.table-scroll` is `overflow-x: auto` only; 290 rows flow into the document. The map plate is 684 px tall at 1440×900 (the SVG is height-driven from a 1000×2000 frame). Sort buttons live in `<thead>` and scroll away.                                                          |
| Hover should show name and value                     | Nothing on hover: no `:hover` rule on `svg.map path`, no tooltip element. Every path already has `role="button"` and `aria-label="Upplands Väsby, 50 495 invånare — SCB har lagt till slumpmässigt brus i värdet"` (`MapCanvas.tsx:308–309`), so the text exists.                 |
| _(found)_ Phone profile rows collide                 | At 390 px `.profile-row`'s `auto` value column and `176px` trend column leave the name too little room: "Flyttningsöverskott per 1 000 invånare" and "Medianinkomst"'s "måttet publiceras inte för det här året" overprint. The container query needs a narrow layout.            |

Numbers on `main` at 2026-09-16 that this plan must not worsen: Lighthouse 84 / 100 / 100 / 91,
script bytes 125,410 (budget 180,000), fonts 96.5 kB (budget 120 kB), 1,122 unit tests, 196
browser tests in three engines, `public/pantry/` byte-identical.

## The decisions this plan makes

**D1 — The profile lives in the reading column, beneath the instrument.** Chosen by the architect
("beneath", 2026-09-16) over replacing the headline and slider. The visitor keeps the year and the
legend in view; the column grows downward, where it was empty. The facts strip stays below the
layout. On a phone the bottom sheet stays exactly as it is; this is a desktop placement change.
The map remains first in `<main>` (0009 D6) and the profile heading remains the declared focus
target on open.

**D2 — Compare is part of the profile header, not a panel above it.** The "Jämför med…" search
sits in the header row beside the name, styled as the bar's search is (one `.search` rule, two
placements), and the compare table appears in the reading column under the profile when a partner
is chosen. `ComparePanel` keeps its markup and its "no winner" sentence (0009 D8).

**D3 — Disclosures look like disclosures.** Every `summary` on the site draws an explicit chevron
in the text colour, rotated 90° when open, with a hover colour — the same mark in the reading
column and in the footer. No `display: flex` on a summary without the marker put back by hand.

**D4 — The table is a view, so it takes the view's box.** The table view is exactly as tall as the
plate would be, scrolls inside, keeps its header (and the sort buttons in it) sticky, and keeps
the whole 290 rows in the DOM so find-in-page, screen readers and the reflow spec see the same
table. On a phone the same rule applies to the bubble stage's height.

**D5 — One tooltip for pointer and keyboard, never the only place a value lives.** Hovering or
focusing a shape shows name, value with unit, and rank, drawn from the same reading the
`aria-label` already carries. Pointer: positioned at the cursor, hidden on leave. Keyboard: at the
shape's bounding box, following arrow-key focus. Touch: tap already selects, so no tooltip on
touch. It is **not** wired into the accessibility tree: the shape's `aria-label` already names
the value, so the tooltip is an `aria-hidden` visual duplicate and the live region is unchanged.
It respects reduced motion (no fade) and is not rendered during the morph.

**D6 — Hover connects the page to the map, and nothing else changes.** Hovering a "places like
this" chip or a fact whose link names a municipality (`m=` or `c=` in its href) rings that shape
on the map; the selected municipality is ringed while its profile is open; hovering a shape puts
a tick under its class on the legend. All of it is CSS on a `data-highlight` attribute or a
class, none of it enters the URL, and all of it is invisible to the accessibility tree.

**D7 — Motion is short and reducible.** Tooltip, panel and chevron transitions are ≤ 200 ms and
disabled under `prefers-reduced-motion`, as everything else on the site already is.

## What this plan does not do

- It does not touch the kitchen, the pantry, the URL grammar or the facts engine.
- It does not restyle the morph (decision 0004) or redraw the preview cards.
- It does not add a measure, a view or a page.
- It does not run a screen-reader pass; that gap stays recorded in `docs/accessibility.md`.

## Tasks

### Task 1 — One search box

- [x] Give `SearchBox` its own root class (`.search`) so the wrapper styling travels with it, and
      let the bar and the profile header pass a `variant` for width only.
- [x] Move the compare search into `.profile-header`, after the name, before "Stäng".
- [x] Test (`SearchBox.test.tsx`, `ComparePanel.test.tsx`): both placements render the same
      roles, labels and listbox; the compare field's accessible name is "Jämför med…" in Swedish
      and its English twin.
- [x] Verify: `yarn vitest run src/components/SearchBox.test.tsx src/components/ComparePanel.test.tsx`.

### Task 2 — The profile moves into the reading column

- [x] `App.tsx`: render `ProfilePanel` (with `ComparePanel` under it) inside `.reading-column`
      after `AboutIndicator` when `!narrow`; keep the sheet path unchanged when `narrow`.
- [x] `FactsStrip` stays after `.layout`.
- [x] Focus on open still lands on `#profile-heading`; the reading column is not sticky.
- [x] Test (`App.test.tsx`): with a selection, the profile heading is a descendant of the reading
      column at desktop width and of the sheet at phone width; DOM order is map → reading column
      → facts.
- [x] e2e (`state.spec.ts`): after clicking a shape at 1440×900 the profile heading is in the
      viewport without scrolling the map plate out of view (`boundingBox` of `#map` unchanged).

### Task 3 — Disclosures

- [x] `app.css`: a shared `summary` rule with an inline SVG chevron (`::before`), rotation on
      `[open]`, `:hover` colour; remove `display: flex` from `.about-indicator summary` or restore
      the marker within it. Apply to the notices summary too.
- [x] Test (`AboutIndicator.test.tsx`): toggling reveals the description; the summary is a
      `button`-like disclosure with `aria-expanded` state readable via the native element.
- [x] axe in both themes still green (Task 8).

### Task 4 — The table takes the plate's height

- [x] `.view-column` owns the stage height: one `--stage-height` derived from the plate (the
      `map-frame` today) and applied to `.table-scroll` as `max-height` with `overflow: auto`.
- [x] `thead th { position: sticky; top: 0 }` with a background token so rows never show
      through; the caption stays visible.
- [x] Phone: same rule against the bubble stage's height.
- [x] Test (`DataTable.test.tsx`): 290 rows are all in the DOM; the scroll container has the
      class the CSS binds to.
- [x] e2e (`reflow.spec.ts`): at 320 px no horizontal document scroll; (`state.spec.ts`) with
      `?t=1` the document height is within 1.5 × viewport height at 1440×900.

### Task 5 — The tooltip

- [x] `MapTooltip.tsx`: renders name, value and rank for a code, positioned from a pointer
      position or a shape's `getBBox()`; `aria-hidden="true"`; hidden while `useMorph` reports
      progress strictly between 0 and 1.
- [x] `MapCanvas.tsx`: `onPointerEnter`/`onPointerMove`/`onPointerLeave` on the `<svg>` with event
      delegation (one listener, not 290), reading the code from the target's `data-code`;
      `onFocus` per shape sets the same hovered code. Pointer type `touch` is ignored.
- [x] A `:hover`/`[data-hover]` stroke on the shape, two-tone like the focus ring, so the pointer
      target is visible against every class fill.
- [x] Test (`MapCanvas.test.tsx`): pointer move over a shape renders the tooltip text equal to
      the shape's `aria-label` reading; leaving hides it; focus shows it; the live region text is
      unchanged by hover.
- [x] e2e (`keyboard.spec.ts`): arrow-key focus moves the tooltip with the shape.
- [x] Verify the frame budget claim of decision 0004 is untouched: no per-path handler, no state
      update during morph.

### Task 6 — Hover connects the page

- [x] `SimilarPlaces` chips and facts links expose `data-code` where their href names a
      municipality; `App.tsx` holds a `highlight: string | null` and passes it to `MapCanvas`,
      which sets `data-highlight` on that shape.
- [x] The selected municipality's shape is ringed (`data-selected`) while the profile is open.
- [x] `Legend` accepts a `hoveredValue` and draws a tick under the class it falls in; no text
      changes.
- [x] Tests (`SimilarPlaces.test.tsx`, `FactsStrip.test.tsx`, `Legend.test.tsx`): hover sets and
      clears the highlight; a fact without `m=` sets nothing; the tick lands in the right class
      for a value on each break.

### Task 7 — The phone profile rows

- [x] `.profile-row` gets a narrow container-query layout: name on its own line, value and rank
      beneath, trend full width; no `white-space: nowrap` on the absence text.
- [x] Test (`ProfilePanel.test.tsx`): each row renders name, value, rank and trend in the
      expected order regardless of width (structure only; jsdom measures nothing).
- [x] Screenshot at 390 px checked by eye for the two rows that overprinted.

### Task 8 — Prove it, then write it down

- [x] `yarn typecheck && yarn lint && yarn test && yarn build`; `yarn e2e` in all three engines.
- [x] axe in both themes on every covered state plus a hovered-shape state and the table view.
- [x] `yarn budget`: performance ≥ 80 (expected unchanged; the tooltip adds under 2 kB).
- [x] `yarn kitchen publish` leaves `public/pantry/` byte-identical.
- [x] Screenshots: front page, profile, compare, table, phone profile, both themes.
- [x] `docs/decisions/0010-the-place-beside-the-map.md` with D1–D7 and the measured numbers;
      `docs/plans/README.md` adds Plan 11 to the third slice; `docs/DESIGN.md` section 3 names
      hover as the third non-URL exception; `docs/accessibility.md` states what the tooltip is
      and is not for a screen reader.
- [x] Final review, then open a PR against `main` from `feat/plan-11-the-place-beside-the-map`.

## What was measured when it was done

| Gate                                | Result                                     |
| ----------------------------------- | ------------------------------------------ |
| Unit tests                          | 1,175 pass (1,122 before)                  |
| Browser tests, 3 engines            | 274 pass, 2 skipped (241 before)           |
| Lighthouse, median of 3             | 82 / 100 / 100 / 91, all within budget     |
| Script bytes                        | 126,797 (budget 180,000)                   |
| Document height, table view at 1440 | 1,331 px, from 13,342 px                   |
| `public/pantry/`                    | byte-identical                             |
| Docs                                | decision 0010, DESIGN §3, accessibility.md |

Setup, commands, environment, deployment and integrations are all unchanged, so the
writing-documentation skill is N/A for this plan.

## Verification, in one line each

| Task | Signal                                                                        |
| ---- | ----------------------------------------------------------------------------- |
| 1    | Both search boxes share one class; unit tests green                           |
| 2    | Profile heading inside `.reading-column` at 1440; e2e keeps the plate in view |
| 3    | Chevron visible closed and open in both themes; axe green                     |
| 4    | `?t=1` document height ≤ 1.5 × viewport; header sticky; 290 rows in DOM       |
| 5    | Tooltip text equals the shape's reading; hidden on leave and during the morph |
| 6    | Highlight follows chip and fact hover; legend tick lands in the right class   |
| 7    | 390 px screenshot: no overprint on the two named rows                         |
| 8    | Full gate green, pantry identical, decision 0010 written                      |
