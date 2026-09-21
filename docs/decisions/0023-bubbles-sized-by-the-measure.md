# 0023 — Bubbles sized by the measure

**Date:** 2026-09-21
**Plan:** [Plan 21](../plans/2026-09-21-21-bubbles-by-measure.md)
**Status:** accepted. Corrects DESIGN section 1's "each municipality is sized by population".

## Context

The bubble cartogram had one layout, a Dorling sized by 2024 population, and the site drew every
one of the forty-two measures on it. A bubble's size therefore said how many people lived there
whatever the map was about, and colour alone carried the measure. The request that opened this
plan put it plainly: "the bubble map sizing is always based on kommun size, shouldn't it reflect
the current measure values chosen? So it's easy to see which kommun has the highest value besides
the colour."

That is a change to a DESIGN decision, and it turned out not to be a small one. What follows are
the seven rulings it took, each settled by measuring rather than arguing, in the order they were
forced.

## Decisions

### D1 — One layout per indicator, published inside that indicator's file

Size cannot follow the measure on the population layout. Its positions were solved for population
radii — Stockholm's neighbours sit exactly as far from it as a 990,000-person bubble needs — so any
other sizing puts bubbles over each other wherever municipalities are dense, which is precisely
where the interesting values are. Three alternatives were considered and rejected: allowing the
overlaps and drawing small-over-large, which turns the Stockholm and Skåne regions into blobs for
any income-like measure; capping each bubble at its population slot, which makes size a fraction
of population again and answers the wrong question; and a runtime force layout per year, which
moves every bubble as the slider moves, adds a dependency to the site, and breaks the arrow-key
proof the layout has carried since Plan 4.

So the kitchen solves a Dorling per indicator, from the slots that measure needs, and each
indicator's file carries its own — the way it already carries its own prose. The single
`layout/bubbles.json` is gone. Each file grows by about 14 kB raw; the index does not grow at all,
so first paint is unchanged in what it fetches and the layout arrives with the series it sizes.

### D2 — A slot is the largest bubble a municipality takes in any year

The year slider must change sizes and never positions. A bubble that grows and shrinks in place
reads as one municipality changing; one that also wanders reads as a different picture. So each
municipality's slot is sized for the biggest bubble it takes in any published year, the collision
is solved once for those, and no year can overlap because none exceeds what was solved for.

The promise is checked from both ends. The kitchen rounds slots UP to two decimals and the
maximum radius DOWN to four, so the site's arithmetic can never land above the slot; and
`kitchen/src/geometry/layouts.test.ts` recomputes every cell of every published series through the
shared rule and asserts none exceeds its slot — 123,000 cells, forty-two times.

### D3 — Size is normalised within the year on screen; colour keeps its fixed breaks

The first prototype normalised size across all years, the way the colour breaks are fixed across
all years, and it produced a picture that answered nothing. For a measure that trends the same
way everywhere — the tax rate has risen in nearly every municipality — every 2026 bubble came out
within a few per cent of the same size: a field of identical dots, with the whole question the
request asked ("which one is highest") left to the colour that was already answering it.

So size is relative to the year: the largest bubble is that year's highest value and the smallest
its lowest. Colour is unchanged and still fixed across years, so a municipality that darkens has
genuinely changed. The two channels now answer two different questions — colour says how high,
size says who is highest right now — and the plate's caption says so in words. The cost is
recorded plainly: during playback a bubble can grow while its value falls, if the rest fell
faster. Its colour will say so, and the announcement and tooltip carry the value and rank.

Diverging measures are compared by magnitude from zero, so net migration of −20 and +20 are
equally large bubbles; the ramp already says which way.

### D4 — Every layout spends the same total area, 13% of its box

This is the ruling that kept the country recognisable, and it was found by failing. Without a
budget, the first prototype gave every slot near the maximum radius for any measure that had
risen everywhere, and the 290 circles inflated into a shapeless blob:

| layout                    | mean drift from geography | stranded from the arrow keys |
| ------------------------- | ------------------------: | ---------------------------: |
| population (old file)     |                        28 |                            0 |
| tax rate, no budget       |                       405 |                            1 |
| mean age, no budget       |                       298 |                            2 |
| fertility rate, no budget |                       351 |                            7 |
| every layout, at 13%      |                     11–23 |                            0 |

Drift is the mean distance a bubble sits from its municipality's centroid, in layout units where
the box is 1000 wide. The population layout this replaces filled 12% of its box. At 13% every one
of the forty-two layouts drifts between 11 and 23 units, and the shape of Sweden is the shape of
Sweden. The budget decides each indicator's maximum radius: a skewed measure — population, density,
greenhouse gas — gets a large one (44 to 50 units) because most of its bubbles are small, and a
flat one gets 12 to 20. That is the honest consequence of 290 bubbles that must all be visible
in one box: a measure where every municipality is much the same has no room for any to be large.

### D5 — The smallest bubble is eight units, never zero

A bubble with no value, or the year's lowest, is drawn at `MIN_R` rather than vanishing: a shape
that disappeared would take its accessible name, its pattern fill and its tab stop with it. Eight
rather than the six first tried, and the reason was the arrow keys: at six, the dense clusters of
tiny bubbles around Stockholm left municipalities that no arrow key from anywhere could land on in
seven of the forty-two layouts — incomes, house prices, employment, new dwellings, greenhouse gas,
the education gap — even with the cone widened to 90°. At eight, every layout is reachable at 45°
or 50° with the default spacing. A side effect worth having: the smallest municipalities, which
were two-pixel dots on the population layout, are now visibly there.

### D6 — The kitchen proves each layout reachable, and publishes the cone it proved

Plan 3 proved every municipality arrow-reachable on the geographic map and Plan 4 measured a 50°
cone for the one bubble layout, both by hand against fixed positions. Forty-two layouts that
change with every data refresh cannot be measured by hand. So arrow-key movement moved to
`shared/navigate.ts`, where both programs can call it, and `buildBubbleLayout` tries a fixed list
of six spacing variants in order, takes the first whose narrowest cone in 45–60° reaches all 290,
publishes that cone with the layout, and **refuses to publish at all** when none does, naming the
indicator and the stranded codes. The site navigates by the published cone. On the current data
forty layouts use 45° and two use 50°; the remaining variants are insurance against a refresh.

### D7 — No schema version bump

Adding a required `layout` to each indicator file is not compatible with an old file, but there
is no mixed state in which that matters: the pantry is regenerated whole, CI refuses any publish
that is not byte-identical, and Cloudflare serves the JSON with revalidation so a new bundle never
reads a cached old file. ADR-0022 bumped nothing for the same reason in the other direction. The
in-memory `PantryData` carries `layouts` as an optional field, because the kitchen builds and
checks a pantry's numbers before it lays anything out and the tools that read a pantry back have
no use for positions — but `splitPantry` refuses to write a file without one.

## What this found along the way

- **The language switch matched no CSS rule.** Its selector named an `a` inside `.language-switch`,
  and the element IS the `a`. It had rendered as a browser-default underlined link beside a styled
  button since Plan 10, which is what the request's first item was noticing.
- **Reduced motion did not do what the code said.** `useReducedMotion` documented that colours ease
  between years and snap under the setting; nothing in the stylesheet eased them. They do now, and
  the setting stops it.
- **The browser suite caught a regression the unit tests could not.** Opening a profile fetches the
  other forty-one indicator files, and each arrival rebuilds the site's lookup object. The first
  version keyed the bubbles' norms on that object, so identical norms were recomputed forty-one
  times, each a new target, each a fresh 450 ms tween repainting all 290 paths — nothing visible,
  and enough main-thread work that WebKit began missing clicks on the profile's links while the
  files landed: two failures in eight runs of `e2e/similar.spec.ts`, against none in sixty-six on
  `main`. The norms are keyed on the series object, which is the same one throughout, and a unit
  test now asserts that an unrelated arrival schedules no frame at all.
- **The morph's circle samples were fixed at load.** `MorphPair` carried a sampled destination
  circle; with radii per year and positions per indicator, the destination is per frame. The pair
  now carries unit directions aimed at the outline's start, and each frame places them on
  whatever circle is current — a multiply and an add per point.

## Consequences

- `public/pantry/`: 42 indicator files gain a `layout`; `layout/bubbles.json` is deleted; the index
  is unchanged. Two publishes from the same frozen data are byte-identical.
- The cartogram's accessible name says which measure sizes it, and the plate's caption says what
  size means in that view.
- `MapCanvas` runs two clocks: the morph, and a 450 ms tween that carries every bubble from where
  it is drawn to where it now belongs when the year or indicator changes. Both write frames
  straight to the DOM, for the reason ADR-0004 gives. Reduced motion snaps both.
- The static page-per-municipality preview cards are unaffected: they draw the map, not the
  bubbles.
- DESIGN section 1's "each municipality is sized by population, so the visual lie of a normal
  Swedish map is fixed in one gesture" is no longer true and is corrected in place. The population
  cartogram still looks like the population cartogram, because population's own layout is one of
  the forty-two.

## Where the numbers are re-derived

- `shared/bubbles.test.ts` — the sizing rule: norms, the floor, area-affine radii, the budget.
- `kitchen/src/geometry/bubbles.test.ts` — the builder on five municipalities: determinism, order
  independence, slots hold every year, the cone search, the refusal.
- `kitchen/src/geometry/layouts.test.ts` — every published layout: reachable at its cone, no
  overlaps, no year above its slot, on budget, and within 50 units of the population layout.
- `shared/pantry-split.test.ts` — the contract: the layout travels with its file, and the codes
  are joined to the municipalities in both directions.
- `src/components/MapCanvas.test.tsx` — the site navigates by the published cone over the placed
  circles.
