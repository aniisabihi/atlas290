# Plan 21 — What absence means, and how a place compares to the country

> Closes the two items the fifth slice deferred: [#40](https://github.com/aniisabihi/atlas290/issues/40)
> (holiday homes, deferred over a status that would lie) and
> [#42](https://github.com/aniisabihi/atlas290/issues/42) (Q30, unanswered).
>
> Both were deferred on a decision rather than on difficulty. This plan takes both decisions.

## Decision 1 — absence gets a seventh status

`TAB4198` publishes nothing for 106 of 290 municipalities, because SCB counts only holiday homes
inside a holiday-home **area** — a cluster of at least fifty — and Solna has none. The pipeline
marks that `not-yet-published`, whose published prose is "not published for this year". True in
letter, false in effect: SCB is never going to publish it, and the sentence would appear on 37%
of the map.

None of the six statuses means "the thing this measures does not exist here". **One is appended:
`nothing-to-count`.** The enum is append-only and its index is a persisted status byte, so
appending relabels nothing — every existing cell keeps the byte it has.

Chosen over the alternatives for a reason that is about honesty rather than convenience:

- **Publishing 0** would assert a figure SCB did not publish. The table never publishes 0
  anywhere, which is evidence that null is how it says "no such area", but evidence is not the
  same as SCB saying so.
- **Shipping with `not-yet-published`** puts a false sentence on a third of the map.
- **Not publishing the indicator** loses a real measure over a labelling problem.

The status is generic, not holiday-home-specific: any measure whose universe excludes some
municipalities by definition needs it, and the fifth slice already met one.

## Decision 2 — Q30 answers the question its formula asks, and says so

The question list's title and its own formula disagree. "Is this place ageing **faster** than the
country?" is a rate-of-change question; "Share 65+ **minus** the national share, percentage
points" answers "is this place **older** than the country". They need different arithmetic and
only one of them was specified.

**The formula wins, and the indicator is named for what it computes**:
`share-65-plus-vs-country`, "Share aged 65+ against the country". The caveat says plainly that it
does not answer the ageing-speed question. Naming it after the title would be the more appealing
claim and the false one.

**The national share is population-weighted**, total over-65s over total residents — not the mean
of 290 municipal shares, which would let Bjurholm weigh as much as Stockholm. Both terms are
already in this pantry: `population` is published, and each municipality's over-65 count is
recoverable exactly from `share-65-plus` before rounding, because that share was computed from
the same population series.

**Hand-written, not a new builder.** [0014](../decisions/0014-indicators-become-definitions.md)
kept `population-change` hand-written because a generic builder for it would have exactly one
user. This is the same case and takes the same answer.

## Tasks

### Task 1 — The seventh status

`shared/pantry.ts` is TDD-only.

**Acceptance**

- [x] `nothing-to-count` is APPENDED; the existing six keep their exact indices, asserted.
- [x] Bilingual prose that is true for any indicator, not just this one.
- [x] Its own absence pattern, told apart from the other four without colour.
- [x] The legend shows it when and only when a year actually contains it.
- [x] `public/pantry/` byte-identical at that commit — nothing emitted the new status yet.

### Task 2 — Holiday homes come back

- [x] `Definition.absentMeans` lets a definition say what a missing source value means, defaulting
      to `not-yet-published` so every existing indicator is untouched.
- [x] `holiday-homes-per-1000` publishes, with `absentMeans: 'nothing-to-count'`.
- [x] Tests pin the counts: 290 rows, and the absent cells carry the new status rather than
      `not-yet-published`.
- [x] The caveat says what the absence means, because a pattern on a map is not a sentence.

### Task 3 — Q30

- [x] `share-65-plus-vs-country`, percentage points, diverging — and it genuinely straddles zero,
      which plan 20's rule now enforces.
- [x] The national share is population-weighted and computed from this pantry's own two series,
      never refetched.
- [x] A test checks the national share against SCB's own published national figures, not against the
      pipeline that produced it.
- [x] The caveat says it answers "older than", not "ageing faster".

### Task 4 — The record

- [x] ADR-0023, indexed.
- [x] Both issues closed by the PR.
- [x] `docs/DESIGN.md`'s observation bullet updated where the status list and the contract are described.

## Measurements

|                             | Before |     After |
| --------------------------- | -----: | --------: |
| Indicators published        |     42 |    **44** |
| `OBSERVATION_STATUS` values |      6 |     **7** |
| Absence patterns            |      4 |     **5** |
| `/en/stockholm-0180/`       |     95 |    **90** |
| `/en/` root                 |     91 |        91 |
| Unit tests                  |  1,327 | **1,338** |

### The national share, three ways

| Year | Population-weighted | Unweighted mean of 290 | Recovered from the published difference |
| ---: | ------------------: | ---------------------: | --------------------------------------: |
| 1968 |              13.388 |                 14.350 |                                  13.390 |
| 2000 |              17.235 |                 18.902 |                                  17.240 |
| 2024 |          **20.841** |             **25.072** |                                  20.840 |
| 2025 |              21.078 |                 25.356 |                                  21.080 |

The middle column is the mistake this indicator was likeliest to make, and the gap is the reason
the tests are built around it. The right-hand column is the published series checked against
itself. The left-hand column is the one that matters: 20.8% of Sweden was 65 or over in 2024,
which is SCB's own figure and the only check here that is not circular.

### Holiday homes

369 cells present, 211 `nothing-to-count`, **zero** `not-yet-published`. A hundred municipalities
have no holiday-home area in either survey; eleven have one in exactly one of the two — six lost
theirs between 2015 and 2020 and five gained one. 100 × 2 + 11 = 211.
