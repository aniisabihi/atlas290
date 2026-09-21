# ADR-0020: Sparsity is a presentation problem

- **Status:** Accepted | **Date:** 2026-09-21
- **Decided by:** Aniisa Bihi (draft by Claude Opus 5)
- **Affects:** `shared/pantry.ts`, `src/components/`, `src/i18n/`, `kitchen/src/check.ts`,
  `kitchen/src/indicators/**`
- **Related:** [Fifth slice design](../plans/2026-09-21-fifth-slice-design.md),
  [Plan 19](../plans/2026-09-21-19-stage-b-sparse-series.md),
  [0018](0018-stage-a-and-what-the-tables-said.md)

## Context

Stage A shipped the eight indicators that needed nothing new. This is stage B: what the site does
with a measure that has two values across a fifty-nine-year axis, and then the seven measures
that have one. Thirty-five indicators become forty-two.

## Decision

**D1 — `coverage.years` is an optional explicit list, written only when the series is not a dense
run.** Thirty-five of the forty-two carry nothing new and the index grows from 7,975 to 8,473
gzipped bytes. The schema refuses a list that disagrees with `from`/`to` at either end, one that
does not ascend strictly, and one that is merely the dense run written out — two shapes meaning
the same thing would double the work of every reader of this field.

**D2 — One predicate, `coversYear`, in `shared/`.** The range check was written out three times
in the site and each copy would have had to learn about holes separately.

**D3 — The build refuses a declaration that does not match its series, in both directions.** New
rule 7 in `check.ts`. A declared year the series lacks fails; a series year not declared fails;
and — the half that matters — a series WITH gaps that declares nothing fails, because otherwise a
sparse indicator ships looking dense and nothing goes red.

**D4 — Both turnout splits are published, not just the gap.** Exactly
[0016](0016-the-fifteen.md) D6's rule: a gap nobody can check against its two operands is a
number a reader has to take on trust. The REGIONAL election is still left out — a third
near-identical map.

**D5 — Green space is published at 200 metres and the id says so**, `green-space-within-200m`.

**D6 — Councillors ship as the share who are women, not as the gap the design named.** See
Consequences: the gap does not exist.

**D7 — The councillor background total is `samald`, chosen by checking.** The design promised the
choice would be made by reading the data. Six of the seven "samtliga" codes agree — Stockholm's
2023–2026 council is 287 representatives under all of them — and the seventh, `samutb`
(education), is 262, because it can only total the representatives whose education is known.
`samald` is taken: it agrees with the majority and it classifies everybody.
`kitchen/spikes/probe-708.ts` reproduces both halves.

**D8 — Farmland starts in 1981**, as the design's D8 asked. 1951 would stretch the axis from 59
positions to 76 for every indicator on the site to show one more value here.

**D9 — Holiday homes are deferred**, not shipped. See Consequences.

## Motivation (why)

|                               | Before |              After |
| ----------------------------- | -----: | -----------------: |
| Indicators published          |     35 |             **42** |
| Index, gzipped                |  7,975 |          **8,473** |
| Municipality page, Lighthouse |     92 |             **95** |
| Root page, Lighthouse         |     91 |                 91 |
| Unit tests                    |  1,282 |          **1,319** |
| `data/similar.json`           |      — | **byte-identical** |
| Frozen responses added        |      — |           7 chunks |

The performance number is the one worth reading twice. [0019](0019-the-view-is-built-once.md)
landed first precisely because the old `viewOf` was quadratic in the indicator count and these
seven would each have made it worse. Seven more indicators cost **nothing**: 92 → 95, inside the
run-to-run spread. The trend across five slices on the same URL and machine is 86, 82, 65, 92, 95.

## Alternatives considered

- **Widen `IndicatorSeries.years` to hold periods.** Rejected in [0018](0018-stage-a-and-what-the-tables-said.md) D2 and not revisited: pinning a mandate to the year the council is seated costs one caveat.
- **Drop the slider for a two-value measure.** Answered by looking rather than arguing — see Consequences.
- **Publish the councillor gap from a sub-category.** `000000BO` has values for each background group, so a gap could be built for, say, 18–29-year-olds. That is a different and much narrower question than the one the design asked.

## Consequences

- **The design's `councillor-gap` does not exist, and this is the second time in one slice.**
  `TAB708` advertises `000000BO`, "Skillnad mot röstberättigad befolkning", and at the background
  TOTAL it is null for **all 1,450 cells** — 290 municipalities × 5 mandate periods. The gap is
  defined per background group; against the whole population it is zero by construction, so SCB
  publishes nothing. [0018](0018-stage-a-and-what-the-tables-said.md) recorded the identical trap
  for `TAB4422`'s five share codes. A content code existing in the metadata is not the same as
  that code having values, and this project has now been caught by that twice in eight weeks —
  the check belongs in the question list, before a design names a measure.

- **Two of this plan's own caveats were written wrong and the published figures corrected them.**
  The land-use caveat claimed the built share is "far below one percent in the north"; the median
  is 5 percent and only 36 of 870 points fall below 1. The green-space caveat justified choosing
  200 metres because 500 would be "a map of nineties" — at 200 metres the median is already 97
  and only 46 of 580 points fall below 90. The measure is close to saturated at every distance
  SCB offers, and the caveat now says that instead of implying the choice fixed it.

- **The turnout gap is not always positive, and the four exceptions are named in a test.** Öckerö,
  Timrå and Vilhelmina in 1973, and Bjurholm in 2002 — four of 4,288 points, all within a tenth
  of a percentage point of zero. Same shape as
  [0018](0018-stage-a-and-what-the-tables-said.md)'s three windows where women did not outlive
  men: the assertion was written the confident way first.

- **Holiday homes are deferred over a status that would lie.** `TAB4198` publishes nothing for 106
  of 290 municipalities — Solna, Danderyd, Sundbyberg — because SCB counts only holiday homes
  inside a holiday-home AREA, meaning a cluster of at least fifty, and those places have none.
  The pipeline marks the absence `not-yet-published`, whose published prose is "not published for
  this year": true in letter and false in effect, because SCB is never going to publish it. None
  of the six `OBSERVATION_STATUS` values means "this category does not exist here", 37 percent of
  the map would carry the wrong sentence, and adding a seventh status is a contract change that
  deserves its own decision rather than a corner of this one.

- **Two defects that only LOOKING found, both older than this plan.** The year-tick strip has
  never been visible: `.year-ticks` was styled for text labels it does not contain, so 59 empty
  spans collapsed and every tick measured 0×0 — the markup and `data-covered` have been correct
  since plan 3 and only the unit tests ever saw them. And the kicker paired the indicator's name
  with the AXIS's range, so a two-value measure announced itself as "Green space within 200 m ·
  1968–2026"; it was already wrong for every ragged indicator, mean age included.

- **The slider stays for a two-value measure**, which the design left open as risk 2. Decided from
  the screen: the axis is shared, so dropping the control for some measures would move the page's
  furniture whenever the measure changed; the year is URL state and every view must stay
  linkable; and with the strip finally drawn, the two values are visible before anything is
  dragged, which is what makes the emptiness read as a fact about Sweden rather than a broken
  page.

- **Farmland publishes real zeros and they are not nulls summed to nothing.** Stockholm is 38
  hectares in 1981, 0 in 1990, 1995 and 2000, then 462 in 2005 — re-read off the frozen chunk and
  pinned in a test. Four to six municipalities carry a zero in any given survey year, out of 290,
  and the median holds near 7,000 hectares throughout, so this is a method change between surveys
  rather than a missing year. The caveat says so.
