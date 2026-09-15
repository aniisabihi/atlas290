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

/**
 * Order matters: the index is the status byte stored per cell, persisted in every published
 * series. Append only — NEVER insert or reorder — inserting would silently relabel every
 * status byte already on disk for every year and municipality published so far, in every
 * series that was ever published under the old ordering.
 */
export const OBSERVATION_STATUS = [
  'present',
  'not-yet-published',
  'did-not-exist',
  'perturbed',
  'too-few-cases',
  // Added by kitchen/src/breaks.ts (Plan 2, Task 12's parent-break half): a parent
  // municipality's cell in a derived CHANGE indicator, in the year a child split off, where
  // the underlying level genuinely moved only because of a boundary redraw — not because
  // anyone moved. Appended at the end, per the rule above.
  'structural-break',
] as const
export type ObservationStatus = (typeof OBSERVATION_STATUS)[number]
export function statusCode(status: ObservationStatus): number {
  return OBSERVATION_STATUS.indexOf(status)
}

export const IndicatorId = z.string().regex(/^[a-z][a-z0-9-]*$/)

/**
 * Follow-up to Task 13 (docs/plans/2026-09-14-02-the-ten-indicators.md): the published pantry
 * was carrying full float precision on every derived indicator — `share-65-plus` publishing
 * `4.7196549599507085`, sixteen significant figures for a percentage derived from integer
 * population counts SCB deliberately perturbs from 2025 onward. That asserts a precision the
 * source data does not have, on top of costing real bytes for digits nobody can act on.
 *
 * Decimal places a value published under each `Indicator.unit` may honestly carry. Derived
 * from the unit — the schema's own enum, already the one place `check.ts` and the render code
 * trust — rather than a per-indicator table someone maintaining a tenth or eleventh indicator
 * could get wrong or forget to add to entirely.
 *
 *   count:        0 — people are counted, not measured; a fractional person is not a value.
 *   sek:          0 — whole kronor; a house price or income to four decimal places is absurd,
 *                 and every money figure here is already stored as an integer number of kronor
 *                 before this rounding step even runs (income.ts/housing.ts multiply their
 *                 source tkr figures by 1,000).
 *   percent:      2 — matches what SCB itself publishes for tax-rate, the one percent-unit
 *                 indicator whose value is NOT derived by this project (selected directly off
 *                 TAB2017): Stockholm's 2024 rate is 30.36, two decimals, verified against the
 *                 real fetched table rather than assumed. 1 decimal would collapse that to
 *                 30.4, silently discarding a real, correctly-published SCB digit — the
 *                 specific trap this task's own brief calls out by name. The other three
 *                 percent indicators (post-secondary-education, population-change,
 *                 share-65-plus) are computed here by division and so have no SCB-published
 *                 precision of their own to match; they take the same 2 decimals as their
 *                 sibling percent-unit indicator instead of a separately invented figure.
 *   per-thousand: 2 — net-migration-rate has no SCB-published precision to match either (SCB
 *                 publishes the raw migration count, not the per-1,000 rate; this project
 *                 computes the rate from that count and population) — 2 decimals matches its
 *                 nearest sibling ratio unit, percent, for the same reason.
 *   per-km2:      1 — SCB's own TAB628 density table publishes exactly one decimal (confirmed
 *                 against the real fetched data: Stockholm 2024 is 5289.4, not 5289.42 or
 *                 5289).
 *   years:        1 — SCB's own TAB637 mean-age table publishes exactly one decimal (confirmed
 *                 against the real fetched data: Borgholm 2025 is 53.3).
 */
export const UNIT_DECIMALS: Record<Indicator['unit'], number> = {
  count: 0,
  sek: 0,
  percent: 2,
  'per-thousand': 2,
  'per-km2': 1,
  years: 1,
}

export const Indicator = z
  .object({
    id: IndicatorId,
    name: Bilingual,
    description: Bilingual,
    unit: z.enum(['count', 'percent', 'years', 'sek', 'per-thousand', 'per-km2']),
    /** 'fixed-latest-year' means values are inflation-adjusted to the latest year's kronor. */
    priceBasis: z.enum(['none', 'fixed-latest-year']),
    /**
     * WHICH year's kronor, when `priceBasis` is 'fixed-latest-year'. Stored rather than derived,
     * because it cannot be derived correctly: the base is the last year of SCB's consumer price
     * index (2025), which is not the same as the indicator's own last year. Median income stops
     * at 2024 but is expressed in 2025 kronor, so a site inferring the basis from `coverage.to`
     * would tell visitors "2024 kronor" — off by a year's inflation, and a false statement about
     * money presented as a fact.
     */
    priceBasisYear: z.number().int().optional(),
    /**
     * The smallest step the SOURCE publishes at, in this indicator's own unit — 1000 kronor for
     * house prices, which SCB publishes as whole thousands, and 100 for median income, which it
     * publishes as thousands to one decimal.
     *
     * It exists so the site can recover the figure SCB actually published from the
     * inflation-adjusted one it stores, by undoing the adjustment and snapping back to the step
     * the original always landed on. That recovery is exact — proven for all 20,260 money cells
     * in src/data/nominal.test.ts — but only at the right step: snapping income to 1000 instead
     * of 100 recovers 797 of 7,537 cells. So the step is published per indicator rather than
     * assumed to be the same everywhere.
     */
    publishedStep: z.number().positive().optional(),
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
  .superRefine((i, ctx) => {
    const adjusted = i.priceBasis === 'fixed-latest-year'
    if (adjusted && i.priceBasisYear === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: `${i.id}: priceBasis is 'fixed-latest-year' but no priceBasisYear says which year`,
      })
    }
    if (adjusted && i.publishedStep === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: `${i.id}: adjusted for inflation but no publishedStep, so the figure SCB published cannot be recovered`,
      })
    }
    if (!adjusted && i.priceBasisYear !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: `${i.id}: priceBasisYear is set but priceBasis is '${i.priceBasis}', so nothing was adjusted`,
      })
    }
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

/**
 * The national consumer price index, published so the site can undo an inflation adjustment.
 * Forty-six numbers, against the 69 kB gzipped it would cost to store every money figure twice.
 */
export const PriceIndex = z.object({
  /** The year every adjusted figure in the pantry is expressed in. */
  base: z.number().int(),
  /** Year (as a string, because JSON object keys are strings) to index value. */
  values: z.record(z.string().regex(/^\d{4}$/), z.number().positive()),
})
export type PriceIndex = z.infer<typeof PriceIndex>

export const PantryData = z
  .object({
    schemaVersion: z.literal(1),
    municipalities: z.array(Municipality),
    indicators: z.array(Indicator),
    series: z.array(IndicatorSeries),
    priceIndex: PriceIndex,
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
    for (const i of p.indicators) {
      if (
        i.priceBasisYear !== undefined &&
        p.priceIndex.values[String(i.priceBasisYear)] === undefined
      ) {
        ctx.addIssue({
          code: 'custom',
          message: `${i.id}: adjusted to ${i.priceBasisYear}, which the price index does not cover`,
        })
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

/**
 * Each municipality's nearest neighbours in the space of the ten indicators — "places like
 * this" — computed in the kitchen and published, like every other derived figure.
 *
 * A separate file rather than a field on `PantryData`, for the same reason adjacency and the
 * bubble layout are separate: it is derived FROM the data rather than part of it, so the site
 * can validate and fail on it on its own, and a future plan can drop or replace it without
 * touching the schema every view depends on.
 *
 * `method` is published rather than assumed. The panel's "measured over 2015-2024 across ten
 * indicators" line is rendered from this object, so changing the window in the kitchen cannot
 * leave a stale sentence behind in the site — the exact drift Plan 4's facts strip was built
 * to prevent, applied here before it can happen.
 */
export const Similar = z
  .object({
    schemaVersion: z.literal(1),
    method: z.object({
      /** Indicator ids the distance was computed over, in the pantry's own published order. */
      indicators: z.array(IndicatorId).nonempty(),
      /**
       * Which of those were log-transformed before standardising. Published, not inferred:
       * the site states the method, and a reader who wants to check it needs to know that
       * population was compared on a log scale rather than a linear one.
       */
      logged: z.array(IndicatorId),
      /** Inclusive years the per-year standard scores were averaged over. */
      window: z.object({ from: z.number().int(), to: z.number().int() }),
      /** How many neighbours each municipality gets. */
      neighbours: z.number().int().positive(),
    }),
    /**
     * Municipality code to the codes of its nearest neighbours, nearest first. The ORDER is
     * real but must not be presented as a ranking: the gap between the fifth and sixth nearest
     * has a median of 0.032 against typical distances near 1.0, and a minimum of exactly 0.000,
     * so "the third most similar" would be false precision. The site lists them as a set.
     *
     * The relationship is also NOT symmetric — A is in B's five for only 55% of pairs — so
     * nothing may read this as "these two are each other's neighbours".
     */
    nearest: z.record(MunicipalityCode, z.array(MunicipalityCode)),
  })
  .superRefine((s, ctx) => {
    if (s.method.window.from > s.method.window.to) {
      ctx.addIssue({
        code: 'custom',
        message: `window runs ${s.method.window.from}-${s.method.window.to}, which is backwards`,
      })
    }
    for (const id of s.method.logged) {
      if (!s.method.indicators.includes(id)) {
        ctx.addIssue({
          code: 'custom',
          message: `'${id}' is listed as log-transformed but is not one of the indicators the distance was computed over`,
        })
      }
    }
    for (const [code, neighbours] of Object.entries(s.nearest)) {
      if (neighbours.length === 0) {
        ctx.addIssue({ code: 'custom', message: `${code}: no neighbours, which is not a result` })
      }
      if (neighbours.includes(code)) {
        ctx.addIssue({ code: 'custom', message: `${code}: is listed as its own neighbour` })
      }
      if (new Set(neighbours).size !== neighbours.length) {
        ctx.addIssue({
          code: 'custom',
          message: `${code}: the same municipality appears twice among its neighbours`,
        })
      }
    }
  })
export type Similar = z.infer<typeof Similar>

/**
 * The facts strip, generated rather than written.
 *
 * Five sentences a person chose by hand became five the kitchen finds, one from each of five
 * families. The families are separate because "how surprising" is not comparable across kinds
 * of claim: a 47-year run of decline and a tax rate three points below a municipality's twins
 * are both striking, and any single number ranking one against the other would be an invention
 * dressed as objectivity. So each family ranks its own and the strip takes the best of each.
 *
 * `claim` is the property that has kept this strip honest since Plan 4. It states, in a form a
 * test can recompute from `indicators.json` alone, exactly what the sentence asserts — so a
 * monthly refresh that falsifies a fact fails the build instead of publishing a confident lie
 * on the front page. It survives the move from hand-written to generated precisely because
 * generation makes the hazard worse, not better: nobody reads a sentence nobody wrote.
 */
export const FACT_FAMILIES = ['country', 'run', 'reversal', 'unusual', 'extreme'] as const
export type FactFamily = (typeof FACT_FAMILIES)[number]

export const Facts = z
  .object({
    schemaVersion: z.literal(1),
    facts: z.array(
      z.object({
        /** Stable across rebuilds, so a link to a fact keeps working. */
        id: z.string().min(1),
        family: z.enum(FACT_FAMILIES),
        text: Bilingual,
        /**
         * Where the fact can be seen, as a language-less path the site prefixes. A fact the
         * visitor cannot go and check is a claim, not a fact.
         */
        href: z.string().startsWith('/?'),
        /** What this fact asserts, in a form the pantry can be asked to confirm. */
        claim: z.string().min(1),
      }),
    ),
  })
  .superRefine((f, ctx) => {
    const ids = new Set<string>()
    const families = new Set<string>()
    for (const fact of f.facts) {
      if (ids.has(fact.id)) {
        ctx.addIssue({ code: 'custom', message: `two facts share the id '${fact.id}'` })
      }
      ids.add(fact.id)
      if (families.has(fact.family)) {
        ctx.addIssue({
          code: 'custom',
          message: `two facts come from the '${fact.family}' family; the strip is one per family`,
        })
      }
      families.add(fact.family)
      // Without an indicator and a year the link lands on the site's defaults, which is a
      // silent failure: the visitor sees a page that does not show the fact they clicked.
      if (!fact.href.includes('i=') || !fact.href.includes('y=')) {
        ctx.addIssue({
          code: 'custom',
          message: `${fact.id}: href '${fact.href}' names no indicator and year, so it lands on the defaults`,
        })
      }
      if (fact.text.sv.length === 0 || fact.text.en.length === 0) {
        ctx.addIssue({ code: 'custom', message: `${fact.id}: missing one of the two languages` })
      }
    }
  })
export type Facts = z.infer<typeof Facts>

export const Manifest = z.object({
  schemaVersion: z.literal(1),
  license: z.literal('CC0-1.0'),
  sources: z.array(
    z.object({
      table: z.string(),
      lang: z.enum(['sv', 'en']),
      url: z.string().url(),
      /**
       * Basename (minus extension) of the frozen raw file under kitchen/raw/ that holds this
       * exact POST selection — see `selectionKey` in kitchen/src/scb/freeze.ts. The endpoint
       * `url` alone is identical for every chunk of a table; this is what links a manifest
       * entry to the specific committed file its selection came from.
       */
      selectionKey: z.string(),
      /**
       * The ContentsCode this selection actually resolved to at fetch time (see
       * `resolveContentCode` in kitchen/src/indicators/registry.ts), not a literal
       * hardcoded in the indicator definition — so this tracks a codelist change the way the
       * fetch itself does.
       */
      contentCode: z.string(),
      /** Copied from the frozen raw file; set once at freeze time, never at publish time. */
      fetchedAt: z.string().datetime(),
      sha256: z.string().length(64),
      cells: z.number().int().nonnegative(),
    }),
  ),
  /**
   * Task 13 (docs/plans/2026-09-14-02-the-ten-indicators.md): which of the flat `sources`
   * chunks above actually back EACH published indicator, keyed by indicator id. Added
   * additively — `sources` itself is unchanged in shape, this is a second, independent view
   * over the same provenance data, cross-referenced by table + resolved content code against
   * each indicator's own declared `Indicator.sources` (table/contentCode pairs, set by that
   * indicator's own module). Every registered indicator gets an entry, even one with no
   * declared sources at all (population-change, which fetches nothing) — an empty array,
   * never an omitted key, so a reader can tell "fetches nothing" apart from "not recorded".
   * A single declared (table, contentCode) pair can resolve to more than one row here when
   * SCB's 150,000-cell limit forced the fetch to chunk into several physical requests.
   */
  indicatorSources: z.record(
    IndicatorId,
    z.array(
      z.object({
        table: z.string(),
        contentCode: z.string(),
        selectionKey: z.string(),
      }),
    ),
  ),
  /**
   * The SCB municipality/county boundary shapefile that every geometry-derived pantry file
   * (topology, adjacency, bubbles) is built from. It is not an SCB PxWeb table chunk — there
   * is no `selection` POST body, just a plain zip download — so it is recorded separately
   * from `sources` rather than forced into that shape.
   */
  geometry: z.object({
    url: z.string().url(),
    filename: z.string(),
    /** The version date SCB publishes in the filename/page, as YYYY-MM-DD. */
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  }),
})
export type Manifest = z.infer<typeof Manifest>
