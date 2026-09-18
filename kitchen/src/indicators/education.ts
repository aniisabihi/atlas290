import {
  Indicator,
  type IndicatorSeries,
  type Municipality,
  statusCode,
} from '../../../shared/pantry'
import { existed } from '../municipalities'
import { buildDefined, type Definition } from './define'
import { type Selection, type TableMeta } from '../scb/client'
import { type FreezeOpts, type FrozenData, type FrozenMeta } from '../scb/freeze'
import { toRows } from '../scb/jsonstat'
import {
  buildRows,
  resolveContentCode,
  totalOrDeclaredSum,
  values,
  type BuildContext,
  type IndicatorDefinition,
} from './registry'

export const EDUCATION_TABLE = 'TAB3981'

/**
 * Education's own year range: 1985-2025, per the plan's verified-facts table and TAB3981's own
 * frozen metadata (kitchen/raw/TAB3981/sv/metadata.json: `Tid` runs 1985..2025, 41 values).
 * Distinct from population's 1968-2025 (`ctx.years`) — defined locally, exactly as every other
 * indicator (tax, density, migration, income, housing) defines its own.
 */
export const EDUCATION_YEARS = Array.from({ length: 2025 - 1985 + 1 }, (_, i) => 1985 + i)

/**
 * Swedish label SCB uses for TAB3981's single content code. Resolved by label rather than
 * hardcoded `UF0506A1`, per docs/decisions/0001-plan-1-build-decisions.md's trap 2 — the same
 * convention every indicator in this project uses, even though this table happens to carry
 * only the one ContentsCode.
 */
const EDUCATION_CONTENT_LABEL = 'Antal'

/**
 * The exact Swedish label TAB3981 gives every one of its eight `UtbildningsNiva` codes,
 * confirmed against the table's own live frozen metadata (kitchen/raw/TAB3981/sv/metadata.json)
 * on 2026-09-14 — NOT trusted from this task's own brief, which was checked and found correct
 * (the dimension name itself is `UtbildningsNiva`, not "Nivå", also confirmed against the same
 * metadata). Levels 5, 6 and 7 (the "eftergymnasial"/"forskarutbildning" — post-secondary and
 * postgraduate — codes) are POST_SECONDARY_LEVELS below, this indicator's numerator; `US`
 * ("uppgift om utbildningsnivå saknas" — education level not recorded) is included in the
 * denominator (see EDUCATION's own `derivation` field for the reasoning). `validateLevels`
 * checks every one of these labels against the table's live metadata at selection time, so a
 * future SCB codelist change that reassigns what a code means throws here rather than silently
 * mis-defining the share.
 */
const EXPECTED_LEVEL_LABELS: Record<string, string> = {
  '1': 'förgymnasial utbildning kortare än 9 år',
  '2': 'förgymnasial utbildning, 9 (10) år',
  '3': 'gymnasial utbildning, högst 2 år',
  '4': 'gymnasial utbildning, 3 år',
  '5': 'eftergymnasial utbildning, mindre än 3 år',
  '6': 'eftergymnasial utbildning, 3 år eller mer',
  '7': 'forskarutbildning',
  US: 'uppgift om utbildningsnivå saknas',
}

/** Every UtbildningsNiva code this indicator expects to exist, in no particular order. */
const ALL_LEVELS = Object.keys(EXPECTED_LEVEL_LABELS)

/**
 * Post-secondary is levels 5 ("eftergymnasial ... mindre än 3 år"), 6 ("eftergymnasial ... 3 år
 * eller mer") and 7 ("forskarutbildning", postgraduate research) — the numerator of this
 * indicator's share, per the task brief's explicit definition. This is a deliberate human
 * choice of which levels count as "post-secondary", not something resolvable purely from a
 * table label the way a ContentsCode or Fastighetstyp is elsewhere in this project; the label
 * check in `validateLevels` is what guards it against silent code-meaning drift instead.
 */
const POST_SECONDARY_LEVELS = ['5', '6', '7']

function variable(meta: TableMeta, code: string) {
  const v = meta.variables.find((x) => x.code === code)
  if (!v) {
    throw new Error(
      `${meta.id}: no variable ${code}; have ${meta.variables.map((x) => x.code).join(', ')}`,
    )
  }
  return v
}

/**
 * Confirms TAB3981's `UtbildningsNiva` dimension still carries exactly the eight codes this
 * indicator assumes, each still labelled the way `EXPECTED_LEVEL_LABELS` records — never
 * trusting that codes `1`-`7`/`US` still mean what they meant when this module was written.
 * Throws naming the dimension and the specific mismatch (missing code, extra code, or a
 * code whose label changed) rather than silently computing a share against a redefined level.
 */
function validateLevels(meta: TableMeta): void {
  const v = variable(meta, 'UtbildningsNiva')
  const byCode = new Map(v.values.map((x) => [x.code, x.label]))
  const missing = ALL_LEVELS.filter((c) => !byCode.has(c))
  const extra = [...byCode.keys()].filter((c) => !ALL_LEVELS.includes(c))
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `${meta.id}: UtbildningsNiva does not carry the expected eight levels — ` +
        `missing: ${missing.join(', ') || 'none'}; unexpected: ${extra.join(', ') || 'none'}`,
    )
  }
  for (const [code, expectedLabel] of Object.entries(EXPECTED_LEVEL_LABELS)) {
    const actual = byCode.get(code)
    if (actual !== expectedLabel) {
      throw new Error(
        `${meta.id}: UtbildningsNiva '${code}' is labelled '${actual}', expected ` +
          `'${expectedLabel}' — this indicator's post-secondary/unknown definition depends on ` +
          'what each code means; refusing to silently compute a share against a redefined level',
      )
    }
  }
}

export const EDUCATION: Indicator = Indicator.parse({
  id: 'post-secondary-education',
  name: { sv: 'Eftergymnasial utbildning', en: 'Post-secondary education' },
  description: {
    sv:
      'Andel av befolkningen 16–74 år med eftergymnasial utbildning (utbildningsnivå 5, 6 eller ' +
      '7: eftergymnasial kortare än 3 år, eftergymnasial 3 år eller mer, eller forskarutbildning). ' +
      'Nämnaren är HELA befolkningen 16–74 år, inklusive de vars utbildningsnivå är okänd (US) — ' +
      'inte enbart de med registrerad utbildning.',
    en:
      'Share of the population aged 16–74 with post-secondary education (education level 5, 6 ' +
      'or 7: post-secondary under 3 years, post-secondary 3 years or more, or postgraduate ' +
      'research). The denominator is the WHOLE population aged 16–74, including those whose ' +
      'education level is unknown (US) — not only those with a recorded education.',
  },
  unit: 'percent',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: EDUCATION_YEARS[0]!, to: EDUCATION_YEARS[EDUCATION_YEARS.length - 1]! },
  caveat: {
    sv:
      'TAB3981 publicerar antal, inte en andel — andelen beräknas här. Täljaren är summan av ' +
      'utbildningsnivå 5, 6 och 7 (eftergymnasial utbildning kortare än 3 år, eftergymnasial ' +
      'utbildning 3 år eller mer, samt forskarutbildning). Nämnaren är summan av SAMTLIGA åtta ' +
      'nivåer, inklusive "uppgift om utbildningsnivå saknas" (US) — andelen avser alltså hela ' +
      'befolkningen 16–74 år, inte enbart dem med registrerad utbildningsnivå. Den som jämför ' +
      'denna siffra med SCB:s egen publicerade andel bör känna till denna definition, eftersom ' +
      'SCB ibland redovisar andelen med okänd nivå exkluderad ur nämnaren. Båda könen summeras, ' +
      'eftersom Kon på denna tabell saknar en totalkod (endast "1" och "2" finns) — säkert ' +
      'eftersom TAB3981 inte har någon CKM-störningsnot, så summeringen är exakt aritmetik, inte ' +
      'en approximation över störda celler. SCB noterar även två tidsseriebrott: registrets ' +
      'kvalitet höjdes väsentligt 1990 (siffror för 1985–1989 bör om möjligt undvikas eller ' +
      'tolkas med stor försiktighet) och klassificeringssystemet byttes 2000 (från SUN till det ' +
      'ISCED-anpassade SUN2000), vilket höjde den redovisade utbildningsnivån i riket och gör ' +
      'jämförelser bakåt före 2000 mindre tillförlitliga.',
    en:
      'TAB3981 publishes counts, not a share — the share is derived here. The numerator is the ' +
      'sum of education levels 5, 6 and 7 (post-secondary education under 3 years, ' +
      'post-secondary education 3 years or more, and postgraduate research). The denominator is ' +
      'the sum of ALL EIGHT levels, including "education level not recorded" (US) — the share ' +
      'is therefore of the whole population aged 16–74, not only those with a recorded ' +
      "education level. Anyone comparing this figure to SCB's own published share should know " +
      'this convention, since SCB sometimes reports the share with unknown excluded from the ' +
      "denominator instead. Both sexes are summed, because this table's Kon dimension has no " +
      'total code (only "1" and "2" exist) — safe because TAB3981 carries no CKM perturbation ' +
      'note, so the summation is exact arithmetic, not an approximation over perturbed cells. ' +
      'SCB also notes two time-series breaks: register quality rose substantially in 1990 ' +
      '(figures for 1985–1989 should be avoided where possible, or read with real caution) and ' +
      'the classification system changed in 2000 (from SUN to the ISCED-aligned SUN2000), which ' +
      'raised the reported national education level and makes comparisons back before 2000 less ' +
      'reliable.',
  },
  sensitivity: 'none',
  sources: [
    {
      table: EDUCATION_TABLE,
      contentCode: 'UF0506A1',
      note: '1985–2025, tot16-74, both sexes summed, all eight UtbildningsNiva levels',
    },
  ],
  derivation:
    'Eight SCB cells per municipality and year (one per UtbildningsNiva level 1-7 and "US"), ' +
    'each summed over both sexes (Kon has no total code on this table — TOTAL_CODES does not ' +
    'recognise one, and TAB3981.Kon is declared safe to sum in SUM_SAFE, because this table ' +
    "carries no CKM perturbation note, so the two sexes' counts are exact, unperturbed and " +
    'disjoint) at the "tot16-74" age total. The share is (levels 5+6+7) divided by the sum of ' +
    'all eight levels, times 100 — a deliberate choice: the denominator is the whole 16-74 ' +
    'population, including the "unknown" level, not only those with a recorded education. Any ' +
    'single missing level nulls the whole cell rather than publishing a share built on a ' +
    'partial sum.',
})

/**
 * TAB3981's selection: only the region codes that are BOTH offered by this table AND known
 * current municipality codes (never a blind four-digit regex — the plan's trap 1). Checked
 * specifically for TAB3981 while building this indicator (its own frozen metadata,
 * 2026-09-14): of 312 Region entries, exactly 290 are four-digit, and all 290 are exactly the
 * known 290 municipality codes (diffed directly against TAB638's own Region list) — no phantom
 * four-digit codes like TAB1212/TAB6640's Stor-Stockholm/Göteborg/Malmö. The known-code join is
 * still used here rather than a bare `/^\d{4}$/` regex, both as the project's default
 * convention and as a safety margin should SCB ever add such a code to this table later.
 *
 * `validateLevels` runs first so a codelist drift on `UtbildningsNiva` fails loudly before any
 * selection is built, rather than silently fetching under a redefined level.
 */
export function educationSelection(
  meta: TableMeta,
  municipalityCodes: string[],
  years: string[],
): Selection {
  validateLevels(meta)
  const known = new Set(municipalityCodes)
  return {
    Region: values(meta, 'Region').filter((c) => known.has(c)),
    Alder: totalOrDeclaredSum(meta, 'Alder'),
    UtbildningsNiva: values(meta, 'UtbildningsNiva'),
    Kon: totalOrDeclaredSum(meta, 'Kon'),
    ContentsCode: [resolveContentCode(meta, EDUCATION_CONTENT_LABEL)],
    Tid: years,
  }
}

/**
 * Sums SCB cell values per municipality+year+level, collapsing however many Kon rows a chunk
 * carries per key (two: TAB3981's `1` and `2`, since it has no sex total — the same
 * sum-and-null-propagation rule as migration.ts's own sumByRegionYear, not imported: that
 * function is private to migration.ts). A key whose constituent Kon rows are a MIX of null and
 * real values becomes null — never a partial sum presented as the whole.
 */
function sumByRegionYearLevel(chunks: FrozenData[]): Map<string, number | null> {
  const acc = new Map<string, { sum: number; sawNull: boolean }>()
  for (const chunk of chunks) {
    for (const r of toRows(chunk.response)) {
      const key = `${r.dims.Region}|${r.dims.Tid}|${r.dims.UtbildningsNiva}`
      const entry = acc.get(key) ?? { sum: 0, sawNull: false }
      if (r.value === null) {
        entry.sawNull = true
      } else {
        entry.sum += r.value
      }
      acc.set(key, entry)
    }
  }
  const totals = new Map<string, number | null>()
  for (const [key, entry] of acc) {
    totals.set(key, entry.sawNull ? null : entry.sum)
  }
  return totals
}

/**
 * Builds the columnar post-secondary-education-share series. Education is a SNAPSHOT of who
 * lives in a municipality (like population, tax rate, density and median income), not a FLOW
 * measured across a calendar year (like net migration and house sales), so it uses the plain
 * `existed(m.code, y)` gate — verified against the real frozen data for all six municipality
 * splits (see education.ts's own module-level fetch report / docs/kitchen.md's education
 * section for the real per-split figures), not merely assumed by analogy with the other
 * snapshot indicators.
 *
 * Rule per cell: `existed` gates first, discarding whatever SCB sent (ruling R16); if any of
 * the eight levels' summed count is missing for that municipality+year, the whole cell is
 * 'not-yet-published' rather than a share computed from seven of eight levels; otherwise the
 * share is (levels 5+6+7) / (all eight levels, including US) * 100. A zero denominator (nobody
 * aged 16-74 recorded at all) is treated the same as a missing one, since a share genuinely
 * cannot be published without it. No 'perturbed' status is ever produced: TAB3981 carries no
 * Cell Key Method note.
 */
export function buildEducationSeries(
  municipalities: Municipality[],
  chunks: FrozenData[],
  years: number[],
): IndicatorSeries {
  const totals = sumByRegionYearLevel(chunks)
  const cells = buildRows(municipalities, years, (m, y) => {
    if (!existed(m.code, y)) {
      return { v: null as number | null, s: statusCode('did-not-exist') }
    }
    const perLevel = ALL_LEVELS.map((level) => totals.get(`${m.code}|${y}|${level}`) ?? null)
    if (perLevel.some((v) => v === null)) {
      return { v: null, s: statusCode('not-yet-published') }
    }
    const numbers = perLevel as number[]
    const denominator = numbers.reduce((a, b) => a + b, 0)
    if (denominator === 0) {
      return { v: null, s: statusCode('not-yet-published') }
    }
    const numerator = POST_SECONDARY_LEVELS.map(
      (level) => totals.get(`${m.code}|${y}|${level}`) as number,
    ).reduce((a, b) => a + b, 0)
    const share = (numerator / denominator) * 100
    return { v: share, s: statusCode('present') }
  })
  return {
    indicator: EDUCATION.id,
    years,
    values: cells.map((r) => r.map((c) => c.v)),
    status: cells.map((r) => r.map((c) => c.s)),
  }
}

export async function buildEducation(ctx: BuildContext): Promise<IndicatorSeries> {
  return buildDefined(educationDefined(), ctx)
}

/**
 * Share with post-secondary education, as a definition (Plan 14).
 *
 * One fetch of every education level, partitioned by `UtbildningsNiva`: levels 5, 6 and 7 over
 * all of them. Numerator and denominator cannot be two selections, because only the all-levels
 * one is frozen — and asking SCB twice for what one request already answered would be the
 * pipeline paying twice for the same number.
 */
export function educationDefined(): Definition {
  return {
    indicator: EDUCATION,
    sources: [
      {
        table: EDUCATION_TABLE,
        content: EDUCATION_CONTENT_LABEL,
        years: EDUCATION_YEARS,
        dims: { Alder: 'total', UtbildningsNiva: 'all', Kon: 'total' },
        regions: 'known',
      },
    ],
    spec: { kind: 'share', over: 'UtbildningsNiva', numerator: POST_SECONDARY_LEVELS, times: 100 },
    shareOver: ALL_LEVELS,
  }
}

export const educationDefinition: IndicatorDefinition = {
  indicator: EDUCATION,
  build: buildEducation,
}

/**
 * Standalone real-fetch entry point, mirroring population.ts's fetchPopulation, tax.ts's
 * fetchTax, density.ts's fetchDensity, income.ts's fetchIncome and housing.ts's fetchHousing —
 * used for the spot-check run, independent of the shared REGISTRY singleton. Requires
 * municipalities to already exist (population's own responsibility).
 */
export async function fetchEducation(
  municipalities: Municipality[],
  opts: FreezeOpts = {},
): Promise<{ series: IndicatorSeries; frozen: Array<FrozenData | FrozenMeta> }> {
  const ctx: BuildContext = {
    municipalities,
    years: EDUCATION_YEARS,
    freeze: opts,
    frozen: [],
    series: new Map(),
  }
  const series = await buildEducation(ctx)
  return { series, frozen: ctx.frozen }
}
