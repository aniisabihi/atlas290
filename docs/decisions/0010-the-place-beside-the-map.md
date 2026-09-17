# 0010 — The place beside the map

**Date:** 2026-09-16
**Plan:** [Plan 11](../plans/2026-09-16-11-the-place-beside-the-map.md)
**Status:** accepted; **D1 superseded by [0011](0011-the-profile-takes-the-page.md)** — the
profile takes the full width of the layout under the map, rather than the reading column beside
it. Everything else here stands.

## Context

[Decision 0009](0009-the-design-language.md) gave the site a voice. Looking at what it had built,
the architect reported five defects on 2026-09-16, every one of them reproduced before anything
was written:

| Reported                                    | The mechanism                                                                                                                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The compare search is dressed differently   | The field's shape was written as `.bar :where(select, input, button)`. The same `SearchBox` rendered outside the bar therefore got the browser's default field, beside a name set in Newsreader. |
| The municipality lands under the facts      | `<main>` was the two columns, then the facts strip, then the compare panel, then the profile. Clicking a shape changed nothing a visitor could see, while the reading column sat empty.          |
| "Om det här måttet" does not look clickable | A `<summary>` paints the native triangle only while it is `display: list-item`; that one is a flex row so the heading sits beside the mark. The flex was taken and the mark was not put back.    |
| The table takes the whole page              | 290 rows laid out in the document: 13,342 px tall, and the sort controls in a header that scrolled away with it.                                                                                 |
| Hovering a shape should say what it is      | Nothing happened on hover at all. Every path already carried its whole reading in `aria-label` and the live region announced it — a pointer was the one input with no answer.                    |

A sixth was found while reproducing them: at phone width the profile's measure names and their
figures overprinted each other.

## Decisions

**D1 — The profile lives in the reading column, beneath the year and the legend.**
_Superseded by [0011](0011-the-profile-takes-the-page.md): the placement below the map was right,
the column was not, and ten rows of figures want the page._ Chosen by the architect
over replacing them. The visitor keeps the instrument in view and the column grows
downward, into space that was empty. The facts strip stays below both columns, where it is
somewhere to go next rather than a wall between a click and its answer. The map is still first in
`<main>` (0009 D6) and the heading is still the focus target on open.

**D2 — Compare is part of the profile's header.** The search sits beside the name it will pair,
and `ComparePanel` now renders only the comparison; choosing a partner is `CompareSearch`. The
field's shape moved off `.bar` and onto the control, so one rule dresses both placements.

**D3 — Every disclosure draws its own marker.** A chevron in the current text colour, rotated when
open, with a hover colour, on both fold-outs. `src/styles/app.test.ts` reads the stylesheet and
fails if a summary loses its marker again — jsdom applies no CSS, so no component test could ever
have caught this, and none did.

**D4 — The table is a view, so it takes the view's box.** One `--stage` is read by the map and by
its table twin. The table scrolls inside it with a sticky header, and all 290 rows stay in the
document so find-in-page, a screen reader's table mode and the reflow test read the same table.
The box is a named, focusable region: a thing that scrolls has to be reachable with a keyboard,
and Firefox adds that tab stop by itself whether or not it is asked to.

**D5 — The tooltip is the label, drawn.** Name, reading and rank, built from the same two strings
the shape's accessible name is built from. It is `aria-hidden`: the value is already in the
accessible name and already announced, so putting it in the tree would be the figure said twice.
No tooltip on touch, where a tap already opens the profile and a box under a finger covers what it
names.

**D6 — Pointing connects the page to the map, and nothing else.** A neighbour chip or a fact that
names a municipality rings that shape; a shape under the pointer marks its class on the legend.
None of it enters the URL.

**D7 — A highlight is not state, and the URL says so.** This is the third thing the site
deliberately keeps out of its own memory, after playback and morph progress. A hover is where the
pointer happens to be for as long as it happens to be there; writing it down would put a history
entry behind every mouse movement and make a shared link carry something nobody chose.

## What only running it found

**The skip link was obscuring the play button, and had been all along.** The link is inside the
sticky bar, so its containing block travels down the page rather than staying above the document:
the strip it occupies at `top: -4rem` is always over whatever content sits four rem above the bar.
Invisible, unreachable, and still first in the hit test. Nothing noticed until D1 made the page
scroll on open and put a target under it, at which point Firefox's axe run failed seven ways. It
is now `pointer-events: none` until focused, which is what the visual truth always was.

**Two sticky elements cannot both have `top: 0`.** The caption and the table header were given it
together; the header pinned underneath the caption and slid 42 px out of sight, taking the sort
controls with it. The caption names the table wherever it has scrolled to, so it does not need to
stay on screen and no longer tries.

**The phone defect was a desktop defect.** The container query that stacks a measure row fired at
34 rem, and the reading column is about 37 rem — so moving the profile there reproduced at 1440 px
exactly the overprinting first seen at 390 px. The threshold is 40 rem.

**A tooltip above the pointer is off the screen at the top of the map.** Kiruna is the largest
shape and the first many people will point at. The box flips below the pointer within 120 px of
the top of the window.

## What the review found

An adversarial review of the finished diff found two real defects in the tooltip, both of them
flashes, and both of them cases the first round of tests could not have caught.

**The guard against the morph was the wrong guard.** D5 says the tooltip must not be drawn while
the shapes are travelling. What was written only cleared a hover taken in the _previous_ view —
and `view` flips the instant the button is pressed, 650 ms before the shapes arrive. A pointer
moved during the animation took a fresh hover, in the new view, and the box came straight back
over shapes that were nowhere near where it said they were. `useMorph` exposes no progress at all
— it writes frames to the DOM and returns nothing — so the frame loop now records whether it is
mid-flight in a ref, which is free, and the event handler reads it.

**A tap flashed the tooltip.** D5 says there is none on touch, and `onPointerMove` ignored touch
correctly. But selecting a municipality calls `focus()` on its shape, and a focus event says
nothing about what caused it — so a tap raised the box under the finger already covering the
shape, for the one render before the profile took focus away. The kind of press is now recorded
on `pointerdown` and a touch-caused focus draws nothing.

**Both of the tests written for these passed against the unfixed code.** They looked for the box
after the fact, and by then it had already gone in both cases. They now watch for it _appearing_
— a mutation observer for the tap, and a loop driven inside the page for the morph, because
driving the pointer over the wire took longer than the animation in Firefox and WebKit and the
test was failing for being slow rather than for finding anything. Both were re-run against the
unfixed code and fail in all three engines.

**A pointer move was re-rendering all 290 shapes.** `showHover` stores a new position object on
every native `pointermove`, so React could not bail out, and the render rebuilt every shape —
290 observation lookups and 290 `Intl.NumberFormat` constructions — to move a small box a few
pixels. The docstring claiming locality avoided this was wrong about its own component. The
shapes are now built in a `useMemo` that a pointer position is not a dependency of. `DataTable`,
which takes no part in any of this but re-sorts and re-formats 290 rows on every render, is
memoised for the same reason.

Two smaller things: the widened field selector was wrapped entirely in `:where()`, which scores
zero specificity and would have lost silently to the next rule naming a class; and the
stylesheet test asserted that _some_ selector hides the native marker and _some_ selector draws
one, never that they are the same selector — so it would have gone on passing through a repeat of
the exact defect it was written for. It now checks each markerless summary has a marker rule of
its own, and that was proven by planting one.

## Consequences

|                                      | before         | after                 |
| ------------------------------------ | -------------- | --------------------- |
| Lighthouse performance               | 84             | **83** (81, 83, 83)   |
| accessibility / best practices / SEO | 100 / 100 / 91 | 100 / 100 / 91        |
| script bytes                         | 125,410        | 126,904 (budget 180k) |
| document height, table view at 1440  | 13,342 px      | **1,331 px**          |
| unit tests                           | 1,122          | 1,176                 |
| browser tests, 3 engines             | 241            | 280                   |

`public/pantry/` is untouched — not one figure changed. Performance moved a point inside a
measured spread of 81–83, against a floor of 72.

## Where this is re-derived

- `src/styles/app.test.ts` — the disclosure marker, the shared stage height, the sticky header,
  and the search field keeping its shape outside the bar. The stylesheet read as text, because
  jsdom applies none of it.
- `e2e/pointing.spec.ts` — the profile in the viewport with the map still in it, the table in the
  map's box scrolling internally, the tooltip matching the label it duplicates, the ring, the
  legend mark, and the URL not moving for any of it.
- `src/components/MapCanvas.test.tsx` — the tooltip's text, its absence from the accessibility
  tree, and the ring that is not drawn twice over a selection.
- `src/components/ComparePanel.test.tsx` — the compare search as the same control as the bar's.
- `src/components/App.test.tsx` — where the profile renders, and what the header holds.
