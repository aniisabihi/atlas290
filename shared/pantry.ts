import { z } from 'zod'

/** Every human-readable string in the pantry exists in both languages. */
export const Bilingual = z.object({ sv: z.string(), en: z.string() })
export type Bilingual = z.infer<typeof Bilingual>

/** SCB four-digit municipality code, kept as a string so "0180" never becomes 180. */
export const MunicipalityCode = z.string().regex(/^\d{4}$/, 'municipality code must be four digits')
export const CountyCode = z.string().regex(/^\d{2}$/, 'county code must be two digits')

export const Municipality = z.object({
  code: MunicipalityCode,
  name: Bilingual,
  county: CountyCode,
  /** Filled by Plan 2 from SCB's area table. */
  landAreaKm2: z.number().nonnegative().optional(),
})
export type Municipality = z.infer<typeof Municipality>

/** Order matters: the index is the status byte stored per cell. Append only. */
export const OBSERVATION_STATUS = [
  'present',
  'not-yet-published',
  'did-not-exist',
  'perturbed',
  'too-few-cases',
] as const
export type ObservationStatus = (typeof OBSERVATION_STATUS)[number]
export function statusCode(status: ObservationStatus): number {
  return OBSERVATION_STATUS.indexOf(status)
}

export const IndicatorId = z.string().regex(/^[a-z][a-z0-9-]*$/)

export const Indicator = z.object({
  id: IndicatorId,
  name: Bilingual,
  description: Bilingual,
  unit: z.enum(['count', 'percent', 'years', 'sek', 'per-thousand', 'per-km2']),
  /** 'fixed-latest-year' means values are inflation-adjusted to the latest year's kronor. */
  priceBasis: z.enum(['none', 'fixed-latest-year']),
  /** Neutral scale hint. There is deliberately no "higher is better" flag. */
  scale: z.object({
    kind: z.enum(['sequential', 'diverging']),
    reference: z.enum(['zero', 'national-median']).optional(),
    /** Fixed class breaks across all years, computed in the kitchen. */
    breaks: z.array(z.number()),
  }),
  coverage: z.object({ from: z.number().int(), to: z.number().int() }),
  caveat: Bilingual,
  /** For indicators built from events (house sales): below this count the cell is 'too-few-cases'. */
  minCount: z.number().int().positive().optional(),
  sensitivity: z.enum(['none', 'sensitive']),
  sources: z.array(z.object({ table: z.string(), contentCode: z.string(), note: z.string() })),
  /** Plain-language statement of how the value was computed from the sources. */
  derivation: z.string(),
})
export type Indicator = z.infer<typeof Indicator>

/**
 * Columnar series: values[m][y] where m indexes PantryData.municipalities and y indexes years.
 * status[m][y] is an index into OBSERVATION_STATUS. null value must not have status 0.
 */
export const IndicatorSeries = z
  .object({
    indicator: IndicatorId,
    years: z.array(z.number().int()),
    values: z.array(z.array(z.number().nullable())),
    status: z.array(
      z.array(
        z
          .number()
          .int()
          .min(0)
          .max(OBSERVATION_STATUS.length - 1),
      ),
    ),
  })
  .superRefine((s, ctx) => {
    if (s.values.length !== s.status.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'values and status must have the same number of rows',
      })
    }
    for (const [i, row] of s.values.entries()) {
      if (row.length !== s.years.length || s.status[i]?.length !== s.years.length) {
        ctx.addIssue({ code: 'custom', message: `row ${i} length must equal years length` })
      }
      for (const [j, v] of row.entries()) {
        if (v === null && s.status[i]?.[j] === 0) {
          ctx.addIssue({
            code: 'custom',
            message: `row ${i} col ${j}: null value cannot be 'present'`,
          })
        }
      }
    }
  })
export type IndicatorSeries = z.infer<typeof IndicatorSeries>

export const PantryData = z
  .object({
    schemaVersion: z.literal(1),
    municipalities: z.array(Municipality),
    indicators: z.array(Indicator),
    series: z.array(IndicatorSeries),
  })
  .superRefine((p, ctx) => {
    for (const s of p.series) {
      if (s.values.length !== p.municipalities.length) {
        ctx.addIssue({
          code: 'custom',
          message: `series ${s.indicator}: rows (${s.values.length}) must equal municipalities (${p.municipalities.length})`,
        })
      }
      if (!p.indicators.some((i) => i.id === s.indicator)) {
        ctx.addIssue({ code: 'custom', message: `series ${s.indicator} has no indicator` })
      }
    }
  })
export type PantryData = z.infer<typeof PantryData>

/** Keyboard neighbours. `synthetic` lists edges added so islands are reachable. */
export const Adjacency = z.object({
  schemaVersion: z.literal(1),
  neighbours: z.record(MunicipalityCode, z.array(MunicipalityCode)),
  synthetic: z.array(z.tuple([MunicipalityCode, MunicipalityCode])),
})
export type Adjacency = z.infer<typeof Adjacency>

/** Dorling layout in the unit square; r is in the same units. */
export const Bubbles = z.object({
  schemaVersion: z.literal(1),
  basedOn: z.object({ indicator: IndicatorId, year: z.number().int() }),
  circles: z.array(
    z.object({ code: MunicipalityCode, x: z.number(), y: z.number(), r: z.number() }),
  ),
})
export type Bubbles = z.infer<typeof Bubbles>

export const Manifest = z.object({
  schemaVersion: z.literal(1),
  license: z.literal('CC0-1.0'),
  sources: z.array(
    z.object({
      table: z.string(),
      lang: z.enum(['sv', 'en']),
      url: z.string().url(),
      /** Copied from the frozen raw file; set once at freeze time, never at publish time. */
      fetchedAt: z.string().datetime(),
      sha256: z.string().length(64),
      cells: z.number().int().nonnegative(),
    }),
  ),
})
export type Manifest = z.infer<typeof Manifest>
