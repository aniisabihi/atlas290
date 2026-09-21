# Plan 20 — Stage C, the reference scale

> [Fifth slice design](2026-09-21-fifth-slice-design.md) §4, stage C, and its D9: "Either the
> reference scale gets built and `share-65-plus` uses it, or the field is dead schema and should
> be removed rather than left as a promise the site does not keep."

## The choice, and why it is not the one D9 framed

D9 called this "a small piece of site work". Reading the code says otherwise, and also says the
dead part is larger than D9 thought.

**`scale.reference` is read nowhere.** Confirmed across `src/`, `kitchen/` and `tools/`. What IS
read is `scale.kind`: it picks the colour scheme (`src/map/colour.ts:51`), it decides whether a
figure shows its sign (`src/i18n/format.ts:32`), and it is what `zeroClassOf` keys off
(`src/map/colour.ts:103`).

**So `reference: 'zero'` is redundant, not merely unused.** Seven indicators declare it; the zero
marking they want is already derived from `kind: 'diverging'`. Removing the field changes nothing
about what any of them renders.

**And `'national-median'` cannot be built without contradicting an existing decision.** The
breaks are **fixed quantiles across all years** — `shared/pantry.ts` says so on the field itself,
and `zeroClassOf`'s docstring says the reference is _marked where it falls_ rather than the ramp
being centred on it. A national median moves every year. Colouring against it would make the same
municipality with the same value change colour as the slider is dragged, which is the exact thing
fixed breaks exist to prevent. It would also need a per-year national figure, which the pantry
does not publish to the map at all.

So the choice D9 offered is really: contradict fixed breaks and publish new data for one
indicator, or delete a field nothing reads. **The field goes.**

## What this does NOT do: Q30 stays unanswered, and that is said out loud

Q30 is "Is this place ageing faster than the country?", and the question list's own formula is
"Share 65+ **minus** the national share, percentage points". That is a **number**, not a colour —
the fourth slice reclassified it as a scale on the strength of `scale.reference` existing, and
that reclassification is what this plan is undoing.

Answering it properly means an indicator, built in the kitchen from the pantry's own data, the
way every other gap on this site is built. That is a different slice's work and is filed rather
than smuggled in here. Deleting the field does not answer Q30; it stops the contract claiming
the site already has.

## Tasks

### Task 1 — The field goes

`shared/pantry.ts` is TDD-only per `workflow-config.md`.

**Acceptance**

- [x] `scale.reference` is gone from the schema, and a test says so by name — the design's own
      verification for this stage.
- [x] The seven `reference: 'zero'` declarations are gone.
- [x] `public/pantry/` loses `"reference":"zero"` in seven indicator files and the index, and
      **nothing else changes** — proven by diffing the publish, not by assuming.
- [x] No `schemaVersion` bump, with the reason written down: removing an OPTIONAL field is
      compatible in both directions — an old file parses against the new schema (zod strips the
      key) and a new file parsed against the old schema simply finds it absent. That is not true
      of plan 17's `contentCode` → `contentCodes`, which is why that one bumped.
- [x] Every diverging indicator still renders exactly as before: same colour scheme, same signed
      figures, same marked zero class.

### Task 2 — The defect this work found

`councillors-women-share` was declared `kind: 'diverging'` in plan 19. Its values run **24 to 58**
and never approach zero, so `zeroClassOf` marks class 0 — a zero twenty-four points outside the
data — and the map draws it on the diverging PuOr ramp instead of the sequential Blues one.

The other six diverging indicators are genuinely signed and straddle zero: net migration
(−72.82), population change (−5.67), natural change (−20.25), the education gap (−7.75), the
life-expectancy gap (−0.5) and the turnout gap (−0.2).

**Acceptance**

- [x] `councillors-women-share` is `sequential`, matching `share-65-plus`, `share-houses` and
      `share-rentals`.
- [x] A test pins the rule rather than the instance: every diverging indicator's published values
      actually straddle zero. A future indicator that declares diverging without meaning it fails.

### Task 3 — The record

- [x] ADR-0022, indexed — and validated by `tools/decisions.test.ts`, which plan 19 added.
- [x] Q30 filed as an unanswered question with what it would take, not left implied.
- [x] `docs/DESIGN.md`'s Indicator bullet corrected, in that file's own correction style.

## Measurements

|                              | Before |       After |
| ---------------------------- | -----: | ----------: |
| Readers of `scale.reference` |      0 |           — |
| Indicators declaring it      |      7 |       **0** |
| `"reference"` keys published |      7 |       **0** |
| Pantry files changed         |      — | 8 of 1,000+ |
| **Published series changed** |      — | **0 of 42** |
| Unit tests                   |  1,323 |   **1,327** |

The eight changed files are the index and seven indicator files. Every one of the forty-two
series is byte-identical: this change moved no number, only a field that described how numbers
were to be coloured and never did.
