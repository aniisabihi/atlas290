# Plan 17 — Stage A, the unblocked six

> [Fifth slice design](2026-09-21-fifth-slice-design.md) §4, stage A. Six indicators that need no
> contract change and no site change: twenty-seven becomes thirty-five.

## Why six and not four

The fourth slice deferred four groups as "not blocked". Verifying the tables moved two more into
that set:

- **Q25 (`near-protected-nature`) was never sparse.** `TAB4422` publishes annually, 2013–2025, for
  all 290. It was filed with land use on the strength of its heading.
- **Q3 (`life-expectancy`) stops being a period problem** once D6 pins each five-year window to its
  last year: twenty-four overlapping windows land on twenty-four consecutive years, 2002–2025.

## The one piece of machinery this needs

`out-commuter-share` is out-commuters over employed residents, and employed residents is
_out-commuters plus those who live and work in the municipality_. Numerator and denominator are
two **content codes** of the same table, not two values of a dimension, so the `share` builder
cannot express it: `selectionFor` resolves exactly one content code per source.

The obstacle that decides the design: the three stitched tables use **different content codes for
the same measure** — `AM0207H9`, `AM0207C8`, `00000548` are all "Utpendlare över kommungräns". A
`share` keyed by code could not span the stitch.

They use **identical labels**. So:

- `Source.content` accepts a list as well as a single label.
- When a source is grouped by `ContentsCode`, `resolveSources` keys by the content **label**, not
  the code.

That is this project's founding convention (decision 0001, trap 2: the code varies by table and by
era, the label is stable) applied to the one place that had not needed it yet. It is the same
shape of addition as plan 16's `Source.subtract`: it arrives with the indicator that needs it.

## Tasks

### Task 1 — A source can name several contents, grouped by label

TDD, against the frozen commuting tables once they exist — so this task runs **after** task 2's
fetch, or against a fabricated table. `kitchen/src/indicators/source.test.ts` first.

**Acceptance**

- [ ] `content: ['A', 'B']` selects both codes; `content: 'A'` behaves exactly as now.
- [ ] Grouped by `ContentsCode`, the map is keyed by label, so two tables using different codes for
      the same label merge into one key.
- [ ] A label absent from the table still throws by name.
- [ ] `public/pantry/` byte-identical — nothing uses it yet.

### Task 2 — The four straightforward ones

`persons-per-household` (`TAB4374` `000000M5`), `cars-per-1000` (`TAB3276`, `Agarkategori 060` —
**direct, because SCB already divides**), `near-protected-nature` (`TAB4422` `000000PL`), and
`in-commuters-per-1000` (`ratio` over population).

`regions: 'known'` on cars, which carries Heby's pre-2007 code `1917` as a 291st region.

**Acceptance**

- [ ] 290 municipalities each, asserted by `check.ts`.
- [ ] Each figure reconciled against a **second, differently shaped read** of the same table.
- [ ] A plausible range declared for each.
- [ ] Second publish byte-identical.

### Task 3 — `out-commuter-share`

Uses task 1. Three tables stitched, share of employed residents commuting out.

**Acceptance**

- [ ] The share is computed within each year from that year's own table, across the stitch.
- [ ] 1993–2021, and the caveat says why it stops.
- [ ] Reconciled by hand from the raw counts.

### Task 4 — `life-expectancy`, with its windows pinned

`TAB4394` `000000NH`. **`Kon` has no total code** — only `1=män`, `2=kvinnor` — and a men's and a
women's life expectancy cannot be summed, any more than a fertility rate could (0016 D3). Nor can
they be averaged honestly without a sex-split population to weight by, which this pantry does not
publish.

So life expectancy ships as **three** indicators, exactly as post-secondary education did in plan
16: `life-expectancy-women`, `life-expectancy-men`, and `life-expectancy-gap` as their difference.
That is the architect's "flat — each split is its own indicator" decision applied a second time,
and the gap — women have outlived men by a margin that has narrowed for decades — is the most
interesting of the three. Stage A therefore publishes **eight**, taking the site to thirty-five.

`Tid` codes are `1998-2002`-shaped, so the source needs a rule that maps a period code to the year
it is published under. That rule is this task's real content.

**Acceptance**

- [ ] The published series has 24 consecutive years, 2002–2025.
- [ ] The caveat states D7 plainly: consecutive values share four years of data, so year-on-year
      change is close to meaningless.
- [ ] A test asserts the pinning, by checking that 2002's value equals what `1998-2002` publishes.

### Task 5 — The record

ADR-0018 for the slice's D1–D9 as far as stage A exercises them; `docs/kitchen.md` for the
multi-content source; the design's stage-A table reconciled with what shipped.

## Measurements

| Gate                         | Target                    | Result |
| ---------------------------- | ------------------------- | ------ |
| Indicators published         | 35                        | —      |
| Municipalities per indicator | 290, asserted             | —      |
| Second publish               | byte-identical            | —      |
| `data/similar.json`          | byte-identical            | —      |
| Frozen bytes added           | measured                  | —      |
| Index gzipped                | measured against 7,545    | —      |
| Lighthouse                   | median of three, ≥ budget | —      |
| Browser tests                | no loss                   | —      |

## Stop conditions

- A figure will not reconcile against a second read → stop and report.
- A reconciliation disagrees anywhere → stop and report, rather than picking a side.
- A table turns out not to carry 290 → drop that indicator, record why.
