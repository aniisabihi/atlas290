import { Indicator, type IndicatorSeries } from '../../../shared/pantry'
import { buildDefined, type Definition } from './define'
import { type TableMeta } from '../scb/client'
import { type BuildContext, type IndicatorDefinition } from './registry'

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
        // `'all'` says take every level. It cannot say what a level MEANS, and levels 5, 6 and 7
        // are this indicator's numerator because of what they are — a human definition, not
        // something the table states. `validateLevels` is what keeps that honest.
        verify: validateLevels,
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
 * The same share as `post-secondary-education`, for one sex.
 *
 * The architect's data-shape decision for this slice was flat: each split is its own indicator
 * rather than a new axis on the data contract. These two are that decision applied, and they are
 * also what `post-secondary-education-gap` is derived from — a gap needs both sides published,
 * or the number on the page could not be checked against anything.
 *
 * `Kon` is an explicit value rather than a total, which is the only difference from the combined
 * indicator's own declaration.
 */
function educationForSex(indicator: Indicator, kon: string): Definition {
  return {
    indicator,
    sources: [
      {
        table: EDUCATION_TABLE,
        content: EDUCATION_CONTENT_LABEL,
        years: EDUCATION_YEARS,
        dims: { Alder: 'total', UtbildningsNiva: 'all', Kon: { values: [kon] } },
        regions: 'known',
        verify: validateLevels,
      },
    ],
    spec: { kind: 'share', over: 'UtbildningsNiva', numerator: POST_SECONDARY_LEVELS, times: 100 },
    shareOver: ALL_LEVELS,
  }
}

function educationSplit(id: string, sv: string, en: string, who: string, whoEn: string): Indicator {
  return Indicator.parse({
    id,
    name: { sv, en },
    description: {
      sv: `Andel av ${who} 16–74 år med eftergymnasial utbildning (utbildningsnivå 5, 6 eller 7). Nämnaren är alla ${who} 16–74 år, inklusive dem vars utbildningsnivå är okänd.`,
      en: `Share of ${whoEn} aged 16–74 with post-secondary education (levels 5, 6 or 7). The denominator is all ${whoEn} aged 16–74, including those whose level is unknown.`,
    },
    unit: 'percent',
    priceBasis: 'none',
    scale: { kind: 'sequential', breaks: [] },
    coverage: { from: EDUCATION_YEARS[0]!, to: EDUCATION_YEARS[EDUCATION_YEARS.length - 1]! },
    caveat: {
      sv: `Samma definition och samma nämnarval som den sammanslagna indikatorn: nivå 5, 6 och 7 av samtliga åtta nivåer, inklusive "uppgift saknas". Skillnaden är att endast ${who} räknas, i både täljare och nämnare. SCB:s två tidsseriebrott gäller även här: registrets kvalitet höjdes 1990 och klassificeringen byttes 2000.`,
      en: `The same definition and the same denominator choice as the combined indicator: levels 5, 6 and 7 out of all eight, "not recorded" included. The difference is that only ${whoEn} are counted, in both the numerator and the denominator. SCB's two series breaks apply here too: register quality rose in 1990 and the classification changed in 2000.`,
    },
    sensitivity: 'none',
    sources: [{ table: EDUCATION_TABLE, contentCode: 'UF0506A1', note: '1985–2025' }],
    derivation:
      'Levels 5, 6 and 7 over all eight levels, times 100, from one fetch of TAB3981 at a ' +
      'single Kon value. Identical to post-secondary-education except that the sex dimension ' +
      'is selected rather than totalled.',
  })
}

export const EDUCATION_WOMEN = educationSplit(
  'post-secondary-education-women',
  'Eftergymnasial utbildning, kvinnor',
  'Post-secondary education, women',
  'kvinnor',
  'women',
)

export const EDUCATION_MEN = educationSplit(
  'post-secondary-education-men',
  'Eftergymnasial utbildning, män',
  'Post-secondary education, men',
  'män',
  'men',
)

export const EDUCATION_GAP: Indicator = Indicator.parse({
  id: 'post-secondary-education-gap',
  name: {
    sv: 'Utbildningsgap mellan kvinnor och män',
    en: 'Education gap between women and men',
  },
  description: {
    sv: 'Kvinnors andel med eftergymnasial utbildning minus mäns, i procentenheter. Positivt tal betyder att fler kvinnor än män har eftergymnasial utbildning.',
    en: 'Women’s share with post-secondary education minus men’s, in percentage points. A positive figure means more women than men have post-secondary education.',
  },
  unit: 'percentage-points',
  priceBasis: 'none',
  scale: { kind: 'diverging', breaks: [] },
  coverage: { from: EDUCATION_YEARS[0]!, to: EDUCATION_YEARS[EDUCATION_YEARS.length - 1]! },
  caveat: {
    sv: 'Procentenheter, inte procent: ett gap på 10 betyder att andelen kvinnor är tio enheter högre än andelen män, inte tio procent högre. Gapet säger ingenting om nivån — två kommuner med samma gap kan ha helt olika utbildningsnivå. Räknas ur de två publicerade delserierna, så varje tal här går att kontrollera mot dem.',
    en: 'Percentage points, not percent: a gap of 10 means women’s share is ten points above men’s, not ten percent higher. The gap says nothing about the level — two municipalities with the same gap can have entirely different education levels. Computed from the two published split series, so every figure here can be checked against them.',
  },
  sensitivity: 'none',
  sources: [{ table: EDUCATION_TABLE, contentCode: 'UF0506A1', note: '1985–2025' }],
  derivation:
    'post-secondary-education-women minus post-secondary-education-men, cell by cell, from this ' +
    'pantry’s own published series rather than from a third fetch. Where either side is absent ' +
    'the gap is absent: a difference between a known share and an unknown one is not the known ' +
    'one.',
})

export function educationWomenDefined(): Definition {
  return educationForSex(EDUCATION_WOMEN, '2')
}

export function educationMenDefined(): Definition {
  return educationForSex(EDUCATION_MEN, '1')
}

export function educationGapDefined(): Definition {
  return {
    indicator: EDUCATION_GAP,
    sources: [],
    spec: { kind: 'difference', of: EDUCATION_WOMEN.id, minus: EDUCATION_MEN.id },
  }
}

export const educationWomenDefinition: IndicatorDefinition = {
  indicator: EDUCATION_WOMEN,
  build: (ctx) => buildDefined(educationWomenDefined(), ctx),
}

export const educationMenDefinition: IndicatorDefinition = {
  indicator: EDUCATION_MEN,
  build: (ctx) => buildDefined(educationMenDefined(), ctx),
}

export const educationGapDefinition: IndicatorDefinition = {
  indicator: EDUCATION_GAP,
  build: (ctx) => buildDefined(educationGapDefined(), ctx),
}
