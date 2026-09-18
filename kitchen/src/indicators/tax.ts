import { Indicator, type IndicatorSeries } from '../../../shared/pantry'
import { buildDefined, type Definition } from './define'
import { type BuildContext, type IndicatorDefinition } from './registry'

export const TAX_TABLE = 'TAB2017'

/**
 * Tax rate's own year range: 2000-2026. SCB sets next year's rate in December of the year
 * before, so this genuinely runs one year beyond population's 1968-2025 (and every other
 * indicator's) coverage. This must NOT be replaced by `ctx.years` (population's own constant,
 * currently 1968-2025) — reusing it here would silently drop 2026 with nothing failing, since
 * a missing fetched year just reads as an ordinary "not yet published" cell rather than an
 * error. Defined locally instead, exactly as population.ts defines its own YEARS.
 */
export const TAX_YEARS = Array.from({ length: 2026 - 2000 + 1 }, (_, i) => 2000 + i)

/**
 * Swedish label SCB uses for the total (municipality + region) tax rate content code. Resolved
 * by label rather than hardcoded, per docs/decisions/0001-plan-1-build-decisions.md's trap 2 —
 * the same convention every indicator in this project uses.
 */
const TAX_CONTENT_LABEL = 'Skattesats, total kommunal'

export const TAX: Indicator = Indicator.parse({
  id: 'tax-rate',
  name: { sv: 'Kommunal skattesats', en: 'Municipal tax rate' },
  description: {
    sv: 'Total kommunal skattesats (till kommun och region), i procent av den beskattningsbara förvärvsinkomsten.',
    en: 'Total municipal tax rate (to municipality and region), percent of taxable earned income.',
  },
  unit: 'percent',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: TAX_YEARS[0]!, to: TAX_YEARS[TAX_YEARS.length - 1]! },
  caveat: {
    sv: 'Avser den skattesats kommunen beslutat för december året före redovisningsåret. 2026 löper därför ett år före varje annan indikator i denna databas.',
    en: 'The rate the municipality set in December of the year before. 2026 therefore runs a year ahead of every other indicator in this dataset.',
  },
  sensitivity: 'none',
  sources: [{ table: TAX_TABLE, contentCode: 'OE0101D1', note: '2000–2026' }],
  derivation:
    'One SCB cell per municipality and year: the single "total kommunal" tax-rate content ' +
    'code, resolved by its stable Swedish label. TAB2017 has no dimension beyond Region and ' +
    'Tid, so there is nothing to select a total from and nothing to sum.',
})

export async function buildTax(ctx: BuildContext): Promise<IndicatorSeries> {
  return buildDefined(taxDefined(), ctx)
}

/**
 * Tax rate, as a definition rather than a module (Plan 14).
 *
 * TAB2017 has no dimension beyond Region and Tid, so there is nothing to total and nothing to
 * sum — which is why this is the first indicator migrated: it exercises the declaration and the
 * status rules without exercising anything else.
 */
export function taxDefined(): Definition {
  return {
    indicator: TAX,
    sources: [{ table: TAX_TABLE, content: TAX_CONTENT_LABEL, years: TAX_YEARS }],
    spec: { kind: 'direct' },
  }
}

/**
 * The registry entry, now a thin adapter over the declaration above. `buildAll` still sees an
 * `IndicatorDefinition`; what it calls is the shared builder rather than a module of its own.
 */
export const taxDefinition: IndicatorDefinition = {
  indicator: TAX,
  build: (ctx) => buildDefined(taxDefined(), ctx),
}
