# The question list

Candidate indicators for the expansion beyond the first ten, chosen **question-led**: each row
starts from something a visitor would want to know, and only then asks which SCB table answers it.

Every table id, content code, coverage range and municipality count below was verified against
**live SCB v2 metadata on 2026-09-17** (`https://statistikdatabasen.scb.se/api/v2`). Anything not
verified says so in its own row. Four candidates were **rejected on verification** and are listed
with their reason, because a rejected candidate is worth as much as an accepted one.

This document is an input to a plan, not a plan. Nothing here is decided.

## What the source actually contains

| Figure                                             | Value                         |
| -------------------------------------------------- | ----------------------------- |
| Tables in SCB's statistical database                | 4,300                         |
| …carrying a region variable                         | 1,319                         |
| …of those, annual                                   | 1,110                         |
| Median variables per annual region table            | 5 (max 9)                     |
| Tables the pantry uses today                        | 13, for 10 indicators         |

"Region" does not mean municipality. Of the candidates checked here, **four looked like
municipality data and were not** — see [Rejected](#rejected-on-verification). Every accepted row
below was confirmed to carry 290 four-digit municipality codes.

## How to read a row

- **Builder** — which of the five kitchen builders the indicator needs. Four exist in effect
  today (`direct`, `share`, `rate`, `change`); `difference` is new and is what makes most of the
  combination questions cheap.
- **Coverage** — the source's own first and last period, verified, not inferred.
- **New fetch** — whether this needs a table the kitchen does not already freeze.

---

## A. Life and death

The demographic engine underneath the population indicator the site already has.

| #   | The question                                                  | The measure                                          | Source (verified)                                                          | Coverage                 | Builder    | New fetch |
| --- | ------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------ | ---------- | --------- |
| 1   | Are more people being born here than are dying?               | Natural change per 1,000 residents                   | `TAB1264` (births, `BE0101E2`) − `TAB960` (deaths, `BE0101D9`); CKM continuations `TAB6401` / `TAB6757` for 2025 | 1968–2025                | difference | yes       |
| 2   | Is this place growing from births, or from people arriving?   | Natural change vs net migration, same unit           | Q1 and the existing `net-migration-rate`                                   | 1968–2025                | difference | no        |
| 3   | How long do people live here?                                 | Life expectancy at birth, years                      | `TAB4394` `000000NH`                                                       | 1998–2002 … 2021–2025 ⚠️ | direct     | yes       |
| 4   | How many children are people having?                          | Total fertility rate                                 | `TAB4805` `000001J4`                                                       | 2000–2025                | direct     | yes       |
| 5   | Is this a place of children, or of pensioners?                | Dependency ratio, and its two halves separately      | `TAB4642` `00000708` / `00000707` / `00000709`                             | 2000–2025                | direct     | yes       |

⚠️ Q3's periods are five-year windows (`1998-2002`), not years. See
[Open questions](#open-questions-for-the-architect).

## B. Work and money

| #   | The question                                         | The measure                                    | Source (verified)                                                   | Coverage           | Builder | New fetch |
| --- | ---------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------- | ------------------ | ------- | --------- |
| 6   | How many people here have a job?                     | Employment rate, per cent                      | `TAB3200` `000002NS` (final) / `TAB5655` `000006J6` (preliminary)   | 2020–2024 / –2025  | direct  | yes       |
| 7   | How many are out of work?                            | Unemployment rate, per cent                    | `TAB3200` `000002NN`                                                | 2020–2024          | direct  | yes       |
| 8   | Can this municipality afford itself?                 | Taxable income per resident, and as % of national mean | `TAB3600` `OE0101A0` and `OE0101B0`                            | 1995–2026          | direct  | yes       |
| 9   | What does a household actually have to live on?      | Median disposable household income (fixed prices) | `TAB1492` `000006SY`                                              | 2011–2024          | direct  | yes       |
| 10  | Do people leave this place to work?                  | Out-commuters as a share of employed residents | `TAB3267` (1993–2003) + `TAB3266` (2004–2018) + `TAB5839` (2019–2021) | 1993–2021 ⚠️       | share   | yes       |
| 11  | Do people come here to work?                         | In-commuters per 1,000 residents               | same three tables                                                   | 1993–2021 ⚠️       | rate    | yes       |

⚠️ Commuting stops in 2021; DESIGN §8 already states this. Three tables stitched, the same shape
as the existing migration indicator, which is the precedent for how to do it honestly.

## C. Housing

| #   | The question                                    | The measure                                    | Source (verified)                             | Coverage  | Builder    | New fetch |
| --- | ----------------------------------------------- | ---------------------------------------------- | --------------------------------------------- | --------- | ---------- | --------- |
| 12  | How many years of income does a house cost?     | House price ÷ median income                    | existing `house-prices` ÷ existing `median-income` | 1999–2024 | difference | **no**    |
| 13  | Is anyone building here?                        | Completed dwellings per 1,000 residents        | `TAB2538` `BO0101A5`                          | 1938–2025 | rate       | yes       |
| 14  | Is there enough housing for the people?         | Dwellings per 1,000 residents                  | `TAB824` `BO0104AH`                           | 1990–2025 | rate       | yes       |
| 15  | Is this a place of houses or of flats?          | Share of dwellings that are houses             | `TAB824`, by `hustyp`                         | 1990–2025 | share      | shared    |
| 16  | Do people here rent or own?                     | Share of dwellings that are rentals            | `TAB824`, by `upplåtelseform`                 | 1990–2025 | share      | shared    |
| 17  | What does renting cost?                         | Median rent per m², per year                   | `TAB4590` `000000J4`                          | 2016–2025 | direct     | yes       |
| 18  | How many people share a home?                   | Persons per household                          | `TAB4374` `000000M5`                          | 2011–2025 | direct     | yes       |

Q12 is the cleanest proof of the combination idea in the whole list: **both inputs are already in
the pantry**, so it costs no fetch, no freeze and no new table — one definition and a caveat.

Q15 and Q16 are different selections of the same table as Q14, which is the case the declarative
definition format has to handle well, since it is the ordinary case rather than the exception.

## D. Democracy

| #   | The question                                           | The measure                                          | Source (verified)                    | Coverage                | Builder    | New fetch |
| --- | ------------------------------------------------------ | ---------------------------------------------------- | ------------------------------------ | ----------------------- | ---------- | --------- |
| 19  | Do people here vote?                                   | Turnout in the general election, per cent            | `TAB2707` `ME0104B8`                 | 1973–2022, 15 years ⚠️  | direct     | yes       |
| 20  | Do people vote more for the country than for the town? | Turnout gap, national − municipal, percentage points | `TAB2707` `ME0104B8` − `ME0104C6`    | 1973–2022 ⚠️            | difference | shared    |
| 21  | Do the elected resemble the people who elected them?   | Difference between councillors and electorate, pp    | `TAB708` `000000BO`                  | 2007–2010 … 2023–2026 ⚠️ | direct     | yes       |

⚠️ Q19 and Q20 exist only in election years — 15 values across 50 years, so the slider has data at
1973, 1976, 1979… and nothing between. Q21 is by mandate period, not year, same problem as Q3.

Q20 is a naturally diverging measure around zero, which is a scale kind the pantry already
supports and only two current indicators use.

## E. Land, nature and climate

DESIGN §8 says SCB gives us no nature data. That is **too pessimistic** — it is true of weather
and of habitat polygons, and false of land use, proximity to protected nature, and emissions.

| #   | The question                                    | The measure                                       | Source (verified)              | Coverage         | Builder | New fetch |
| --- | ----------------------------------------------- | ------------------------------------------------- | ------------------------------ | ---------------- | ------- | --------- |
| 22  | Are this place's emissions falling?             | Greenhouse gases, kt CO₂e — and per resident      | `TAB4357`, substance `GHG`     | 2008–2022        | direct / rate | yes  |
| 23  | What is this place made of?                     | Share of land that is forest / farm / built        | `TAB5118` `000002UN`           | 2010, 2015, 2020 | share   | yes       |
| 24  | Has the farmland gone?                          | Agricultural land, hectares                       | `TAB6002` `000006O6`           | 1951–2020, 9 points | direct | yes      |
| 25  | Can you reach nature from your front door?      | Share of residents within 1 km of protected nature | `TAB4422` `000000PL`          | 2013–2025        | direct  | yes       |
| 26  | Is there green space where people actually live? | Share of urban residents near a green area        | `TAB5591` `0000046N`           | 2015, 2020       | direct  | yes       |
| 27  | Is this a summer-house place?                   | Holiday homes per 1,000 residents                 | `TAB4198` `0000000E`           | 2015, 2020       | rate    | yes       |

Q24 is the longest baseline available anywhere in this list — 1951, seventeen years before the
site's current start. Q22 is the first climate measure the project could honestly carry.

## F. Getting around

| #   | The question                     | The measure              | Source (verified)     | Coverage  | Builder | New fetch |
| --- | -------------------------------- | ------------------------ | --------------------- | --------- | ------- | --------- |
| 28  | How car-dependent is this place? | Cars in traffic per 1,000 residents | `TAB3276` `TK1001AB` | 2002–2025 | rate    | yes       |

## G. Combinations, using only what is already fetched

These need **no new SCB table at all**. They are the direct answer to "combine data with each
other to answer more questions", and they are the cheapest rows in this document.

| #   | The question                                       | The measure                                             | Built from                                       |
| --- | -------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------ |
| 12  | How many years of income does a house cost?        | `house-prices` ÷ `median-income`                        | pantry only                                      |
| 29  | Where do women and men differ most in education?   | Gap in post-secondary share, percentage points          | `TAB3981`, already frozen, selected twice by sex |
| 30  | Is this place ageing faster than the country?      | Share 65+ minus the national share, percentage points   | pantry only                                      |
| 31  | Is growth here births or arrivals?                 | Q1 against `net-migration-rate`                         | Q1 plus pantry                                   |

Q29 is the test case for the flat-indicator decision: it is one table, selected twice, subtracted —
so it proves the `difference` builder and the sex-split naming scheme at the same time.

---

## Rejected on verification

Each of these looked right in the catalogue listing and failed when its metadata was read. They
are recorded so nobody spends the same hour twice.

| Table     | What it promised                                | Why it fails                                             |
| --------- | ----------------------------------------------- | -------------------------------------------------------- |
| `TAB6259` | Average rent per m², **1969–2025** — 57 years   | One region value. National only.                          |
| `TAB6829` | Formally protected nature, area by type          | One region value. National only.                          |
| `TAB1176` | Housing costs per household, 2020–2024           | Five region values. Not municipalities.                   |
| `TAB4612` / `TAB4610` / `TAB4618` | Rents by rooms / build year / owner | Six region values. Only `TAB4590` reaches all 290. |

The pattern is worth naming: **a table's label says "efter region" whether it has 1 region or 290.**
Any declarative definition format must therefore verify the municipality count at build time, not
trust the catalogue. This is a check the kitchen should make once and apply to every definition.

## Questions SCB cannot answer

Stating these keeps the atlas honest about its own edges, and they are the questions visitors are
most likely to arrive with.

- Crime and safety; school results; healthcare access or waiting times; childcare places.
- Weather, sunshine, temperature — measured at stations, not municipalities.
- Flat prices: SCB's municipal price data covers **single-family houses only**.
- Broadband, road quality, public transport frequency.
- Anything split by country of birth or background — available, and **deliberately out of scope**
  per DESIGN §2 until there are explicit framing rules and a decision record.

## Open questions for the architect

1. **Periods that are not years.** Q3 (five-year windows), Q21 (mandate periods) and arguably Q19
   (election years) do not fit `IndicatorSeries.years: number[]`, which is a list of integers.
   Options: pin each period to a representative year and say so in the caveat; exclude them; or
   extend the contract. The first is cheapest and the third touches the highest-stakes file.
2. **Sparse series on a 58-year axis.** Q19 has 15 values, Q23 and Q26 have two or three. The site
   already handles ragged coverage honestly via `EmptyYear`, but a map that is empty at 55 of 58
   slider positions is a different experience from one that is empty at 5, and the design has
   never had to face it.
3. **How many go in the first increment.** There are 28 questions here. Ten to fifteen makes a
   plan; all 28 does not.
4. **Q22 and DESIGN §8.** Shipping emissions means editing the sentence that says SCB has no
   nature data. That is a decision record either way.
