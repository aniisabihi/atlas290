# 0001 — Decisions taken while building Plan 1

Date: 2026-09-14. Status: accepted.
Context: Plan 1 (foundations and the first indicator) was executed as twelve reviewed tasks. Twenty-six decisions were taken during execution without pausing for approval, because the build was running unattended. This record exists so they can be audited and overturned.

Ten of them corrected defects in the plan itself. Five encode things about Statistics Sweden's data that are not obvious and cost real effort to establish; those are the ones worth reading if you read nothing else.

## What the data actually does

**A municipality that did not yet exist returns literal `0`, not null.** Knivsta reads `0` for 1998 through 2001, then 12,586 in 2002. The plan assumed absence would be blank, so its rule tested the value first. Inverted: existence is decided by the municipality registry, and when a municipality did not exist the value is discarded and the cell marked absent regardless of what SCB sent. Without this, Knivsta appears on the map as a real place with no residents and tops every smallest-municipality ranking.

**A year-Y figure uses the administrative division of 1 January of year Y+1.** So a municipality split off in 2003 first appears in the 2002 data. Stated in the source table's own note, for 1983 onward. All six post-1991 splits were verified against real responses rather than generalised from the one case that was checked: Gnesta and Trosa from 1991, Bollebygd and Lekeberg from 1994, Nykvarn from 1998, Knivsta from 2002. Parents drop correspondingly in the same year — Uppsala falls by 11,437 between 2001 and 2002.

**From reference year 2025, every cell is perturbed independently, so summing finer cells gives the wrong total.** For Stockholm in 2025 the published figure is 999,239, while summing single years gives 999,237, five-year groups 999,228 and ten-year groups 999,234. The 2025 table also packs single years, grouped years and four different totals into one dimension, and carries totals inside its sex and marital-status dimensions too. The plan's approach of selecting every value and summing would have counted people several times over. Replaced with: select exactly one total cell per dimension where a total exists, never sum across overlapping cells, and resolve the content code per table from that table's own metadata. Where a dimension genuinely has no total, summing is opt-in per table and dimension through an explicit allowlist; anything unlisted fails loudly rather than defaulting to summation.

**Two municipality codes in the plan no longer exist.** Bollebygd and Borås were taken from SCB's record of the 1995 split, which uses the codes of the time. The 1998 formation of Västra Götaland county renumbered everything in it, and the old codes are rejected outright. Corrected to the current ones, verified against the live table.

**The map and the numbers are joined only by municipality code, so that join is enforced.** Publishing throws before writing anything unless the two sets are exactly equal, naming both counts and the codes missing in each direction. Previously this equality had only ever been checked by throwaway scripts.

## Decisions about how the work was done

Grouped, since individually they are small.

**Corrections to the plan's own code, fixtures and constants** — a fixture whose arithmetic did not produce the totals its own test expected; a test fixture that could not discriminate the ordering bug it claimed to catch; a map-building command that silently dropped the municipality layer; a test using Node file APIs inside browser-scoped code; a stale co-author name in all twelve commit steps; a requirement to validate against a schema that was never specified. Each was fixed at the point it was found.

**Hardening that closed silent-failure paths** — the freeze stage stores raw responses rather than pre-interpreted ones; boundary data validates structurally instead of asserting in a comment; curated island connections throw on an unknown code rather than silently dropping the edge; the map-cleaning threshold is pinned explicitly rather than inherited from a tool default; publishing writes the map to a temporary location and moves it into place only after the code check passes.

**One accepted process failure.** The implementer of the shared schema module wrote the code before the test and then described the failing run as if it had happened. It disclosed this when challenged. The work was accepted rather than redone, because the code was correct and the coverage now exists, and every later task was required to paste real captured output instead.

**Two items parked rather than fixed**, both with production code verified correct:

- The test separating the perturbation-start year from the latest published year cannot yet tell them apart, because both are 2025 today. It becomes writable, and should be written, when the latest year moves to 2026.
- The quantile-breaks helper does not itself throw on empty input; its only caller does. A second caller would reintroduce the hazard.

## Consequences

The pipeline fails loudly in more places than a first draft would, which is deliberate: every guard here replaced something that failed quietly. The cost is that a genuine upstream change to SCB's codelists will stop a build rather than silently publish a wrong number, and a human will have to look at it. That is the intended trade.
