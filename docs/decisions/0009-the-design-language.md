# 0009 — The design language

**Date:** 2026-09-16
**Plan:** [Plan 10](../plans/2026-09-16-10-the-design-language.md)
**Status:** accepted

## Context

[DESIGN section 9](../DESIGN.md#9-still-open) carried "visual design language" as open from the
first day. By the time the second slice finished, it was the largest gap in the project: a
visitor met a heading, a tagline and four bordered boxes that read like a settings form, with the
map in a side column beneath two lines of instructions, and the five auto-generated facts — the
most remarkable thing here — as underlined links near the footer.

Settled from four mockups drawn on the real pantry (front page, profile, compare, phone) and
chosen by the architect before any code was written.

## The constraint that decided the palette

`--map-ground` is `#ffffff` and cannot move: the ColorBrewer ramp is calibrated against white,
its lightest class is `#f7fbff`, and `src/map/colour.ts` guarantees every no-data pattern is at
least as light as that class so an absence can never be misread as a low value.

A white plate on a white page is a hole. **So the page ground is never white, in either theme** —
cool grey in light, near-black in dark — and the map reads as a printed sheet on a desk, or a
print under a lamp. The drawback became the organising idea, and the accent is the ramp's own
darkest step, so the page and the data are one colour system rather than two.

## Decisions

**D1 — Editorial, not dashboard.** The generated prose and the found facts are what nothing else
in Sweden has and were the least visible thing on the page. An editorial layout is the only one
of the three directions considered that structurally fixes that, because it puts the writing
first.

**D2 — Light is the standard; both themes ship; the visitor can choose.** Three states, not two:
nothing stored and no preference gives light; a dark system applies only to a visitor who has not
chosen; an explicit choice beats the system **in both directions**. The old two-state stylesheet
could not express "light on a dark machine" at all.

**D3 — Three self-hosted faces, subset, never a font CDN.** Newsreader for display, IBM Plex Sans
for text, IBM Plex Mono for every figure. The README promises no server, no runtime API and no
tracking, and the notices page lists what the site loads; a CDN link would have quietly made both
untrue. Both faces are SIL OFL 1.1, verified at source, and the licence texts ship beside them.

**The character set is derived, not guessed** — every character in the pantry and in the string
tables. A character outside what the source files carry fails the build rather than rendering as
tofu, which it did on the first run.

**D4 — The variable weight axis is cut to 400–600, and that is what made three faces fit.**
Newsreader ships 200–800 and Plex Sans 100–700; the design uses regular through semibold.

|                     | full range | 400–600     |
| ------------------- | ---------- | ----------- |
| Newsreader normal   | 37.9 kB    | **25.2 kB** |
| Newsreader italic   | 42.8 kB    | **28.6 kB** |
| Plex Sans           | 30.5 kB    | **23.8 kB** |
| Plex Mono 400 + 500 | 18.9 kB    | 18.9 kB     |
| **total**           | 130.1 kB   | **96.5 kB** |

Against a 120 kB budget. Without the axis cut the monospace would have been dropped.

**D5 — One sticky bar carries identity and controls**, which frees the hero and is what makes D6
possible.

**D6 — The map is first in `<main>`.** It used to be the last tab stop on the page — a keyboard
visitor passed ten controls to reach it, recorded in `docs/plans/README.md` as waiting for a
layout change. This was that change. Named grid areas put the reading column back on the left, so
what a visitor sees is unchanged and what a keyboard reaches first is the thing they came for.

**D7 — Every sparkline shares one axis, the whole span the pantry covers.** Normalised to its own
years — which is what they did — all ten came out the same length, so a measure first published
in 1991 read as though it had been collected since 1968. This is "absence is never zero" applied
to the picture rather than the number.

**D8 — Compare puts both series in one frame on one shared y-scale**, solid blue against dashed
orange, and says out loud that no verdict is offered. Two lines on separate scales look
comparable and are not.

**D9 — Each fact carries the family that found it**, not a number. The five facts are not a
sequence — [decision 0003](0003-the-facts-engine.md) deliberately refuses to rank them — so
`01 02 03` would be structure the content does not have.

**D10 — Container queries for anything that appears at more than one width.** A measure row
appears in the page, in the phone sheet and beside a compare column.

**D11 — Colour is decided in `tokens.css` and nowhere else, and both themes are tested.**

## What testing it found, and what only looking found

**The tests caught two real regressions.** The year cursor on a sparkline must follow the
measure's own coverage, not the shared axis, or it points at empty space and implies a value —
an existing test caught that within a minute of D7 landing. And `compare.test.ts` forbids the
vocabulary of ranking anywhere in the strings: the first draft of D8's sentence used "winner" and
"better" to refuse them. The rule was right and the wording was lazy; it was reworded, not
exempted.

**Axe, once it ran in both themes, caught a third:** the compare column header at 4.15:1. The
second series is darker for it, and the token test now demands 4.5 of both series rather than the
3:1 a line would need, because they label text as well as drawing lines.

**Three things only looking found**, none of which any test was asking about:

- The map caption was theme-coloured text on the always-white plate — about 2.2:1 in dark. There
  is now an `--on-plate` token that cannot follow the theme, asserted like `--map-ground`.
- The legend's seven class labels collided into an unreadable row.
- The `<details>` marker sat on its own line above its own heading.

A fourth was caught by a stale preview server serving an old build — the same trap
[decision 0005](0005-a-page-per-municipality.md) records. Screenshots are worth nothing if they
are of the wrong bytes.

## Consequences

|                                      | before         | after                          |
| ------------------------------------ | -------------- | ------------------------------ |
| Lighthouse performance               | 88             | **84**                         |
| accessibility / best practices / SEO | 100 / 100 / 91 | 100 / 100 / 91                 |
| script bytes                         | 123,744        | 125,410                        |
| fonts                                | 0              | 96.5 kB                        |
| unit tests                           | 1,080          | 1,122                          |
| browser tests                        | 196            | 196, now including both themes |

**Performance fell four to five points and that is the fonts.** Measured twice, at 84 and 83. It is comfortably inside the budget of 80,
and the lever if it ever is not is named in the plan: drop IBM Plex Mono.

The accessibility scan now runs every state in **both** themes and covers the 404 page, which it
did not before. `public/pantry/` is untouched — not one figure changed.

## Where this is re-derived

- `src/styles/tokens.test.ts` — both palettes, the two dark blocks never drifting apart, the
  guard, contrast for text, accent, rules and both series, and that nothing is declared only in a
  dark block.
- `tools/fonts.test.ts` — the files, the 120 kB budget, the licences, and that no stylesheet or
  font is fetched from a third party.
- `tools/theme-script.test.ts` — the pre-paint script and the storage key it shares with
  `src/state/theme.ts`.
- `src/state/theme.test.ts` — all three states, and storage that throws.
- `e2e/accessibility.spec.ts` — axe, every state, both themes.
