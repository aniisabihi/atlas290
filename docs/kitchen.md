# Running the kitchen

The kitchen is the offline data pipeline. It is the only code that talks to SCB.

| Command                | Network | What it does                                                                                                                                                       |
| ---------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `yarn kitchen fetch`   | yes     | Downloads the tables the indicators need and freezes each response under `kitchen/raw/<table>/<lang>/`. Already-frozen chunks are skipped, so re-running is cheap. |
| `yarn kitchen publish` | **no**  | Reads only `kitchen/raw/`, builds geometry, adjacency, bubbles and the indicator file into `public/pantry/`. Refuses to touch the network.                         |
| `yarn kitchen all`     | yes     | Both, in order.                                                                                                                                                    |

Running `publish` twice produces byte-identical files. If a pull request shows a pantry diff, a
number changed at SCB or the code changed; never both silently. `publish()` also refuses to
write **any** pantry file — including the topology file itself — unless the topology's
municipality codes and the fetched statistics' municipality codes are exactly the same set: the
topology is built into a scratch directory first, the code check runs against that, and only a
passing check lets the topology file land in `public/pantry/`. The map and the numbers are
joined by code, and a silent mismatch there would mean a municipality is drawn with another's
data, or drawn with none.

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
