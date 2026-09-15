# 0004 — How the morph is built

**Date:** 2026-09-15
**Plan:** [Plan 8](../plans/2026-09-15-08-the-morph.md)
**Status:** accepted

## Context

[DESIGN section 9](../DESIGN.md#9-still-open) parked two questions as "deliberately undecided
until we prototype": whether the animated morph needs a Canvas layer beneath the SVG to hold 60
frames per second on a mid-range phone, and whether the morph target should be the bubble
cartogram or a hexagon grid.

A prototype was built on 2026-09-15 against the real geometry, run in Chromium, Firefox and
WebKit, and then under Chromium's CPU throttling. Both questions are closed here.

## Decisions

### D1 — SVG, with no Canvas layer

Per-frame work for all 290 shapes against a 16.7 ms budget, Chromium under CDP CPU throttling.
4× to 6× is the usual stand-in for a mid-range phone:

| Approach         |   1× |   2× |    4× |        6× |       10× |
| ---------------- | ---: | ---: | ----: | --------: | --------: |
| 16-point SVG     | 0.97 | 1.97 |  3.98 |      5.94 |      10.4 |
| **32-point SVG** | 1.59 |  3.4 |  6.67 |     10.12 | **17.47** |
| 64-point SVG     | 2.84 | 5.98 | 12.06 | **18.01** | **34.67** |
| 32-point Canvas  | 1.31 | 2.69 |  5.35 |      8.07 |     13.48 |
| transform only   | 0.54 | 1.09 |  2.22 |      3.17 |      6.06 |

Bold misses the budget. SVG at 32 points holds 60 fps at 6× with 40% of the frame spare.

Canvas is faster — between 1.2× and 2.9× depending on engine — and is not needed. It would also
be permanent: DESIGN's own constraint puts a Canvas _beneath_ the SVG focus and ARIA layer, never
replacing it, so the SVG with its 290 focusable shapes exists either way and choosing Canvas
means maintaining two renderers of the same 290 things and keeping them in step forever.

Unthrottled, every variant pins to exactly 16.7 ms in all three engines — they are waiting for
the display, not for the work. Only the throttled column decides anything, which is why the first
round of rAF timings was worth nothing.

If a real device ever proves slower than 6×, the fix is fewer sample points, not a second
renderer: 16 points still fits at 10×.

### D2 — 32 sample points

The rule is the most faithful resampling that still fits a phone-class frame budget. 64 misses at
6×, so 32 it is. Explicitly not chosen for looks: rendered stills show 16 and 32 nearly
indistinguishable mid-morph, and 16 would have been chosen had 32 not fitted.

### D3 — Bubbles, not hexagons

This turned out not to be a performance question at all, so no prototype was built for it. The
cartogram has shipped as bubbles since Plan 4, addressable at `?v=cartogram`, with an arrow-key
cone measured against that layout (50°, against the map's 45°) and its own tests. A morph has to
end at the view that already exists, or it is a transition to a third thing nobody can otherwise
reach. Hexagons would mean a new layout in the kitchen, a new published file, a re-measured cone,
and replacing a view that works — for an aesthetic preference, not a measured gain.

### D4 — Resampled in the site, not the kitchen

22–39 ms once per load, against roughly 150 kB added to the pantry if the sampled points were
published. The sampling also depends on the browser's own `getTotalLength`/`getPointAtLength`,
and the kitchen has no DOM to measure a path with.

### D5 — One frame for both layouts

The map is projected into a 1000×2000 frame. The bubble layout is published in a unit square that
is not square: x runs 0.0535 to 0.8964 and y 0.0544 to 1.0609, because a circle near an edge
spills past it. That is 0.837 wide for every 1 tall against the frame's 0.5.

Multiplying x by the frame width and y by its height is the obvious thing and is wrong twice
over: the layout comes out stretched to twice its height, and a radius would need two different
values depending on which way it was measured. The prototype did exactly this and its stills show
the bubbles running off the bottom.

So the layout is placed by **one uniform scale and one offset**, fitted rather than filled so
nothing is clipped. The viewBox then travels with the shapes, from the map's full frame to a tight
box around the placed circles — which is what keeps the bubbles filling the panel at rest exactly
as they did before, instead of being letterboxed into a 1:2 frame.

### D6 — Reduced motion does not move at all

Not a shorter morph and not a faster one: with `prefers-reduced-motion` the clock never schedules
a frame, the value is derived rather than animated, and the views cross-fade. A 290-shape flight
across the screen is the largest movement on this site, and the setting exists for the people that
harms.

### D7 — The morph is a transition, not a third view

The URL keeps `?v=map` and `?v=cartogram`. Nothing addresses a half-morphed state: a link to "40%
of the way to the bubbles" is not a view anybody wants to share, and what a visitor can _reach_ is
still exactly the two ends.

## Consequences

- `MapView` and `Cartogram` are gone; `MapCanvas` is both. Their two test suites were carried
  over rather than rewritten — only what named a component changed.
- **The morph has no unit-test coverage and cannot have any.** jsdom implements neither
  `getTotalLength` nor `getPointAtLength`, so every component test runs the fallback path where
  the views cut. `e2e/morph.spec.ts` is the only thing that exercises the morph, in three real
  engines.
- That fallback is a supported state, not a failure: without path measurement the views still
  switch, they simply cut. The morph is the enhancement; reaching the cartogram is not.
- The performance budget in CI is the regression alarm for D1.

## Where the numbers are re-derived

- `src/map/frame.test.ts` — the uniform scale, fit-not-fill, and which axis limits.
- `src/map/morph.test.ts` — sampling, the start angle that stops a shape spinning, and that both
  ends return the real geometry.
- `src/state/useMorph.test.ts` — the easing, reversing mid-flight, and that reduced motion
  schedules no frame at all.
- `e2e/morph.spec.ts` — the morph itself.
