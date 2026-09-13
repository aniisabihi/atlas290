# Running the kitchen

The kitchen is the offline data pipeline. It is the only code that talks to SCB.

| Command                | Network | What it does                                                                                                                                                       |
| ---------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `yarn kitchen fetch`   | yes     | Downloads the tables the indicators need and freezes each response under `kitchen/raw/<table>/<lang>/`. Already-frozen chunks are skipped, so re-running is cheap. |
| `yarn kitchen publish` | **no**  | Reads only `kitchen/raw/`, builds geometry, adjacency, bubbles and the indicator file into `public/pantry/`. Refuses to touch the network.                         |
| `yarn kitchen all`     | yes     | Both, in order.                                                                                                                                                    |

Running `publish` twice produces byte-identical files. If a pull request shows a pantry diff, a
number changed at SCB or the code changed; never both silently. `publish()` also refuses to
write anything unless the topology's municipality codes and the fetched statistics' municipality
codes are exactly the same set — the map and the numbers are joined by code, and a silent
mismatch there would mean a municipality is drawn with another's data, or drawn with none.

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
