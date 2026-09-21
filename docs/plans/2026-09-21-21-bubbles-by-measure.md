# Plan 21 — Bubbles sized by the measure, a table that arrives, and an editorial polish

> Six pieces of feedback from looking at the site on 2026-09-21, one of which changes a DESIGN
> decision: "the bubble map sizing is always based on kommun size, shouldn't it reflect the
> current measure values chosen?"

## What is asked

1. The language switch and the theme switch look like two different controls.
2. The table view is not the same size as the map's plate.
3. Switching to the table cuts, where map↔bubbles travels.
4. The English tagline says "All from Statistics Sweden"; the Swedish says "Allt från SCB".
5. Bubbles are sized by population whatever the measure, so size says nothing about the value.
6. The site should look more modern and more editorial.

## The decision in the middle: what a bubble's size means

DESIGN section 1 says each bubble is "sized by population, so the visual lie of a normal Swedish
map is fixed in one gesture". The request is to make size follow the measure on screen, and
[ADR-0024](../decisions/0024-bubbles-sized-by-the-measure.md) records what that took to do
honestly. In one paragraph:

Size cannot follow the value on the population layout, because the positions were solved for
population radii and any other sizing overlaps in the dense regions. So **the kitchen publishes
one Dorling layout per indicator**, inside that indicator's own file. Each municipality's slot is
the largest bubble it takes in any year, so the year slider changes sizes and never positions. A
first prototype normalised sizes across all years and produced two failures, both measured: for
a measure that trends the same way everywhere, such as the tax rate, every 2026 bubble came out
the same size, and giving every slot near its maximum inflated the layouts into shapeless blobs
that drifted 300–460 units from geography and stranded municipalities from the arrow keys. So
**size is normalised within the year on screen** — the largest bubble is the year's highest value,
which is the question the request asked — while colour keeps its fixed cross-year breaks, and
**every layout has the same total bubble area, 13% of its box**, which is what keeps the country
recognisable (drift 11–23 units, the same as the layout it replaces). The arrow-key cone is chosen
per layout by the kitchen, from 45° upward, and the kitchen refuses to publish a layout it cannot
prove reaches all 290.

## Tasks

### Task 1 — One way to size a bubble (`shared/bubbles.ts`, TDD)

- [x] `sizeNorms(column, kind)`: each present value's position between the year's lowest and
      highest; diverging measures use magnitude from zero; absent stays absent.
- [x] `radiusFor(norm, { minR, maxR })`: area affine in the norm, floored at `minR` so a bubble
      with no value is drawn small rather than not at all.
- [x] `maxRadiusFor(sumOfMaxNorms, count)`: the largest radius that keeps the total slot area on
      the budget.
- [x] Tests cover monotonicity, the floor, absent values, magnitude for diverging, and the budget.

### Task 2 — The layout moves into the kitchen's per-indicator output (TDD)

- [x] `shared/navigate.ts` holds arrow-key movement and `strandedIn`, so the kitchen and the site
      use one rule; `src/map/navigate.ts` re-exports it.
- [x] `buildBubbleLayout` runs the Dorling on slots, tries a fixed list of spacing variants in
      order, takes the first whose narrowest cone in 45–60° reaches all 290, and throws — naming
      the indicator and the stranded codes — when none does.
- [x] Deterministic: sorted by code, fixed ticks, rounded output; slots are rounded UP so the
      site's radius can never exceed them.
- [x] `PantryIndicator` carries `layout`; `PantryData` carries `layouts`; cross-references check
      every layout's codes against the municipalities. `Bubbles` and `layout/bubbles.json` go.
- [x] `yarn kitchen publish` twice gives byte-identical output.

### Task 3 — The site draws the bubbles it is given

- [x] `MapCanvas` takes `layout`; radii come from the drawn year's norms inside the slots.
- [x] A change of indicator or year tweens the circles from where they are drawn to where they
      belong; the morph interpolates against the circle of the moment. Reduced motion snaps.
- [x] The cartogram's accessible name says which measure sizes it; the plate's caption says what
      size means in the bubble view.
- [x] Every published layout is proven in the tests: all 290 reachable at the published cone, no
      overlaps, no year's radius above its slot, on budget, and near the geography.

### Task 4 — The stage, the table and its arrival

- [x] One plate for every view, one height for every view. The table sits on the plate with its
      own caption line, so the box is the same size in all three.
- [x] Switching to and from the table is a `ViewTransition`; nothing moves under reduced motion.
- [x] The theme switch and the language switch share one control style.
- [x] The English tagline reads "All from SCB."

### Task 5 — The editorial polish

- [x] Controls share one height and one shape; figures right-align in tables; the year
      instrument, legend and facts strip are refined; colour tokens are unchanged so every
      contrast assertion still holds.
- [x] Checked by looking, in both themes, at desktop and phone width.

### Task 6 — Proof

- [x] `yarn typecheck && yarn lint && yarn test && yarn build`
- [x] `yarn e2e` in three engines
- [x] Decision record, DESIGN correction, docs in sync
