import { config, z } from 'zod'

/**
 * In a browser, tell zod not to JIT-compile its validators.
 *
 * zod decides whether it may by running `new Function('')` and catching the failure. The
 * deployed site's Content Security Policy refuses that call, so zod was already falling back to
 * the interpreted parser — but it discovered this by triggering a real CSP violation on every
 * load, which Chrome logs to the Issues panel and Lighthouse counts against the site. zod's own
 * source names this exact case. Declaring it up front changes no behaviour and removes it.
 *
 * It has to be HERE, above the schemas, rather than in `src/main.tsx`: the flag is read when a
 * schema is CONSTRUCTED, which for this file is at import, and an ES module's imports are all
 * evaluated before any importing module's body runs.
 *
 * Guarded so the kitchen keeps the fast path. It parses far more than the site does, runs in
 * Node under no policy at all, and would pay for a restriction that does not apply to it.
 *
 * Read off `globalThis` rather than as a bare `document`, because this file is compiled by both
 * projects and the kitchen's tsconfig has no DOM library to name it in.
 */
const inBrowser = typeof (globalThis as { document?: unknown }).document !== 'undefined'
if (inBrowser) config({ jitless: true })

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
  /**
   * Appended by plan 21: the thing this indicator measures does not exist in this municipality
   * at all, so there is nothing to publish — as opposed to a figure that exists and has not
   * been published, which is `not-yet-published`.
   *
   * Holiday homes forced it. SCB counts only homes inside a holiday-home AREA, meaning a
   * cluster of at least fifty, and 106 of the 290 municipalities have no such area; telling
   * them "not published for this year" would promise a figure that is never coming. Any measure
   * whose universe excludes some municipalities by definition wants this rather than that.
   *
   * Appended at the end, per the rule above.
   */
  'nothing-to-count',
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
  'children-per-woman': 2,
  'tonnes-per-resident': 2,
  'persons-per-household': 2,
  metres: 0,
  hectares: 0,
  'percentage-points': 2,
}

/**
 * The indicator's fields, before any refinement.
 *
 * Plan 13 Task 1 split this out of `Indicator` so `IndicatorMeta` can be derived from it with
 * `.omit()` rather than restated. A restated copy is a copy that drifts: a field added to the
 * indicator and forgotten in the index would simply be missing from the published index, and
 * nothing would say so.
 */
const IndicatorFields = z.object({
  id: IndicatorId,
  name: Bilingual,
  description: Bilingual,
  unit: z.enum([
    'count',
    'percent',
    'years',
    'sek',
    'per-thousand',
    'per-km2',
    // Plan 16. Two measures whose denominator is part of the unit, following 'per-km2': a rate
    // of children per woman, and tonnes of CO2 equivalent per resident. Both were published as
    // 'count' in a first draft, which rounds to 0 decimals and would have turned 1.45 into 1.
    //
    // Unlike OBSERVATION_STATUS, this enum's ORDER means nothing — a unit is stored as its own
    // string in every indicator, never as an index — so appending to it relabels nothing.
    'children-per-woman',
    'tonnes-per-resident',
    // Plan 17, same reason as the two above: `count` rounds to nought decimals, and a household
    // of 2.17 people would publish as 2 — which is every municipality in Sweden.
    'persons-per-household',
    // Plan 17: mean distance to protected nature, which SCB rounds to even hundreds of metres.
    'metres',
    // Plan 19. Farmland is an area, and neither `count` ('residents') nor any per-something
    // unit describes it. Whole hectares: a decimal on 32,000 hectares would be noise.
    'hectares',
    // The editorial pass. A difference between two shares — women's against men's, a
    // municipality's against the country's, one election's turnout against another's — is in
    // percentage points, and every one of the three said so in its own description while the
    // unit said 'percent', so the site printed the 65+ gap as "−5,64 %", a relative change it is
    // not. Same two decimals as 'percent', so no published figure moves.
    'percentage-points',
  ]),
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
  /**
   * Neutral scale hint. There is deliberately no "higher is better" flag.
   *
   * `kind` is the whole of it. It picks the colour ramp, it decides whether a figure shows its
   * sign, and it is what tells the legend to mark the class zero falls in. Plan 20 removed a
   * `reference` field that sat beside it: `'zero'` was declared by seven indicators and read by
   * nobody, because the zero those scales want marked is derived from `kind` rather than from
   * the field, and `'national-median'` had no producer and no consumer. A median reference could
   * not get one either — the breaks below are fixed across every year and a national median is
   * not, so colouring against it would change a municipality's colour as the slider moved
   * without its value changing.
   */
  scale: z.object({
    kind: z.enum(['sequential', 'diverging']),
    /** Fixed class breaks across all years, computed in the kitchen. */
    breaks: z.array(z.number()),
  }),
  /**
   * The span this indicator publishes for, and — when it is not a dense run — exactly which
   * years it has.
   *
   * `years` exists because the index must be able to answer "does this indicator have 1974?"
   * BEFORE the series is fetched. Plan 13's rule is that the year axis cannot depend on which
   * series happens to be loaded, and turnout has fifteen values across fifty years: without this,
   * the map draws 290 grey shapes for 1974 and explains nothing.
   *
   * Written only when the series is NOT the dense run from `from` to `to`, so a dense indicator
   * carries nothing new and the index barely grows. Additive and safe in the sense 0016 D6
   * describes: no index into this array is persisted in any published cell, unlike
   * `OBSERVATION_STATUS`.
   */
  coverage: z
    .object({
      from: z.number().int(),
      to: z.number().int(),
      years: z.array(z.number().int()).nonempty().optional(),
    })
    .superRefine((c, ctx) => {
      if (!c.years) return
      const first = c.years[0]
      const last = c.years[c.years.length - 1]
      if (first !== c.from || last !== c.to) {
        ctx.addIssue({
          code: 'custom',
          message: `coverage.years runs ${first}-${last} but coverage says ${c.from}-${c.to}; the two must agree at both ends`,
        })
      }
      for (let i = 1; i < c.years.length; i++) {
        if (c.years[i]! <= c.years[i - 1]!) {
          ctx.addIssue({
            code: 'custom',
            message: `coverage.years must ascend strictly: ${c.years[i - 1]} is followed by ${c.years[i]}`,
          })
        }
      }
      if (c.years.length === c.to - c.from + 1) {
        ctx.addIssue({
          code: 'custom',
          message: `coverage.years lists every year from ${c.from} to ${c.to}, so it says nothing the range does not; omit it`,
        })
      }
    }),
  caveat: Bilingual,
  /** For indicators built from events (house sales): below this count the cell is 'too-few-cases'. */
  minCount: z.number().int().positive().optional(),
  sensitivity: z.enum(['none', 'sensitive']),
  /**
   * Both languages, like every other piece of prose here, since issue #48. The note and the
   * derivation were single English strings, so the Swedish page showed English under a Swedish
   * heading. A note that has nothing to translate — "1968–2024" — says so in both slots.
   */
  sources: z.array(z.object({ table: z.string(), contentCode: z.string(), note: Bilingual })),
  /** Plain-language statement of how the value was computed from the sources. */
  derivation: Bilingual,
})
export type Indicator = z.infer<typeof Indicator>

/**
 * The price-basis rules, shared by `Indicator` and `IndicatorMeta` rather than restated, so the
 * published index can never enforce a weaker rule than the per-indicator file it summarises.
 *
 * `ctx` is typed structurally instead of by zod's own refinement-context type, because this file
 * is compiled by both the kitchen and the site and the name of that type is a zod-internal
 * detail; only `addIssue` is used.
 */
function checkPriceBasis(
  i: {
    id: string
    priceBasis: 'none' | 'fixed-latest-year'
    priceBasisYear?: number | undefined
    publishedStep?: number | undefined
  },
  ctx: { addIssue: (issue: { code: 'custom'; message: string }) => void },
): void {
  {
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
  }
}

export const Indicator = IndicatorFields.superRefine(checkPriceBasis)

/** Which of an indicator's fields are prose: written for a reader, read only by AboutIndicator. */
export const INDICATOR_PROSE = {
  description: true,
  caveat: true,
  derivation: true,
  sources: true,
} as const

/**
 * An indicator without its prose — what the published index carries for EVERY indicator, so the
 * picker, the legend, the URL parser and the formatter can work before a single series has been
 * fetched. Measured at 6,471 gzipped bytes for the whole index at ten indicators and 6,524 at
 * twenty-five: it barely grows, because the 290 municipalities dominate it.
 */
export const IndicatorMeta = IndicatorFields.omit(INDICATOR_PROSE).superRefine(checkPriceBasis)
export type IndicatorMeta = z.infer<typeof IndicatorMeta>

/**
 * Does this indicator have this year?
 *
 * The one definition of "covered", shared by both programs, because before plan 19 the same
 * range check was written out in three places in the site and each would have had to learn about
 * sparse series separately. A sparse indicator answers from its explicit list; a dense one from
 * its range, which for it says exactly the same thing.
 *
 * Typed structurally rather than as `IndicatorMeta`, so the kitchen can ask it of an indicator it
 * is still building and a test can ask it of a literal.
 */
export function coversYear(
  indicator: { coverage: { from: number; to: number; years?: readonly number[] | undefined } },
  year: number,
): boolean {
  const { from, to, years } = indicator.coverage
  return years ? years.includes(year) : year >= from && year <= to
}

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

/**
 * The checks that relate a pantry's parts to each other, shared by `PantryData` (every indicator,
 * with its prose) and `PantryView` (every indicator's metadata, and only the series fetched so
 * far). Both shapes must obey exactly the same rules; only one of them is ever complete.
 *
 * Note what is NOT required: that every indicator has a series. A view legitimately holds ten
 * indicators and one series, because the site fetches a series when the map needs it.
 */
/**
 * The bubble layout's codes against the municipality list, in both directions.
 *
 * This is the map-to-data join for the bubbles, the same join `assertCodesMatch` makes for the
 * shapes in the kitchen: a circle with no municipality is drawn with nobody's data, and a
 * municipality with no circle has nowhere to travel when the map morphs. Either is a build
 * failure in the kitchen and a load failure in the site, never a bubble quietly missing.
 */
function layoutCodeIssues(
  indicator: string,
  circles: readonly { code: string }[],
  municipalities: readonly { code: string }[],
): string[] {
  const inLayout = new Set(circles.map((c) => c.code))
  const known = new Set(municipalities.map((m) => m.code))
  const missing = municipalities.filter((m) => !inLayout.has(m.code)).map((m) => m.code)
  const stray = circles.filter((c) => !known.has(c.code)).map((c) => c.code)
  const list = (codes: string[]) => codes.slice(0, 5).join(', ') + (codes.length > 5 ? ', …' : '')
  const issues: string[] = []
  if (missing.length > 0) {
    issues.push(
      `${indicator}: the bubble layout has no circle for ${missing.length} municipalities (${list(missing)})`,
    )
  }
  if (stray.length > 0) {
    issues.push(`${indicator}: the bubble layout has circles for unknown codes (${list(stray)})`)
  }
  return issues
}

function checkPantryCrossReferences(
  p: {
    municipalities: readonly { code: string }[]
    indicators: readonly { id: string; priceBasisYear?: number | undefined }[]
    series: readonly { indicator: string; values: readonly unknown[] }[]
    priceIndex: { values: Record<string, number> }
    layouts?: readonly { indicator: string; circles: readonly { code: string }[] }[] | undefined
  },
  ctx: { addIssue: (issue: { code: 'custom'; message: string }) => void },
): void {
  for (const layout of p.layouts ?? []) {
    if (!p.indicators.some((i) => i.id === layout.indicator)) {
      ctx.addIssue({
        code: 'custom',
        message: `bubble layout for ${layout.indicator} has no indicator`,
      })
    }
    for (const message of layoutCodeIssues(layout.indicator, layout.circles, p.municipalities)) {
      ctx.addIssue({ code: 'custom', message })
    }
  }
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
}

/**
 * One indicator's bubble layout, in the units `shared/bubbles.ts` describes.
 *
 * Published INSIDE that indicator's file since Plan 21 — one Dorling per indicator — because a
 * bubble sized by the measure needs positions solved for that measure's radii, and the population
 * layout that served every measure until then put them over each other wherever municipalities
 * are dense. `r` is the slot: the largest radius this municipality takes in any year, so the year
 * slider changes sizes and never positions. `minR` and `maxR` are the two numbers the site sizes
 * with, published rather than assumed, so a change to the shared constants cannot leave a layout
 * on disk that a bubble outgrows. `cone` is the arrow-key cone the kitchen proved reaches every
 * municipality on this layout; the right angle is a property of the arrangement, so it travels
 * with it. See docs/decisions/0024-bubbles-sized-by-the-measure.md.
 */
const BubbleLayoutFields = z.object({
  minR: z.number().positive(),
  maxR: z.number().positive(),
  cone: z.number().int().min(1).max(90),
  /** One per municipality; `PantryIndicator` and the cross-reference check hold it to that. */
  circles: z.array(
    z.object({ code: MunicipalityCode, x: z.number(), y: z.number(), r: z.number().positive() }),
  ),
})

/**
 * Slots are rounded up to two decimals and `maxR` down to four, so a slot may sit up to a
 * hundredth above `maxR`. Anything further is a layout the sizing rule did not produce.
 */
const SLOT_TOLERANCE = 0.0101

function checkBubbleLayout(
  layout: z.infer<typeof BubbleLayoutFields>,
  ctx: { addIssue: (issue: { code: 'custom'; message: string }) => void },
): void {
  if (layout.maxR < layout.minR) {
    ctx.addIssue({
      code: 'custom',
      message: `bubble layout: maxR ${layout.maxR} is below minR ${layout.minR}`,
    })
  }
  const seen = new Set<string>()
  for (const c of layout.circles) {
    if (seen.has(c.code)) {
      ctx.addIssue({ code: 'custom', message: `bubble layout: ${c.code} has two circles` })
    }
    seen.add(c.code)
    if (c.r < layout.minR - 1e-9 || c.r > layout.maxR + SLOT_TOLERANCE) {
      ctx.addIssue({
        code: 'custom',
        message: `bubble layout: ${c.code} has slot ${c.r}, outside ${layout.minR}–${layout.maxR}`,
      })
    }
  }
}

export const BubbleLayout = BubbleLayoutFields.superRefine(checkBubbleLayout)
export type BubbleLayout = z.infer<typeof BubbleLayout>

/** A layout with the indicator it belongs to, which is how `PantryData.layouts` carries them. */
export const IndicatorLayout = BubbleLayoutFields.extend({ indicator: IndicatorId }).superRefine(
  checkBubbleLayout,
)
export type IndicatorLayout = z.infer<typeof IndicatorLayout>

/**
 * The pantry's contract version. 2 since issue #48 turned `derivation` and `sources[].note` from
 * strings into `Bilingual`: a required field changed shape, which ADR-0021 bumped for and
 * ADR-0022 explains is not compatible in either direction — an old bundle cannot read an object
 * where it expects a string. Carried by the index, because the index is what versions the whole
 * split pantry; the per-indicator files are read against it.
 */
export const PANTRY_SCHEMA_VERSION = 2

export const PantryData = z
  .object({
    schemaVersion: z.literal(PANTRY_SCHEMA_VERSION),
    municipalities: z.array(Municipality),
    indicators: z.array(Indicator),
    series: z.array(IndicatorSeries),
    priceIndex: PriceIndex,
    /**
     * One bubble layout per indicator. Optional on this in-memory container, because the kitchen
     * builds and checks a pantry's NUMBERS before it lays anything out and the tools that read a
     * pantry back have no use for positions — but `splitPantry` refuses to publish without them,
     * and every published `PantryIndicator` carries its own.
     */
    layouts: z.array(IndicatorLayout).optional(),
  })
  .superRefine(checkPantryCrossReferences)
export type PantryData = z.infer<typeof PantryData>

/**
 * What `data/index.json` holds: everything the site needs before it has fetched a single series.
 *
 * Plan 13 split the pantry because one file was 275,842 gzipped bytes fetched before first paint,
 * for an opening view that draws one indicator. This is the part that is always fetched.
 */
export const PantryIndex = z
  .object({
    schemaVersion: z.literal(PANTRY_SCHEMA_VERSION),
    municipalities: z.array(Municipality),
    indicators: z.array(IndicatorMeta),
    priceIndex: PriceIndex,
  })
  .superRefine((idx, ctx) => {
    const seen = new Set<string>()
    for (const i of idx.indicators) {
      if (seen.has(i.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `${i.id}: duplicate indicator id — the id IS the file name, so two of them would publish one file and silently lose the other`,
        })
      }
      seen.add(i.id)
    }
  })
export type PantryIndex = z.infer<typeof PantryIndex>

/**
 * What `data/indicators/<id>.json` holds: one indicator in full, including the prose only
 * `AboutIndicator` reads, its series, and — since Plan 21 — its bubble layout.
 */
export const PantryIndicator = z
  .object({ indicator: Indicator, series: IndicatorSeries, layout: BubbleLayout })
  .superRefine((part, ctx) => {
    if (part.series.indicator !== part.indicator.id) {
      ctx.addIssue({
        code: 'custom',
        message: `${part.indicator.id}: this file carries the series for ${part.series.indicator}`,
      })
    }
    // The file does not know the municipality list, so this is the half of the join it CAN
    // check on its own; `viewOf` and `PantryData` check the codes themselves.
    if (part.layout.circles.length !== part.series.values.length) {
      ctx.addIssue({
        code: 'custom',
        message: `${part.indicator.id}: the bubble layout has ${part.layout.circles.length} circles for ${part.series.values.length} municipalities`,
      })
    }
  })
export type PantryIndicator = z.infer<typeof PantryIndicator>

/**
 * What the SITE renders from: every indicator's metadata, and only the series fetched so far.
 *
 * It is not a `PantryData` and cannot be one, because an indicator whose file has not been
 * fetched has no prose to put in it. It does not need to be: prose is read by `AboutIndicator`
 * alone, for the indicator on screen, which is by definition the one that has been fetched.
 *
 * A `PantryData` IS a valid `PantryView` — its indicators simply carry extra fields — so the
 * kitchen, the build-time tools and every test that holds a whole pantry need no second path.
 */
export const PantryView = z
  .object({
    schemaVersion: z.literal(PANTRY_SCHEMA_VERSION),
    municipalities: z.array(Municipality),
    indicators: z.array(IndicatorMeta),
    series: z.array(IndicatorSeries),
    priceIndex: PriceIndex,
  })
  .superRefine(checkPantryCrossReferences)
export type PantryView = z.infer<typeof PantryView>

/** Takes a whole pantry apart into the files the kitchen publishes. Inverse of `assemblePantry`. */
export function splitPantry(data: PantryData): {
  index: PantryIndex
  parts: PantryIndicator[]
} {
  const seriesById = new Map(data.series.map((s) => [s.indicator, s]))
  const layoutById = new Map((data.layouts ?? []).map((l) => [l.indicator, l]))
  const parts = data.indicators.map((indicator) => {
    const series = seriesById.get(indicator.id)
    if (!series) throw new Error(`splitPantry: no series for indicator "${indicator.id}"`)
    const l = layoutById.get(indicator.id)
    if (!l) {
      throw new Error(
        `splitPantry: no bubble layout for indicator "${indicator.id}" — a published file carries one`,
      )
    }
    const layout = { minR: l.minR, maxR: l.maxR, cone: l.cone, circles: l.circles }
    return PantryIndicator.parse({ indicator, series, layout })
  })
  const index = PantryIndex.parse({
    schemaVersion: data.schemaVersion,
    municipalities: data.municipalities,
    indicators: data.indicators,
    priceIndex: data.priceIndex,
  })
  return { index, parts }
}

/**
 * Puts the files back together into one pantry. Inverse of `splitPantry`, and the path the
 * build-time tools and the test fixtures take, all of which legitimately want everything.
 *
 * The INDEX decides the order, never the order the parts arrive in: `src/state/url.ts` opens on
 * the first indicator, so a pantry reassembled in a different order would open on a different map.
 */
export function assemblePantry(index: PantryIndex, parts: readonly PantryIndicator[]): PantryData {
  const byId = new Map(parts.map((part) => [part.indicator.id, part]))
  for (const part of parts) {
    if (!index.indicators.some((i) => i.id === part.indicator.id)) {
      throw new Error(`assemblePantry: "${part.indicator.id}" is not listed in the index`)
    }
  }
  const ordered = index.indicators.map((meta) => {
    const part = byId.get(meta.id)
    if (!part) throw new Error(`assemblePantry: no file for indicator "${meta.id}"`)
    return part
  })
  return PantryData.parse({
    schemaVersion: index.schemaVersion,
    municipalities: index.municipalities,
    indicators: ordered.map((part) => part.indicator),
    series: ordered.map((part) => part.series),
    priceIndex: index.priceIndex,
    layouts: ordered.map((part) => ({ indicator: part.indicator.id, ...part.layout })),
  })
}

/**
 * Builds what the site renders from the index plus however many series have arrived. Series are
 * ordered by the index, for the same reason `assemblePantry` orders indicators by it.
 *
 * **This does not re-validate what it was handed, and that is the point.** `index` came out of
 * `PantryIndex.parse` and every `part` out of `PantryIndicator.parse`, both at the fetch boundary
 * where the bytes were still untrusted. Running `PantryView.parse` here would walk all 290 rows
 * of every series AGAIN, once per arrival — and a profile open fetches all thirty-five, so the
 * work is quadratic in the indicator count. Measured at 1,023 ms per profile open with zod's JIT
 * off, which is the path the browser takes; ADR-0013 predicted it at ten indicators and deferred
 * it, and ADR-0019 is where it was finally paid.
 *
 * What `parse` did that the inputs' own parses do not is `checkPantryCrossReferences`, which
 * relates the parts to each other — so that still runs, on every call, in full. It is O(series),
 * not O(cells).
 *
 * The assembled object SHARES `municipalities`, `indicators` and `priceIndex` with the index
 * rather than copying them, where `parse` returned fresh arrays. Nothing in this project mutates
 * published data, and a per-arrival deep copy of 290 municipalities was part of what this
 * function was costing.
 *
 * One behaviour genuinely does go: `parse` also STRIPPED unknown keys, so handing this a whole
 * `PantryData` used to drop each indicator's prose and now does not. Nothing reads prose off a
 * view — `AboutIndicator` reads it from `LoadedPantry.parts` — and every caller today passes
 * parser output, so this is a note rather than a hazard. It is written down because the type
 * system permits the call: `PantryData` is structurally a `PantryIndex`.
 */
export function viewOf(index: PantryIndex, loaded: readonly PantryIndicator[]): PantryView {
  const messages: string[] = []
  for (const part of loaded) {
    if (!index.indicators.some((i) => i.id === part.indicator.id)) {
      throw new Error(`viewOf: "${part.indicator.id}" is not listed in the index`)
    }
    // The view carries no layouts, so the join the cross-reference check makes for a whole
    // pantry is made here, part by part, against the index's own municipality list.
    messages.push(...layoutCodeIssues(part.indicator.id, part.layout.circles, index.municipalities))
  }
  const order = new Map(index.indicators.map((i, n) => [i.id, n]))
  const series = [...loaded]
    .sort((a, b) => (order.get(a.indicator.id) ?? 0) - (order.get(b.indicator.id) ?? 0))
    .map((part) => part.series)
  const view: PantryView = {
    schemaVersion: index.schemaVersion,
    municipalities: index.municipalities,
    indicators: index.indicators,
    series,
    priceIndex: index.priceIndex,
  }
  // `checkPantryCrossReferences` outside a zod parse: collect its issues and throw them
  // together. ALL of them, not the first — zod reported every issue in one error, and a caller
  // reading the message should not lose that because the check moved house.
  checkPantryCrossReferences(view, { addIssue: (issue) => messages.push(issue.message) })
  if (messages.length > 0) throw new Error(`viewOf: ${messages.join('; ')}`)
  return view
}

/** Keyboard neighbours. `synthetic` lists edges added so islands are reachable. */
export const Adjacency = z.object({
  schemaVersion: z.literal(1),
  neighbours: z.record(MunicipalityCode, z.array(MunicipalityCode)),
  synthetic: z.array(z.tuple([MunicipalityCode, MunicipalityCode])),
})
export type Adjacency = z.infer<typeof Adjacency>

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
  /**
   * 2 since plan 17, which turned `sources[].contentCode` into `contentCodes`: one chunk can
   * now resolve several content codes, because `out-commuter-share` fetches its numerator and
   * its denominator together. The field exists to signal exactly this kind of shape change, so
   * it is bumped rather than the array being smuggled in under the old singular name.
   */
  schemaVersion: z.literal(2),
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
       * The ContentsCodes this selection actually resolved to at fetch time (see
       * `resolveContentCode` in kitchen/src/indicators/registry.ts), not literals hardcoded in
       * the indicator definition — so this tracks a codelist change the way the fetch does.
       *
       * Several, since plan 17: one chunk can carry a numerator and a denominator that are two
       * content codes of the same table.
       */
      contentCodes: z.array(z.string()).nonempty(),
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
