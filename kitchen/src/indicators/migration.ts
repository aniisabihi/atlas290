import { Indicator, type IndicatorSeries } from '../../../shared/pantry'
import { buildDefined, type Definition } from './define'
import type { Source } from './source'
import { type BuildContext, type IndicatorDefinition } from './registry'
// Same deferred-read reasoning density.ts documents for its CKM_FROM import applies here:
// POPULATION and CKM_FROM are read only inside buildMigration's and migrationDefined's function
// bodies below, never at this module's own top level, so the binding is safe to import despite
// the population<->registry<->migration load cycle.
import { CKM_FROM, POPULATION } from './population'

export const MIGRATION_TABLE_OLD = 'TAB1211' // 1968-1996
export const MIGRATION_TABLE_MID = 'TAB1212' // 1997-2024
export const MIGRATION_TABLE_NEW = 'TAB6640' // 2025, CKM

/**
 * Migration's own year range: 1968-2025. Coincides with population's 1968-2025 today, but is
 * defined independently — exactly as tax.ts and density.ts define their own ranges — because
 * `ctx.years` is population's own constant, not a shared one, and reusing it here would
 * silently mis-cover this series if the two ever diverge (a missing fetched year just reads as
 * an ordinary "not yet published" cell, with nothing failing).
 */
export const MIGRATION_YEARS = Array.from({ length: 2025 - 1968 + 1 }, (_, i) => 1968 + i)

/**
 * Swedish label stable across all three source tables, even though the ContentsCode ITSELF
 * differs in every one (docs/decisions/0001-plan-1-build-decisions.md's trap 2, confirmed live
 * 2026-09-14): BE0101C5 in TAB1211, BE0101AZ in TAB1212, 00000868 in TAB6640.
 */
const MIGRATION_CONTENT_LABEL = 'Flyttningsöverskott'

export const MIGRATION: Indicator = Indicator.parse({
  id: 'net-migration-rate',
  name: { sv: 'Flyttningsöverskott per 1 000 invånare', en: 'Net migration per 1,000 residents' },
  description: {
    sv: 'Flyttningsöverskott (in- minus utflyttning, oavsett ursprung) satt i relation till samma års folkmängd.',
    en: "Net migration (in-migration minus out-migration, regardless of origin) set against that year's population.",
  },
  unit: 'per-thousand',
  priceBasis: 'none',
  // Diverging, not sequential: a municipality gaining people and one losing them are not two
  // points on one ramp, they are opposite directions from a meaningful zero — the design
  // requires the colour scale to say so (Task 6 of docs/plans/2026-09-14-02-the-ten-indicators.md).
  scale: { kind: 'diverging', reference: 'zero', breaks: [] },
  coverage: { from: MIGRATION_YEARS[0]!, to: MIGRATION_YEARS[MIGRATION_YEARS.length - 1]! },
  caveat: {
    sv: 'Publicerat som en kvot (flyttningsöverskott per 1 000 invånare), inte en summa, eftersom den absoluta summan i stort sett bara återger folkmängden. Byggd av tre tabeller (1968–1996, 1997–2024, 2025). 50 av dagens kommuner saknar underlag för 1968–1996: den äldsta tabellen publicerar dem under de kommunkoder som gällde då, och dessa matchar inte dagens 290 koder. 47 av dem omnumrerades vid länssammanslagningarna 1998 (13 i Skåne, 34 i Västra Götaland); de tre övriga är Mullsjö och Habo, som bytte län 1998, och Heby, som bytte län 2007. Från 2025 är värdena CKM-störda, liksom befolkningen.',
    en: "Published as a rate (net migration per 1,000 residents), not a count, because the raw count would largely just reproduce the population map. Built from three tables (1968–1996, 1997–2024, 2025). 50 of today's municipalities have no data for 1968–1996: the oldest table publishes them under the codes in force at the time, which do not match today's 290. 47 were renumbered by the 1998 county mergers (13 in Skåne, 34 in Västra Götaland); the other three are Mullsjö and Habo, which changed county in 1998, and Heby, which changed county in 2007. From 2025 the values are CKM-perturbed, like population.",
  },
  sensitivity: 'none',
  sources: [
    { table: MIGRATION_TABLE_OLD, contentCode: 'BE0101C5', note: '1968–1996' },
    { table: MIGRATION_TABLE_MID, contentCode: 'BE0101AZ', note: '1997–2024' },
    { table: MIGRATION_TABLE_NEW, contentCode: '00000868', note: '2025, CKM' },
  ],
  derivation:
    'Net migration is published directly by SCB, never derived by subtracting in- from ' +
    'out-migration flows here. Selected at the age total (resolved by label) and the sex ' +
    'total: summed over the two sexes where no total code exists (TAB1211, TAB1212 — safe, ' +
    'since pre-2025 sex-split counts are disjoint and unperturbed), or selected directly where ' +
    'one does (TAB6640\'s "TotSa"). Divided by that same municipality\'s population in the same ' +
    'year — read from the build context rather than refetched — and multiplied by 1,000. A ' +
    'null population yields a null rate rather than a division by zero.',
})

export async function buildMigration(ctx: BuildContext): Promise<IndicatorSeries> {
  return buildDefined(migrationDefined(), ctx)
}

/**
 * Net migration per 1,000 residents, as a definition (Plan 14) — three tables stitched.
 *
 * TAB1211 to 1996, TAB1212 to 2024 and the Cell Key Method table from 2025, listed in that
 * order so a later one wins any year two of them publish. The denominator is population's
 * already-built series rather than a second fetch, so the two can never disagree.
 *
 * The existence gate is shifted a year: a migration figure stamped with year Y describes moves
 * made during Y, under the boundary that existed then.
 */
export function migrationDefined(): Definition {
  const of = (table: string, years: readonly number[]): Source => ({
    table,
    content: MIGRATION_CONTENT_LABEL,
    years,
    dims: { Alder: 'total', Kon: 'total' },
    regions: 'known',
  })
  return {
    indicator: MIGRATION,
    sources: [
      of(
        MIGRATION_TABLE_OLD,
        MIGRATION_YEARS.filter((y) => y <= 1996),
      ),
      of(
        MIGRATION_TABLE_MID,
        MIGRATION_YEARS.filter((y) => y >= 1997 && y <= 2024),
      ),
      of(
        MIGRATION_TABLE_NEW,
        MIGRATION_YEARS.filter((y) => y >= 2025),
      ),
    ],
    spec: { kind: 'ratio', of: POPULATION.id, times: 1000 },
    existsShift: 1,
    perturbedFrom: CKM_FROM,
  }
}

export const migrationDefinition: IndicatorDefinition = {
  indicator: MIGRATION,
  build: buildMigration,
}
