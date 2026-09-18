# Running the kitchen

The kitchen is the offline data pipeline. It is the only code that talks to SCB.

| Command                | Network | What it does                                                                                                                                                       |
| ---------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `yarn kitchen fetch`   | yes     | Downloads the tables the indicators need and freezes each response under `kitchen/raw/<table>/<lang>/`. Already-frozen chunks are skipped, so re-running is cheap. |
| `yarn kitchen publish` | **no**  | Reads only `kitchen/raw/`, builds geometry, adjacency, bubbles, the indicator file and the similarity file into `public/pantry/`. Refuses to touch the network.    |
| `yarn kitchen all`     | yes     | Both, in order.                                                                                                                                                    |

Running `publish` twice produces byte-identical files. If a pull request shows a pantry diff, a
number changed at SCB or the code changed; never both silently. `publish()` also refuses to
write **any** pantry file — including the topology file itself — unless the topology's
municipality codes and the fetched statistics' municipality codes are exactly the same set: the
topology is built into a scratch directory first, the code check runs against that, and only a
passing check lets the topology file land in `public/pantry/`. The map and the numbers are
joined by code, and a silent mismatch there would mean a municipality is drawn with another's
data, or drawn with none. Since Task 13, `publish()` also runs the check stage
(`kitchen/src/check.ts`) against every registered indicator's built output before that same
point — a failing check, like a code mismatch, leaves nothing on disk.

## Every table the kitchen fetches (Task 13, docs/plans/2026-09-14-02-the-ten-indicators.md)

All twelve tables `buildAll()` (`kitchen/src/indicators/registry.ts`) drives through the ten
registered indicators, confirmed against the real indicator modules rather than assumed from
this task's own brief (the brief's list of twelve tables was checked and found correct):

| Table   | Used by                                                                 | Content code(s)                                                                                      | Coverage           |
| ------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------ |
| TAB638  | `population`; `share-65-plus` (65+ numerator)                           | `BE0101N1` Folkmängd                                                                                 | 1968–2024, pre-CKM |
| TAB5557 | `population`; `share-65-plus` (65+ numerator)                           | `000007ME` Folkmängd                                                                                 | 2025, CKM          |
| TAB2017 | `tax-rate`                                                              | `OE0101D1` Skattesats, total kommunal                                                                | 2000–2026          |
| TAB628  | `density`; also fills `Municipality.landAreaKm2`                        | `BE0101U1` Invånare per kvadratkilometer, `BE0101U3` Landareal i kvadratkilometer                    | 1991–2025          |
| TAB1211 | `net-migration-rate`                                                    | `BE0101C5` Flyttningsöverskott                                                                       | 1968–1996          |
| TAB1212 | `net-migration-rate`                                                    | `BE0101AZ` Flyttningsöverskott                                                                       | 1997–2024          |
| TAB6640 | `net-migration-rate`                                                    | `00000868` Flyttningsöverskott                                                                       | 2025, CKM          |
| TAB3554 | `median-income`                                                         | `HE0110J8` Medianinkomst, tkr                                                                        | 1999–2024          |
| TAB4352 | the CPI deflator (`cpi.ts`), used by `median-income` and `house-prices` | `000000KL` Index (1980 = 100)                                                                        | 1980–2025          |
| TAB1169 | `house-prices`                                                          | `BO0501C2` Köpeskilling, medelvärde i tkr; `BO0501C1` Antal (sale count, for the minimum-count rule) | 1981–2025          |
| TAB3981 | `post-secondary-education`                                              | `UF0506A1` Antal                                                                                     | 1985–2025          |
| TAB637  | `mean-age`                                                              | `BE0101G9` Medelålder                                                                                | 1998–2025          |

`population-change` fetches nothing at all — it is computed entirely from `population`'s own
already-built series (`kitchen/src/indicators/derived.ts`), so it has no row in the table above
and an empty `sources` array on its own `Indicator` definition.

Each content code is resolved from the table's own metadata by its stable Swedish label, never
hardcoded (docs/decisions/0001-plan-1-build-decisions.md's trap 2 — the same code can carry a
different literal value in different tables, or different eras of the same table). The
published `manifest.json`'s `indicatorSources` field records, per indicator, exactly which
frozen chunk(s) under `kitchen/raw/` each declared (table, content code) pair actually resolved
to at fetch time, by `selectionKey` — the provenance trail from a number on the map back to a
specific committed SCB response.

`yarn kitchen fetch` (and the `fetch` half of `yarn kitchen all`) drives `buildAll()` directly
against the network (Task 13 also fixed this — before, it called `fetchPopulation()` alone,
fetching only one of these twelve tables even though every indicator through Task 12 had
already been fetched once, by hand, during its own task).

## SCB limits the client enforces

150,000 cells per query (selections are split automatically) and 30 calls per 10 seconds per IP
address.

## SCB table facts learned

Learned 2026-09-13 by `kitchen/spikes/open-questions.ts` against the live SCB PxWeb v2 API
(TAB638 and TAB5557). The brief that specified this spike guessed some of these names; where a
guess was wrong, the real value is given and the guess is named so it isn't repeated.

- **Variable names are identical in both tables**: `Region`, `Civilstand`, `Alder`, `Kon`,
  `ContentsCode`, `Tid` (this order is TAB638/TAB5557's own `id` array order, not alphabetical).
- **TAB638** ("Folkmängden efter region, civilstånd, ålder och kön. År 1968–2024", pre-CKM):
  - `ContentsCode`: `BE0101N1` = Folkmängd, `BE0101N2` = Folkökning.
  - `Alder`: 102 values — single years `'0'`…`'100+'` plus a total code **`'tot'`**, which
    exists in this table (the brief's guess was right here).
  - `Kon`: `'1'`, `'2'` only — no total code.
  - `Civilstand`: `OG`, `G`, `SK`, `ÄNKL` — no total code.
  - Dataset note: "Folkmängd år 1983 och framåt redovisas enligt regional indelning den 1
    januari efterföljande år" — a year-Y population figure uses the administrative division as
    of **1 January of year Y+1**. This is why a municipality created 2003-01-01 (Knivsta) already
    shows real numbers in the **2002** row, one year before its nominal creation year.
- **TAB5557** ("...CKM", 2025–, Cell Key Method noise): variable names are the same, but several
  value codes differ from TAB638 and from the brief's guesses:
  - `ContentsCode`: **`'000007ME'`** = Folkmängd, **`'000007MG'`** = Folkökning. The brief's
    guessed code `'BE0101N1'` does **not exist** in this table and a request using it fails with
    HTTP 400 `"Non-existent value"`.
  - `Alder`: 137 values. There is **no single `'tot'` code** (the brief's guess was wrong here).
    Instead there are single-year ages `'0'`…`'99'` + `'100+1'`, 5-year groups (`'-4'`, `'5-9'`,
    …, `'95-99'`, `'100+5'`), 10-year groups (`'-9'`, `'10-19'`, …, `'90-99'`, `'100+10'`), and
    **four distinct total codes** — `TOT1`, `TOT5`, `TOT10`, `TotSA` — all labelled "totalt,
    samtliga åldrar" (they were observed to always carry the same value; see the CKM finding
    below for why they are nonetheless separate codes).
  - `Kon`: `'1'`, `'2'`, plus a total code **`'TotSa'`** ("totalt, samtliga män och kvinnor").
  - `Civilstand`: `OG`, `G`, `SK`, `ÄNKL`, plus a total code **`'SC'`** ("totalt, samtliga
    civilstånd").
- **CKM noise is per-cell, not per-parent-sum**: for Stockholm (0180), 2025, `Kon='TotSa'`,
  `Civilstand='SC'`, `ContentsCode='000007ME'`, the published total (`TOT1`/`TOT5`/`TOT10`/
  `TotSA`, all equal) is 999,239, while summing the 101 single-year age cells gives 999,237,
  summing the 21 five-year-group cells gives 999,228, and summing the 11 ten-year-group cells
  gives 999,234 — three different sums, none equal to the published total, and each a different
  amount off. The same holds one level down: single ages 20+21+22+23+24 sum to 54,253 against a
  published `'20-24'` cell of 54,255. **Any age-grouped indicator must be requested from SCB at
  the resolution it needs (e.g. the `'20-24'` code, or `TOT5`) rather than computed by summing
  finer single-year cells**, because the sum will not match SCB's own published figure for that
  group.
- Frozen raw responses backing these findings live at `kitchen/raw/TAB638/sv/` and
  `kitchen/raw/TAB5557/sv/` (metadata + the two data chunks fetched by the spike).

## Can median age and share-65+ be built? (Task 2 spike, 2026-09-14)

Plan 2 planned two indicators — median age and share aged 65 and over — that need population
broken down by age. Plan 1 deliberately fetched only the age **total** (290 cells/year). The
brief guessed the full cross-tab (290 municipalities × 102 ages × 2 sexes × 4 marital states × 57
years ≈ 13.5M cells) would cost 150–250 MB frozen, "probably not viable." `kitchen/spikes/
age-distribution-cost.ts` replaces that guess with real measurements against the live SCB v2 API.
Everything it fetched is frozen under `kitchen/raw/TAB638/sv/` and `kitchen/raw/TAB5557/sv/`
(raw dir grew from 2.4 MB to 5.8 MB total — not per option; see the table below for per-option
numbers).

### 1. Codelists actually offered

Read from the **raw** frozen metadata JSON (`dimension.<code>.extension.codelists`) — the
project's `parseMetadata` (client.ts) does not surface this and was **not changed**.

- **TAB638.Alder** exposes two **Aggregation** codelists — `agg_Ålder5år`, `agg_Ålder10årJ` —
  confirming Plan 1's research. These would let the SCB _server_ sum single years into 5-/10-year
  groups. It also exposes two Valuesets: `vs_Ålder1årA` (single years) and `vs_ÅlderTotA` (the
  age total, already used by Plan 1).
- **TAB5557.Alder** exposes **no Aggregation codelists at all** — only four Valuesets
  (`vs_CKM01AlderTot`, `vs_CKMÅlder10årTOT`, `vs_CKMÅlder5årTOT`, `vs_CKMÅlder1årTOT`). It doesn't
  need an aggregation mechanism because its plain value list already **contains** literal 5-year
  and 10-year group codes (`'5-9'`, `'10-19'`, …) as ordinary selectable values, alongside four
  distinct age-total codes (`TOT1`/`TOT5`/`TOT10`/`TotSA`) — see the CKM finding above for why
  summing is not a substitute for selecting these directly.
- **Neither table exposes any codelist for `Kon` or `Civilstand`.** There is no server-side "total
  across sex" or "total across marital status" aggregation on either table. TAB638 also has **no
  literal total value** for `Kon` (`'1'`,`'2'` only) or `Civilstand` (`OG`,`G`,`SK`,`ÄNKL` only) —
  every TAB638 age query needs the full 2×4 cross-tab no matter the age granularity. TAB5557
  (2025–) is different: `Kon='TotSa'` and `Civilstand='SC'` are ordinary values in its plain value
  list (not a codelist), so a total-across-sex-and-marital-status query **is** expressible there
  through the existing `Selection` type.
- **Important gap found, not fixed here:** using an Aggregation codelist requires a `codelist`
  field per variable in the v2 POST body (confirmed against the PxWeb v2 user guide:
  `{"variableCode":"Alder","codelist":"agg_Ålder5år","valueCodes":[...]}`). This project's
  `Selection` type in `kitchen/src/scb/client.ts` is `Record<string, string[]>` and
  `toRequestBody()` emits only `{variableCode, valueCodes}` — **there is no way to request
  `agg_Ålder5år`/`agg_Ålder10årJ` through `freezeData` today.** This spike deliberately did not
  extend `client.ts` (out of its scope, and it would be a shared-code change made unilaterally).
  So TAB638's only two candidate server-side aggregations are confirmed to **exist** but are
  **untested and unreachable** from this codebase as it stands.

### 2. Measured one-year costs (all 290 municipalities, real frozen bytes)

| Option                                                             | Table   | Year | Cells   | Measured frozen bytes |
| ------------------------------------------------------------------ | ------- | ---- | ------- | --------------------- |
| Single ages, full 2×4 sex/marital cross-tab (TAB638's only option) | TAB638  | 2024 | 234,320 | **2,290,916 B**       |
| Ages 65+ only, full 2×4 cross-tab (share-65+ numerator)            | TAB638  | 2024 | 83,520  | **828,022 B**         |
| Single ages, sex+marital collapsed to totals (`TotSa`/`SC`)        | TAB5557 | 2025 | 29,290  | **346,164 B**         |
| 5-year groups, sex+marital collapsed to totals                     | TAB5557 | 2025 | 6,090   | **96,318 B**          |
| 10-year groups, sex+marital collapsed to totals                    | TAB5557 | 2025 | 3,190   | **63,675 B**          |

Projections (real measurement × real year count, never the reverse):

- **Full single-age cross-tab, TAB638 alone, 57 years (1968–2024):** 2,290,916 B × 57 =
  **130,582,212 B ≈ 130.6 MB.** This is the honest cost of what the brief called "single years" —
  well under the 150–250 MB guess, but still a lot for one intermediate indicator input.
- **Ages-65+-only cross-tab, TAB638 alone, 57 years:** 828,022 B × 57 = **47,197,254 B ≈ 47.2
  MB.** Share-65+ does **not** need the full age distribution — only a partition at 65 — so its
  numerator alone (summed server-side into one query per year, still exact because TAB638 predates
  CKM) is ~2.8× cheaper than the full single-age cross-tab. The denominator is the age total Plan 1
  already fetches, at effectively zero incremental cost.
- **5-year/10-year group options have no TAB638 equivalent that was actually measured.** They only
  exist as literal values on TAB5557 (2025 onward). Projecting them backward across 1968–2024 would
  require the untested `agg_Ålder5år`/`agg_Ålder10årJ` codelist mechanism (§1) — which cannot be
  measured without extending `client.ts`. **No number is reported for that projection**; a rough
  arithmetic guess (single-age bytes ÷ ~4.8, matching the cell-count ratio) is deliberately omitted
  from the table above so it cannot be mistaken for a measurement.

Total new frozen data committed by this spike: kitchen/raw/ grew from 2.4 MB to 5.8 MB (six data
chunks + reusing the two already-frozen metadata files) — a one-time, modest, and fully justified
cost for the certainty these numbers provide.

### 3. Is a grouped median honest?

Not reached as the primary path — see §4: SCB does not publish median age per municipality at all,
so this project cannot compute a true single-year median from municipal data without first solving
the TAB638 aggregation-codelist gap in §1. If that gap were solved and only 5-year groups were
available, the interpolated "median" would be located to within a 5-year (or 10-year) band and
then linearly interpolated inside it — a legitimate approximation for a summary statistic, but
one instant of precision loss that should be disclosed, not silently presented "to one decimal
place" as if it were exact. This project does not need to resolve that tradeoff: §4 gives a better
answer.

### 4. Does SCB publish mean or median age per municipality directly?

Searched the v2 table index (`/tables?query=...`, a metadata search — not data, not frozen):

- `query=medelålder region` → **TAB637** "Befolkningens medelålder efter region och kön. År
  1998–2025" and **TAB4659** "Befolkningens medelålder och medianålder efter region och kön. År
  2000–2025", plus an unrelated table about mean age at childbirth.
- `query=medianålder kommun` and `query=genomsnittsålder kommun` → 0 hits each.

Checked both candidates' metadata directly:

- **TAB637** covers **all 290 municipalities** (`Region`: 312 values, 290 four-digit kommun codes),
  1998–2025, one content code (`BE0101G9` = Medelålder), and a `Kon` total value (`'1+2'` =
  totalt). **Mean age per municipality is a direct, already-computed fetch — 290 cells/year, the
  same order of magnitude as the age total Plan 1 already fetches — no age distribution needed at
  all.**
- **TAB4659** does carry a Medianålder content code (`0000070F`), but its `Region` dimension has
  only **22 values (riket + 21 län)** — zero four-digit kommun codes. **SCB does not publish median
  age per municipality directly**; only mean age, and only at municipality level. Median age is
  published, but only at county level and above.

### Recommendation

- **"Share aged 65 and over"**: build it. Fetch TAB638's ages-65+ range (measured: 828,022 B/yr,
  projecting to ~47.2 MB across 1968–2024) plus the age total Plan 1 already has; sum server-side
  results are exact for TAB638 (pre-CKM). For 2025 onward, use TAB5557 with `Kon='TotSa'`,
  `Civilstand='SC'`, and either the literal `'65-69'`…`'100+5'` 5-year-group codes summed, or (if
  precision at the boundary matters) TAB5557's single-year codes ages 65–99 + `'100+1'` with
  totals collapsed (measured: 346,164 B/yr full single-year, well under budget for one year at a
  time going forward). Either way this indicator is affordable and does not require solving the
  TAB638 codelist gap.
- **"Median age"**: **redefine it as mean age, or drop it as originally specified.** SCB publishes
  mean age per municipality directly (TAB637, 1998–2025, ~290 cells/year — no age-distribution
  fetch, no interpolation, no precision caveat). A true municipal _median_ age is not published by
  SCB at any resolution, and this project cannot derive one honestly without (a) TAB638's
  1968–1997 span, which TAB637 does not cover either, and (b) solving the untested/unreachable
  `agg_Ålder5år` codelist gap in `client.ts` just to get an interpolated, band-limited
  approximation for 1968–2024. Recommend Task 11 build **mean age** (TAB637, direct fetch, full
  290-municipality coverage, 1998–2025) under the "median age" indicator's _original intent_
  (typical resident age) and rename the indicator accordingly, rather than either (a) shipping a
  literal, disclosed-imprecise interpolated median for 1968–2024 built on an unreachable codelist,
  or (b) dropping the indicator outright. This is the best outcome the brief asked to look for,
  and it exists.

Frozen raw responses backing this section live at `kitchen/raw/TAB638/sv/` and
`kitchen/raw/TAB5557/sv/` (the metadata already frozen by the earlier spike, plus six new data
chunks). The script is `kitchen/spikes/age-distribution-cost.ts`.

## Net migration: three tables, one real gap, and a fixed brief (Task 6, 2026-09-14)

Checked live against SCB metadata before writing `kitchen/src/indicators/migration.ts`, because
`docs/DESIGN.md` and the Plan 2 brief's own verified-facts table disagreed on coverage
("1997 onwards" vs "1968–2025"). The brief's table was right; `docs/DESIGN.md` has been corrected.

- **TAB1211** — "Migration by region, age and sex. Year 1968-1996", content code `BE0101C5` =
  Flyttningsöverskott. **TAB1212** — "...1997-2024", `BE0101AZ`. **TAB6640** — "...2025",
  `00000868`, and its own note confirms the same CKM disclosure-control language TAB5557 (2025
  population) carries: "Från och med referensåret 2025... en liten kontrollerad slumpmässig
  osäkerhet". All three agree on the Swedish label `Flyttningsöverskott`, per the plan's trap 2.
- **Trap 1 (the plan's own) also applies to TAB6640, which the plan did not separately check**:
  both TAB1212 and TAB6640 carry `0010` Stor-Stockholm, `0020` Stor-Göteborg, `0030` Stor-Malmö as
  extra four-digit "region" codes alongside the 290 real municipalities. A blind `/^\d{4}$/` filter
  would include all three; `migrationSelection` instead joins the table's own Region list against
  the known municipality codes.
- **A new gap, not in the plan's trap list: TAB1211 still uses the municipality codes of its own
  era** and was never retroactively republished under current ones the way TAB638 (population)
  was. Diffed against the known 290: **52** of today's codes are absent from TAB1211's Region
  list. Two of them, Nykvarn (created 1998) and Knivsta (2002), did not exist during 1968–1996 at
  all, so their absence is correct rather than a gap. The other **50** existed throughout the
  period but cannot be reached under today's code: 47 were renumbered by the 1998 county mergers
  (13 in Skåne, 34 in Västra Götaland), and three changed county separately — Mullsjö `1622` and
  Habo `1623` in 1998, Heby `1917` in 2007. The old codes were read off TAB1211's own labels
  rather than recalled: Borås appears as `1583`, Bollebygd as `1535`, matching the renumbering
  `kitchen/src/municipalities.ts` already documents. `migrationSelection`'s known-code join means
  those 50 read `not-yet-published` for that span rather than the build fetching a nonexistent
  code or fabricating a value. Flagged in `MIGRATION`'s bilingual caveat.

  The first version of this note said 49 and attributed all of them to the Skåne and Västra
  Götaland mergers. Both were wrong, found by recounting from the frozen metadata: the number is
  50, and three of the fifty have nothing to do with those two mergers.

- **A second new gap: migration's "existed" boundary runs one calendar year LATER than
  population's own `CREATED` map**, because net migration is a flow measured during calendar year
  Y using the boundary that actually applied that year, while population's `CREATED` encodes
  TAB638's convention that a year-Y population row already reflects 1 January year Y+1's division.
  Verified live for five of the six splits (the sixth, Bollebygd, is moot — its pre-1998 data lives
  under the old code excluded by the gap above): Gnesta and Trosa (`CREATED` 1991) read real
  migration only from 1992; Lekeberg (1994) only from 1995; Nykvarn (1998) only from 1999; Knivsta
  (2002) only from 2003 — every one exactly `CREATED[code] + 1`. `migration.ts`'s
  `migrationExisted(code, y)` is `existed(code, y - 1)`, the same gate shifted one year later, so a
  literal `0` SCB sends for the still-too-early year is discarded as `did-not-exist` rather than
  published as a real zero.
- **TAB1211's and TAB1212's `Kon` has no total code** (only `'1'`/`'2'`) — added to `SUM_SAFE` in
  `registry.ts`, safe because pre-2025 sex-split migration counts are disjoint and unperturbed.
  TAB6640 carries its own `'TotSa'` total instead and never falls through to the sum.

Real spot-check (frozen 2026-09-14): see the migration.ts commit message for the actual growing-
and shrinking-municipality figures.

## Median income: population basis, and two findings that revise the plan's own traps (Task 7, 2026-09-14)

Checked live against TAB3554's real frozen metadata before writing `kitchen/src/indicators/income.ts`.

- **TAB3554** ("Total earned income for persons registered in the national population register
  during the whole year by region, sex, age and income bracket. Year 1999-2024"), content code
  `HE0110J8` = "Medianinkomst, tkr" (resolved by label, never hardcoded). `Alder` carries the age
  total `'tot16+'`, `Kon` carries `'1+2'`, `Inkomstklass` carries `'TOT'` — all three added to
  `registry.ts`'s `TOTAL_CODES` (`Inkomstklass` is a new key there).
- **Population basis, decided by the architect rather than by this task**: TAB3554 covers people
  registered in Sweden's population **the whole year**. TAB3558 publishes the identical measure
  (same shape, content code `HE0110K2`, confirmed against its own frozen metadata) for people
  registered **on 31 December**, reaching back to **1991** — eight years further. The two
  populations differ (a 31-December figure includes people who moved in or out partway through
  the year) and must never be mixed. TAB3554 was chosen because part-year residents make small
  and student-heavy municipalities noisy, and comparability between places matters more here than
  the extra history. Switching is a one-line change (`income.ts`'s module comment gives the exact
  line), which is deliberately not taken here.
- **Trap 5 from the plan's own brief, checked and found NOT to apply to TAB3554**: TAB1212 and
  TAB6640 carry phantom four-digit "region" codes (`0010`/`0020`/`0030`, Stor-Stockholm/Göteborg/
  Malmö) that a blind `/^\d{4}$/` filter would wrongly admit. TAB3554's own Region list was
  checked the same way: of 312 entries, exactly **290** are four-digit, and all 290 are real,
  current municipality codes — no phantom four-digit entries at all. `incomeSelection` still joins
  against the known municipality list rather than a bare regex, both as the project's default
  convention and as a safety margin should SCB add such a code to this table later.
- **A finding the plan's own trap 4 did not anticipate: TAB3554 returns literal `null` for a
  municipality-year before it existed, not literal `0`.** Population's TAB638 sends `0` for
  Knivsta before 2002 (documented in `docs/decisions/0001-plan-1-build-decisions.md`), which is
  why "existence must be decided by the registry, never by the value" is stated as a general rule.
  Checked directly against TAB3554's real frozen response: Knivsta (`0330`) reads `null` for 1999,
  2000 and 2001, and a real value (206.1 tkr) from 2002. The rule is followed exactly the same way
  regardless (`existed()` gates before the value is even inspected, per `buildIncomeSeries`), so
  no code depends on this difference — but the difference itself is worth recording, because the
  plan stated the literal-zero behaviour as if it generalised, and here it does not.
- **Income uses the same existence gate as population, tax rate and density
  (`existed(m.code, y)`), not migration's one-year-later shift.** Net migration is a flow measured
  during calendar year Y and needed its own gate; median income, like population, is a snapshot
  measure taken under the administrative division already in force for that year's row. Verified
  against the real data: Knivsta reads `did-not-exist` for 1999–2001 and `present` from 2002
  onward, matching population's own `CREATED['0330'] = 2002` with no adjustment.
- **Unit conversion**: SCB publishes this content code in thousands of kronor (tkr).
  `income.ts` multiplies by 1,000 before storing, so the pantry's `sek`-unit values are true
  kronor, not thousands of kronor labelled as kronor.
- **Real spot-check** (all 290 municipalities, 1999–2024, frozen 2026-09-14): Danderyd (`0162`) is
  the highest-median municipality in the real 2024 data (455.6 tkr nominal) and reads 209.6 tkr
  nominal for 1999. Högsby (`0821`) is the real **lowest**-median municipality in 2024 (269.5 tkr
  nominal — found by scanning every municipality's real 2024 figure, not assumed) and reads 140.6
  tkr nominal for 1999. Adjusted to 2025 kronor (the latest year the real, frozen CPI series
  covers) via `cpi.ts`'s `toCurrentKronor`: Danderyd's 1999 figure becomes 339,436.68 kronor
  (up from a nominal 209,600 kronor) and Högsby's becomes 227,694.65 kronor (up from a nominal
  140,600 kronor) — both roughly 62% higher than nominal, matching the real CPI ratio
  417.98 / 258.1.

## House prices: the minimum-count rule, and a flow-not-snapshot finding the brief didn't call out (Task 8, 2026-09-14)

Checked live against TAB1169's real frozen metadata and real frozen data before writing
`kitchen/src/indicators/housing.ts`.

- **TAB1169** ("Försålda småhus efter region (kommun, län, riket) och fastighetstyp. År
  1981-2025"). `Region`: 312 values, exactly **290** four-digit codes, all of them real current
  municipality codes — diffed directly against TAB638's own 290, no phantom four-digit codes
  like TAB1212/TAB6640's Stor-Stockholm/Göteborg/Malmö (the plan's trap 5, checked and found not
  to apply here, the same way it did not apply to TAB3554 in Task 7). `Fastighetstyp` has
  exactly two values: `220` labelled **"permanentbostad (ej tomträtt)"** and `221` labelled
  **"fritidshus"** — the brief's assignment (220 = permanent, 221 = holiday) was correct,
  confirmed against the table's own metadata labels rather than trusted blind, and
  `housing.ts` resolves `220` by that label at run time rather than hardcoding it.
  `ContentsCode` carries four codes; this indicator uses two, resolved by label:
  `BO0501C1` = "Antal" (sale count) and `BO0501C2` = "Köpeskilling, medelvärde i tkr" (mean
  price). TAB1169 carries no CKM/perturbation note — no cell is ever `perturbed`.
- **TAB1169 sends literal `null` for a municipality-year before the municipality existed, not
  literal `0`** — like TAB3554 (Task 7), unlike TAB638. Confirmed directly: Knivsta (`0330`)
  reads `null` for every year 1981–2002 inclusive, and a real count from 2003.
- **A finding this task's own brief did not call out: house sales are a FLOW, not a snapshot,
  and need the same one-calendar-year-later existence shift `migration.ts` uses, not the plain
  `existed(code, y)` every snapshot indicator (population, tax, density, income) uses.** Checked
  directly against the real frozen data for all six municipality splits — in every case the
  first real (non-null) sale count is exactly `CREATED[code] + 1`, one year later than
  population's own gate:

  | Municipality     | `CREATED` (population's gate) | First real TAB1169 year |
  | ---------------- | ----------------------------- | ----------------------- |
  | Gnesta (0461)    | 1991                          | 1992                    |
  | Trosa (0488)     | 1991                          | 1992                    |
  | Bollebygd (1443) | 1994                          | 1995                    |
  | Lekeberg (1814)  | 1994                          | 1995                    |
  | Nykvarn (0140)   | 1998                          | 1999                    |
  | Knivsta (0330)   | 2002                          | 2003                    |

  This is the same shift, for the same reason, that `migration.ts` documents for net migration:
  a year-Y population row already reflects the administrative boundary of 1 January year Y+1
  (TAB638's own convention), but a year-Y count of sales reflects the boundary that actually
  applied during year Y itself. `housing.ts`'s `housingExisted(code, y)` is `existed(code, y -
1)`, exactly mirroring `migration.ts`'s `migrationExisted`. Getting this wrong would have
  published Knivsta's real 2003 figures one year early, under `did-not-exist`'s complement, as
  though the municipality's housing market existed in 2002 — an error the spot-check below would
  not have caught on its own, since 2002 is null either way in the raw data; it was caught by
  checking every split against `CREATED`, not just one.

- **A handful of nulls unrelated to any split**: `Österåker` (0117), `Salem` (0128), `Essunga`
  (1445), `Bjurholm` (2403) and `Malå` (2418) each read `null` for exactly 1981 and 1982 — the
  table's own two earliest years — despite existing throughout. Not a `CREATED`-map municipality
  and not a boundary change; read as an ordinary `not-yet-published` gap (the fetched cell is
  simply missing), which is what the existing rule already produces without special-casing it.

### The minimum-count rule

Fetched the real sale count (`BO0501C1`, Fastighetstyp 220) for all 290 municipalities,
1981–2025: 12,950 published municipality-year cells (the other 100 of 13,050 are the six splits'
and the 1981–1982 gap's `null`s above). Distribution (tkr price omitted; this is the **count**):

```
min 2, p1 16, p5 32, p10 45, p25 74, median 125, p75 232, p90 389, p95 526, max 1,610
```

Candidate thresholds, counted from the real data rather than estimated:

| Threshold | Muni-years suppressed | % of 12,950 | Municipalities with ≥1 suppressed year |
| --------- | --------------------- | ----------- | -------------------------------------- |
| 10        | 28                    | 0.22%       | 7 of 290                               |
| 15        | 99                    | 0.76%       | 12 of 290                              |
| **20**    | **227**               | **1.75%**   | **22 of 290**                          |
| 25        | 384                   | 2.97%       | 34 of 290                              |
| 30        | 555                   | 4.29%       | 47 of 290                              |
| 50        | 1,608                 | 12.42%      | 95 of 290 (roughly a third of the map) |

10 suppresses almost nothing (0.22%) — not doing its job. 50 suppresses 12.42% of all cells and
95 of 290 municipalities, close to a third of the map — the "too high" failure mode the task
brief warned against. **20 was chosen**: a real, non-trivial share (1.75% of cells, 22 of 290
municipalities), and the municipalities it flags form a recognisable pattern rather than either
extreme — mostly the sparsely populated inland municipalities of Västerbotten and Norrbotten
(Dorotea, Bjurholm, Sorsele, Malå, Överkalix, Arjeplog, Åsele, Övertorneå, Pajala, Norsjö) plus
one urban outlier, **Solna**, whose housing stock is dominated by flats rather than the
"småhus" (single-family homes) this table counts — Solna is suppressed at every threshold from
10 upward, including years with a genuine mean price already published on as few as 2 sales
(1990: 2 sales, mean 2,188 tkr).

Real spot-check (frozen 2026-09-14, all 290 municipalities, 1981–2025): for 1990, Danderyd
(`0162`) reads 151 sales at a mean of 2,615 tkr (among the highest); Åsele (`2463`) reads 41
sales at a mean of 252 tkr (among the lowest). Adjusted to 2025 kronor via `cpi.ts`'s
`toCurrentKronor` (CPI 1990 = 207.8, 2025 = 417.98): Danderyd's 1990 figure becomes
5,259,950.43 kronor (up from a nominal 2,615,000 kronor) and Åsele's becomes 506,886.24 kronor
(up from a nominal 252,000 kronor). Solna (`0184`), 1990: 2 sales — below the minCount of 20 —
so despite SCB publishing a mean price (2,188 tkr) for that cell, it is nulled and marked
`too-few-cases` rather than shown.

## Share with post-secondary education: a derived share, a required summation, and a table-note finding the brief didn't mention (Task 9, 2026-09-14)

Checked live against TAB3981's real frozen metadata and real frozen data before writing
`kitchen/src/indicators/education.ts`.

- **TAB3981** ("Befolkning 16–74 år efter region, utbildningsnivå, ålder och kön. År
  1985-2025"), content code `UF0506A1` = "Antal" (the only ContentsCode this table carries).
  `Region`: 312 values, exactly **290** four-digit codes, diffed directly against TAB638's own
  290 — an exact match, no phantom four-digit codes like TAB1212/TAB6640's Stor-Stockholm/
  Göteborg/Malmö. The age dimension is named **`UtbildningsNiva`** (education level), not
  "Nivå", and carries `Alder`'s `tot16-74` total (added to `registry.ts`'s `TOTAL_CODES`,
  distinct from `tot16+`, income's age total on a different table — neither subsumes the
  other). `UtbildningsNiva` has exactly eight values, confirmed against the table's own live
  labels rather than trusted from the task brief (all eight agreed with the brief):

  | Code | Label (Swedish, verbatim from metadata)   | Meaning                            |
  | ---- | ----------------------------------------- | ---------------------------------- |
  | 1    | förgymnasial utbildning kortare än 9 år   | Pre-upper-secondary, under 9 years |
  | 2    | förgymnasial utbildning, 9 (10) år        | Pre-upper-secondary, 9 or 10 years |
  | 3    | gymnasial utbildning, högst 2 år          | Upper-secondary, up to 2 years     |
  | 4    | gymnasial utbildning, 3 år                | Upper-secondary, 3 years           |
  | 5    | eftergymnasial utbildning, mindre än 3 år | Post-secondary, under 3 years      |
  | 6    | eftergymnasial utbildning, 3 år eller mer | Post-secondary, 3 years or more    |
  | 7    | forskarutbildning                         | Postgraduate research              |
  | US   | uppgift om utbildningsnivå saknas         | Unknown                            |

  `education.ts`'s `validateLevels` checks this exact code/label mapping at selection time
  (not just once here), so a future SCB relabelling throws instead of silently redefining what
  "post-secondary" means.

- **`Kon` has exactly two values, `1` and `2`, no total code** — verified live. Summing the two
  sexes is therefore required, not optional, and `registry.ts`'s `totalOrDeclaredSum` refuses
  the fetch until it is declared: `TAB3981: ['Kon']` was added to `SUM_SAFE`, safe for the same
  reason TAB638/TAB1211/TAB1212's sex-sums are safe — TAB3981 carries no CKM/perturbation note
  (confirmed: its metadata's own `note` array covers two unrelated time-series breaks, 1990 and
  2000, discussed below — never disclosure-control noise), so the two sexes' counts are exact,
  disjoint and unperturbed. **Verified the guard actually guards**: with the `SUM_SAFE` entry
  removed, five `educationSelection` tests fail with `totalOrDeclaredSum`'s own refusal message
  naming `Kon`; restoring the entry turns them green again. A second mutation test (silently
  excluding `US` from the denominator inside `buildEducationSeries`) was also run and correctly
  turned the "unknown level is non-trivial" test red before being reverted — proving that test
  really exercises the denominator decision rather than passing regardless of it.

- **The definition, stated explicitly**: the numerator is levels 5, 6 and 7 (eftergymnasial
  under 3 years, eftergymnasial 3 years or more, forskarutbildning). The denominator is **all
  eight levels, including `US`** — the share is of the whole 16-74 population, not only those
  with a recorded education. Both choices are in `EDUCATION`'s bilingual `description` and
  `caveat`, because a reader comparing this to SCB's own published share needs to know which
  convention is used here; SCB itself sometimes reports the share with `US` excluded from the
  denominator instead.

- **A finding this task's brief did not mention: TAB3981 carries no CKM/perturbation note, but
  it DOES carry two genuine time-series-break notes.** SCB's metadata states register quality
  rose substantially from 1990 (so 1985-1989 should be avoided or read with real caution) and
  the classification system changed in 2000 (SUN → the ISCED-aligned SUN2000), which raised the
  reported national education level and makes pre-2000 comparisons less reliable. Neither is a
  disclosure-control perturbation — no cell is ever marked `perturbed` — but both are real data-
  quality caveats, recorded in `EDUCATION`'s bilingual `caveat` since they were not otherwise
  documented anywhere in this task's own brief.

- **Education is confirmed to be a SNAPSHOT, using the plain `existed(m.code, y)` gate — not a
  flow needing migration/housing's `existed(code, y - 1)` shift.** Checked directly against the
  real frozen data for all six municipality splits (representative cell: level `1`, sex `1`):

  | Municipality     | `CREATED` | Year before (0) | `CREATED` year (real count) |
  | ---------------- | --------- | --------------- | --------------------------- |
  | Gnesta (0461)    | 1991      | 0               | 713                         |
  | Trosa (0488)     | 1991      | 0               | 620                         |
  | Bollebygd (1443) | 1994      | 0               | 712                         |
  | Lekeberg (1814)  | 1994      | 0               | 670                         |
  | Nykvarn (0140)   | 1998      | 0               | 368                         |
  | Knivsta (0330)   | 2002      | 0               | 435                         |

  Every one of the six reads its first real (non-zero) count in exactly `CREATED[code]` itself,
  not `CREATED[code] + 1` — unlike net migration and house prices, which are flows and need the
  one-year-later shift. This also answers trap 5 directly: **TAB3981 sends literal `0`**, not
  `null`, for a municipality-year before it existed — matching TAB638 (population), not
  TAB3554/TAB1169 (income/housing).

- **Real spot-check** (all 290 municipalities, 1985–2025, frozen 2026-09-14): for 2024, Danderyd
  (`0162`) has the highest post-secondary share of all 290 municipalities at **65.28%**; Lund
  (`1281`) is also high at **64.90%**; Filipstad (`1782`), a rural municipality, is the real
  **lowest** of all 290 at **19.29%** (found by scanning every municipality's real 2024 figure,
  not assumed).

- **National figure versus SCB's own published share**: summing the raw counts across all 290
  municipalities for 2024 reproduces SCB's own `Region='00'` (Riket) row in the same table
  **exactly** — 185,649 / 954,024 / 1,254,093 / 1,811,141 / 1,171,076 / 1,850,629 / 91,878 /
  213,028 for levels 1 through 7 and US respectively, fetched independently and compared
  cell-for-cell — proving no double-count and no missing municipality. Under this indicator's
  own convention (US included in the denominator), the national share is **41.34%**; excluding
  US from the denominator (a convention SCB itself sometimes uses) gives **42.54%** instead —
  over a full percentage point apart, which is exactly why the convention is stated explicitly
  rather than left implicit. The two figures agree with each other (same source data, same
  numerator) and disagree with each other by exactly the denominator convention, not by any
  data error.

- **What in this task's brief turned out to be wrong**: nothing in the verified-facts table,
  the eight level codes/labels, the `Kon`/`Alder` dimension facts, or the phantom-region-code
  check. The one thing the brief did not mention (not "wrong", but missing) is the two
  time-series-break notes (1990, 2000) TAB3981's own metadata carries — added to the caveat
  here since they materially affect how early years in this series should be read.

## Publish all ten: real size, real determinism (Task 13, 2026-09-14)

`publish()` now drives `buildAll()` (every REGISTRY entry) instead of `fetchPopulation()` alone,
runs the check stage (`kitchen/src/check.ts`) before anything lands in `public/pantry/`, and
extends `manifest.json` with `indicatorSources` (see the table above). Population's own values
were confirmed byte-for-byte unchanged by diffing the previously-committed
`public/pantry/data/indicators.json` against the freshly published one: the `population`
indicator object and its `series` entry (`values`, `status`, `years`) are deep-equal, and
`municipalities` is unchanged apart from gaining `landAreaKm2` (density's own addition, expected
since Plan 2 Task 5) — never re-derived here.

- **Real size, measured, not estimated**: `public/pantry/data/indicators.json` is **4,962,191
  bytes (≈ 4.7 MiB / 5.0 MB)** for all ten indicators, 290 municipalities, up to 58 years. This
  is well past "approaching a megabyte" — it is about five times one — so Plan 3 does need to
  decide whether to split the pantry per indicator for lazy loading; loading the whole file to
  render one indicator's map is real, avoidable weight once there are ten instead of one.
  `manifest.json` is 34,363 bytes.
- **Determinism, reproven with ten indicators**: `public/pantry/` deleted entirely, published
  twice from the same frozen `kitchen/raw/`. Every file's sha256 was identical across both
  runs, including `data/indicators.json`
  (`22555fa160823ddbcb1780fa4d46b3a3f8f576cbc9417f63b4ac204bcd6e4d10`) and `manifest.json`
  (`41feedcf536303b6870231abb3ecb77b833f50f1085304509d221f4fe2359ca8` — see this task's own
  commit message for the full five-file list). Plan 1's determinism property survives ten
  indicators unchanged.
- **`manifest.json`'s flat `sources` list is deduplicated** by (table, lang, resolved selection)
  before being written: `median-income` and `house-prices` each call `cpi.ts`'s `fetchCpi`
  independently (by design — `cpi.ts` is deliberately independent of the registry), so without
  deduplication every CPI chunk would appear twice, byte-identically, once per indicator that
  fetched it. `indicatorSources` still records the (table, contentCode, selectionKey) triple
  correctly for whichever indicators declare it as one of their own sources.
- **A real attribution bug, found and fixed before this task was done, not after**: the first
  implementation of `indicatorSources` matched an indicator's declared (table, contentCode)
  pairs against the whole shared `frozen` array, and `population` and `share-65-plus` both
  genuinely declare `TAB638`/`BE0101N1` as one of their own sources — population fetches the
  age TOTAL from it, share-65-plus fetches ages 65+ from the very same table and content code,
  via a different `Alder` selection. That first version attributed share-65-plus's ~51
  chunked requests to population too, and vice versa — a 100% false overlap, only caught by
  comparing the two indicators' own chunk lists against each other rather than trusting that
  the code compiled and the row counts looked plausible. Fixed by having `buildAll()`
  (`kitchen/src/indicators/registry.ts`) return `sourcesByIndicator`: exactly the slice of
  `ctx.frozen` each definition's OWN `build(ctx)` call pushed, so attribution never depends on
  two indicators happening to share a table or content code. Verified against the real
  published manifest: `population` now lists 2 chunks, `share-65-plus` 51, with zero overlap.

## Rounding and minifying the published pantry (follow-up to Task 13, 2026-09-14)

Task 13's own "real size" measurement above (4,962,191 bytes) was investigated further, since
it was five times the size the plan said to flag. Almost none of it was data: two causes,
both measured independently.

- **Pretty-printing.** `stableStringify` (`kitchen/src/publish.ts`) used
  `JSON.stringify(sortKeys(value), null, 2)` — 2-space indentation on a file a browser
  downloads, never a document a human reads directly. Minified alone (rounding not yet
  applied): 2,060,372 bytes, already under half the original. `sortKeys` stays — determinism
  depends on stable key order, not on the file being readable — only the indent argument was
  dropped, and the trailing newline was kept (an existing test already depended on it).
- **Full float precision on every derived value.** `share-65-plus`, `population-change`,
  `net-migration-rate`, `median-income` and `house-prices` are each computed here by division
  or multiplication (never selected directly off an SCB content code), so they carried
  whatever binary floating-point noise the computation happened to produce —
  `4.7196549599507085` for a percentage derived from integer population counts SCB itself
  perturbs from 2025 onward. Fixed by `kitchen/src/round.ts`: one decimal-places-per-unit table
  (`UNIT_DECIMALS`), derived from `Indicator.unit` rather than a per-indicator table, applied
  once at publish time via `roundToUnit` (`Number(value.toFixed(decimals))` — deliberately not
  `Math.round(value * 10 ** decimals) / 10 ** decimals`, which can itself be imprecise, e.g.
  `1.005 * 100 === 100.49999999999999`). Checked against what SCB itself publishes for the two
  non-derived percent/ratio indicators before choosing 2 decimals for the derived ones: tax-rate
  (not derived) publishes 2 decimals (Stockholm 2024: 30.36 — confirmed this does NOT collapse
  to 30.4 under this rounding), density (per-km2) publishes 1, mean-age (years) publishes 1.
- **Combined measured result**: `data/indicators.json` is now **1,044,886 bytes** (from
  4,962,191 — a 78.9% reduction), gzipped **275,499 bytes**. `manifest.json` (also minified,
  unaffected by rounding since it carries no indicator values) is now **26,510 bytes** (from
  34,363), gzipped 5,301 bytes. `layout/bubbles.json` and `geometry/adjacency.json` also
  shrank from minification alone (27,256 → 15,045 and 25,438 → 12,446 bytes respectively);
  `geometry/municipalities.topo.json` is a plain file copy from mapshaper, untouched by
  `stableStringify`, and is unchanged.
- **Determinism, reproven after both changes**: `public/pantry/` deleted entirely, published
  twice from the same frozen `kitchen/raw/`. `data/indicators.json`'s sha256
  (`8fe687602a283cec0398cc00dc9ec30d6c214d598be73a36ca2321a48e73d333`) and `manifest.json`'s
  (`badc41fdb2695edc4dde41250527902eb6ba95e0d89f95a75e6183a63ee72084`) were identical across
  both runs. `toFixed`'s rounding is specified by ECMA-262 against the double's own value with
  no separate scaling step, so it is bit-for-bit reproducible on any conforming engine —
  verified to not reintroduce the classic `Math.round(x * 10**d) / 10**d` scaling-error trap
  (`round.test.ts`), rather than merely assumed safe.
- **Rounded exactly once, at publish time** (`publish.ts`'s `roundPantryData`, called
  immediately before `data/indicators.json` is written) — never inside `buildAll()` or
  `check()`, both of which still see full precision. This matters concretely for the three
  indicators that read another indicator's already-built series
  (`net-migration-rate`/`population-change`/`share-65-plus` all read population's): they
  compute against the real, unrounded value, not a value already rounded once by an earlier
  step.
- **`src/indicators.headline.test.ts` updated to the newly rounded figures**, not merely
  "fixed to keep passing": `net-migration-rate` (Stockholm 2024: 1.1621436... → 1.16),
  `median-income` (Danderyd 2024: 458,705.740093942 → 458,706), `house-prices` (Danderyd 2021:
  16,253,221.539089134 → 16,253,222), `population-change` (Järfälla 2024: 3.0348662... → 3.03;
  Hällefors: -2.678983... → -2.68), `share-65-plus` (Borgholm 2025: 40.65499717673631 → 40.65).
  `post-secondary-education`'s existing assertion (65.278) still passed within its own
  tolerance against the newly rounded 65.28, but was updated anyway to the real published
  number, on the same "a test that cannot fail is worse than none" reasoning. Every changed
  assertion moved by less than its own unit's rounding precision — confirmed individually
  before treating any of them as a mere rounding effect, since a larger jump would have been a
  bug, not rounding.
- **Two regression guards added** (`src/pantry-format.test.ts`), reading the real committed
  `public/pantry/` artifacts directly (the same convention `indicators.headline.test.ts`
  already established): one fails if the published JSON is ever pretty-printed again, one
  fails if any published value or colour-scale break ever carries more decimal digits than its
  unit allows. Both were confirmed red by reverting the fix they guard (the pretty-print
  argument restored, and separately the rounding step skipped) and republishing before being
  confirmed green again — see this task's own commit/report for the captured failing output.

## Places like this: the similarity stage (Plan 6, 2026-09-15)

`publish()` writes a fifth pantry file, `data/similar.json`, holding each municipality's five
nearest neighbours across all ten indicators. 13,091 bytes, 3,836 gzipped, against a 1,045,616-byte
`data/indicators.json`.

**It is computed from the published, rounded data**, not from `buildAll()`'s full-precision
output — the opposite of the rule `roundPantryData` follows for derived indicators, and
deliberately. A derived indicator is a number the site displays, so it must be computed before
rounding or the error compounds invisibly. This is a claim _about_ the published file — "of the
290, these five are closest to Lund" — and a reader checking it has only the published file to
check it against.

**The window is read from the data, not written down.** It ends at the last year every indicator
covers and runs ten years back: 2015–2024 today, because median income stops at 2024 while the
tax rate reaches 2026. The day SCB publishes 2025 median income the window moves on its own.

**Three guards refuse to publish**, all of them for failures that would be invisible on the
rendered page rather than loud:

| Guard                      | Refuses when                                                              |
| -------------------------- | ------------------------------------------------------------------------- |
| neighbour count            | any municipality ends with other than five — it would just render shorter |
| missing dimensions         | any pair shares fewer than eight of the ten — it would render identically |
| window length and coverage | the window is under ten years or starts before an indicator does          |

Why these particular choices, and the measurements behind each, are in
[docs/decisions/0002-similarity-metric.md](decisions/0002-similarity-metric.md).

## The pantry splits (Plan 13, 2026-09-18)

`publish()` no longer writes one `data/indicators.json`. It writes an index and one file per
indicator, because a single file meant the site fetched every series before first paint for an
opening view that draws one.

| File                        | Holds                                                                             | Size (gzip -9)  |
| --------------------------- | --------------------------------------------------------------------------------- | --------------- |
| `data/index.json`           | Municipalities, the price index, and every indicator WITHOUT its prose            | 6,433           |
| `data/indicators/<id>.json` | One indicator in full — description, caveat, derivation, sources — and its series | 6,138 to 49,103 |

Measured on the real output: the ten indicator files sum to 272,879 against 272,475 for the single
file they replaced, so the split costs 404 bytes in total and saves 237,174 before first paint.
The index barely grows with the indicator count — 6,433 at ten, 6,524 extrapolated to
twenty-five — because the 290 municipalities dominate it.

**Prose lives in the per-indicator file**, not the index, because only `AboutIndicator` reads it
and only for the indicator already on screen. That is what keeps the index flat.

**Reading it back.** Three readers, one rule — the index decides the order, never the directory
listing, because `src/state/url.ts` opens on the first indicator:

- `readPantryParts()` in `kitchen/src/publish.ts` — the kitchen and its tests.
- `readPantry()` in `tools/read-pantry.mjs` — the build-time tools, which are plain JavaScript and
  cannot import the TypeScript one. `tools/read-pantry.test.ts` asserts the two agree field for
  field on the real pantry, because two implementations of one rule drift otherwise.
- `src/test/pantry.ts` — the site's tests, via `import.meta.glob`, because `tsconfig.app.json` has
  `vite/client` types and no Node ones.

**Stale files are pruned.** `publish()` deletes any indicator file the index no longer lists.
Without that, dropping or renaming an indicator would leave its file committed and served for
ever, ignored by every reader — the worst kind of stale, because every check would still pass.

**Two invariants the split makes possible to violate**, both enforced by the schemas: an indicator
id must be unique, because the id IS the file name; and a file's series must belong to its own
indicator, which nothing else would have noticed.

Why these choices: [docs/decisions/0013-the-pantry-splits.md](decisions/0013-the-pantry-splits.md).

## What an indicator is (Plans 14 and 15, 2026-09-18)

Nine of the ten indicators are **declarations**, not modules. One is not, for a stated reason.

A declaration names a table, a content **label** (never a code — codes vary by table and by era,
labels are stable), a rule per dimension, and a year range:

```ts
export function taxDefined(): Definition {
  return {
    indicator: TAX,
    sources: [{ table: TAX_TABLE, content: TAX_CONTENT_LABEL, years: TAX_YEARS }],
    spec: { kind: 'direct' },
  }
}
```

Seven lines, against the 153-line module it replaced. The nine range from 7 to 30 lines, mean 19.

**A definition is a function, not a constant.** `CKM_FROM` lives in `population.ts`, which the
other indicator modules import from and which imports back; reading it at module-load time races
that cycle, and `registry.load-order.test.ts` exists because it did.

| Dimension rule                | Means                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `'total'`                     | The dimension's own total code, or every value where `SUM_SAFE` verifies it — otherwise it throws |
| `'all'`                       | Every value, deliberately, where the whole set IS the thing wanted                                |
| `{ values }`                  | An explicit list                                                                                  |
| `{ label }`                   | The one value carrying that Swedish label, refusing none and refusing several                     |
| `{ singleFrom, alsoInclude }` | Single years of age from N up, plus the named open-ended top band                                 |

That last rule is worth its own sentence: the obvious version — "every code whose leading digits
reach 65" — silently includes TAB5557's aggregate bands (`65-69`, `70-74`, `90-99`) alongside the
single ages and counts the same people twice. The frozen-response layer caught it, because the
selection no longer matched anything ever fetched.

| Builder  | Means                                                         | Users                                                                |
| -------- | ------------------------------------------------------------- | -------------------------------------------------------------------- |
| `direct` | Select a cell and publish it                                  | population, mean-age, tax-rate, density, median-income, house-prices |
| `ratio`  | This count over another indicator's series, times a factor    | share-65-plus (×100), net-migration-rate (×1,000)                    |
| `share`  | Some values of one dimension over all of them, times a factor | post-secondary-education                                             |

Modifiers: `scale` (SCB publishes money in thousands), `inflationAdjust`, and `minCount` (a mean
price resting on a handful of sales is noise wearing a number's clothes).

**`population-change` is not a definition.** It reads population's series, propagates four statuses
through a year-over-year comparison and applies the structural-break rule for the years a
municipality split. Forcing it into a generic builder would produce one with a single user.

### One more rule a dimension cannot express

A dimension rule says WHICH codes to take. It cannot say what a code is expected to MEAN, and for
`post-secondary-education` that distinction is load-bearing: levels 5, 6 and 7 are its numerator
because of what those levels are, which is a human definition rather than something TAB3981 states.
If SCB reassigned code 6, every selection would still be valid and the published share would
quietly mean something else.

`Source.verify` is a check the table's metadata must pass before any selection is built from it.
Education declares `validateLevels` there. Add one for any indicator whose declaration rests on an
assumption a rule cannot carry.

### Where an indicator's tests live now

Plan 15 deleted the nine hand-written implementations these declarations replaced. Nothing that
mattered went with them, but the assertions moved, so start in the right place:

| To assert                                                   | Write it in                                                                           |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| A selection's shape, label resolution, a `SUM_SAFE` refusal | `kitchen/src/indicators/source.test.ts` — once, generically                           |
| What a particular SCB table does                            | that indicator's own `*.test.ts`, against `selectionFor(meta, xDefined().sources[n])` |
| That a definition still reproduces its published series     | `kitchen/src/indicators/define.test.ts` — add the new indicator to `DEFINED`          |
| A real figure, an extreme, an edge cell, a status semantic  | `src/indicators.semantics.test.ts`, reading the published pantry                      |
| Coverage, exact cell count, one real value                  | `src/indicators.headline.test.ts`                                                     |

**`define.test.ts` proves no drift, never correctness** — the pantry it compares against was
generated by the definition. The two files under `src/` are the ones that can say a figure is
right, and only because their numbers were derived independently: hand-summed from a frozen chunk,
or checked against the live API. A new indicator has no byte-identical predecessor, so it needs
figures of that second kind from the day it lands.

Why these choices:
[docs/decisions/0014-indicators-become-definitions.md](decisions/0014-indicators-become-definitions.md)
and [docs/decisions/0015-the-old-implementations-go.md](decisions/0015-the-old-implementations-go.md).
