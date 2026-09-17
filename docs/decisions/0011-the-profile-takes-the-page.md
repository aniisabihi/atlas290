# 0011 — The profile takes the page

**Date:** 2026-09-17
**Supersedes:** [0010](0010-the-place-beside-the-map.md) D1, and only D1
**Status:** accepted

## Context

[Decision 0010](0010-the-place-beside-the-map.md) moved the municipality profile out from under
the facts strip, where a click on the map changed nothing a visitor could see, and put it in the
reading column beside the map. The architect chose that placement over the alternative on
2026-09-16 and, having used it, asked on 2026-09-17 for the ten measures to be full width again,
as they were before.

The request is right and 0010 read the defect one step too literally. What was wrong was never
that the profile sat below the map — it sat below **five facts**, and the ordering is the whole
of that defect. The column was a second change that came along with the fix and was not required
by it.

The cost showed up in the measures. A row is a name, a figure and a trend, and the reading column
is about 37 rem: at that width the name and the figure competed for the same line, which is why
0010 had to move the container query's stacking threshold from 34 rem to 40 rem. That was a
symptom being treated. Ten rows of figures want the page.

## Decision

**The profile has a row of its own inside the layout grid, the full width of both columns,
directly under the map and before the facts.** The comparison gets a third row beneath it. The
grid is now:

```
'reading view'
'place   place'
'against against'
```

Everything else in 0010 stands: the compare search is still in the profile header, the map is
still first in `<main>`, the facts are still below, and the ordering that was the actual defect is
still fixed.

## Consequences

The container query threshold stays at 40 rem. It is no longer load-bearing at desktop width,
where the rows are now about 78 rem, but it is still what lays a measure out on a phone and in the
bottom sheet, and 34 rem was measurably too low for both.

Clicking a municipality now scrolls, because the profile begins just below a map that fills most
of the window. The browser does that on its own: focus moves to the heading, which is unchanged
behaviour from 0010. What no longer holds is the assertion that the map stays exactly where it
was, and the browser test that checked it has been rewritten to assert what the placement is
actually for — the profile is brought into view, and it comes before the facts.

## Two bugs this found, both invisible to the suite that existed

**Two grid items given the same area are drawn on top of one another.** The first version put the
profile and the comparison both in `place`, and the comparison was painted straight through the
profile it is meant to follow. Every layout assertion in the suite was about where a box starts;
none was about where the box above it ends, so nothing failed. There is now a test that the
comparison begins at or after the profile ends, and the facts at or after the comparison ends.

**An auto side margin turns off a grid item's stretch.** `.compare` inherits `margin: 3.5rem auto 0`
from the rule that centres the page's standalone sections. As a block that centred it; as a grid
item it made the panel size itself to its content instead of to its track — 486 px of comparison
table inside a 320 px screen, pushing the whole document sideways. The reflow test caught this one
immediately, which is exactly what it is for. The fix is zeroed side margins plus `min-width: 0`,
the same declaration both columns already carry.

## Where this is re-derived

- `e2e/pointing.spec.ts` — the profile as wide as the layout and under the map, the comparison
  following it rather than over it, and both before the facts.
- `e2e/reflow.spec.ts` — no sideways scrolling at 320 px with a profile and a comparison open.
- `src/components/App.test.tsx` — the profile inside the layout and in neither column.
