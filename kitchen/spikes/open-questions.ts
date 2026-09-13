/**
 * Answers two questions from docs/DESIGN.md section 9 with real SCB data:
 *  A. Do pre-split municipalities (Knivsta 0330, created 2003) return empty cells or
 *     parent-inclusive values before the split? And does the parent (Uppsala 0380) jump?
 *  B. From 2025 (CKM noise), is an aggregated age-group cell perturbed once, or is it the
 *     sum of already-perturbed single-year cells?
 *
 * Run: yarn tsx kitchen/spikes/open-questions.ts
 *
 * NOTE ON VARIABLE/CODE NAMES: the brief that inspired this script guessed ContentsCode
 * value 'BE0101N1' for both tables and an age-total code 'tot' for both tables. Both guesses
 * were WRONG for TAB5557 (see the printed metadata below and docs/kitchen.md):
 *  - TAB638 (old): ContentsCode 'BE0101N1' = Folkmängd; Alder total code 'tot' EXISTS.
 *  - TAB5557 (new, CKM): ContentsCode is '000007ME' = Folkmängd ('BE0101N1' does not exist in
 *    this table); Alder has NO 'tot' code. Instead it exposes four distinct total codes,
 *    'TOT1' / 'TOT5' / 'TOT10' / 'TotSA', all labelled "totalt, samtliga åldrar", alongside
 *    single-year ages, 5-year groups and 10-year groups. Kon gains a 'TotSa' total code and
 *    Civilstand gains 'SC' ("totalt, samtliga civilstånd") that TAB638 does not have.
 */
import { freezeData, freezeMetadata } from '../src/scb/freeze'
import { toRows } from '../src/scb/jsonstat'

const OLD = 'TAB638' // Folkmängden efter region, civilstånd, ålder och kön 1968–2024
const NEW = 'TAB5557' // same, 2025– with Cell Key Method noise

function find(meta: Awaited<ReturnType<typeof freezeMetadata>>, code: string) {
  const dims = meta.response as {
    id: string[]
    dimension: Record<string, { category: { index: Record<string, number> | string[] } }>
  }
  const idx = dims.dimension[code]?.category.index
  if (!idx) throw new Error(`no variable ${code}; variables are ${dims.id.join(', ')}`)
  return Array.isArray(idx) ? idx : Object.keys(idx)
}

const oldMeta = await freezeMetadata(OLD, 'sv')
const newMeta = await freezeMetadata(NEW, 'sv')
console.log('TAB638 variables:', (oldMeta.response as { id: string[] }).id)
console.log('TAB5557 variables:', (newMeta.response as { id: string[] }).id)

const ages = find(oldMeta, 'Alder')
const sexes = find(oldMeta, 'Kon')
const civil = find(oldMeta, 'Civilstand')
const hasAgeTotal = ages.includes('tot')
console.log(`TAB638 Alder has ${ages.length} values; 'tot' present: ${hasAgeTotal}`)
console.log(`TAB638 Kon values: ${sexes.join(',')}; Civilstand values: ${civil.join(',')}`)

const newAges = find(newMeta, 'Alder')
const newSexes = find(newMeta, 'Kon')
const newCivil = find(newMeta, 'Civilstand')
const newContents = find(newMeta, 'ContentsCode')
console.log(`TAB5557 Alder has ${newAges.length} values; 'tot' present: ${newAges.includes('tot')}`)
console.log(`TAB5557 Alder values: ${newAges.join(',')}`)
console.log(`TAB5557 Kon values: ${newSexes.join(',')}; Civilstand values: ${newCivil.join(',')}`)
console.log(`TAB5557 ContentsCode values: ${newContents.join(',')}`)

// ---------------------------------------------------------------------------
// A. Knivsta and Uppsala 1998–2005, total population (sum over age, sex, civil status).
// ---------------------------------------------------------------------------
const selA = {
  Region: ['0330', '0380'],
  Alder: hasAgeTotal ? ['tot'] : ages,
  Kon: sexes,
  Civilstand: civil,
  ContentsCode: ['BE0101N1'],
  Tid: ['1998', '1999', '2000', '2001', '2002', '2003', '2004', '2005'],
}
console.log('A: selection cell count:', {
  Region: selA.Region.length,
  Alder: selA.Alder.length,
  Kon: selA.Kon.length,
  Civilstand: selA.Civilstand.length,
  ContentsCode: selA.ContentsCode.length,
  Tid: selA.Tid.length,
  total:
    selA.Region.length *
    selA.Alder.length *
    selA.Kon.length *
    selA.Civilstand.length *
    selA.ContentsCode.length *
    selA.Tid.length,
})
const frozenA = await freezeData(OLD, selA, 'sv')
const totals = new Map<string, number | null>()
for (const f of frozenA) {
  for (const r of toRows(f.response)) {
    const k = `${r.dims.Region} ${r.dims.Tid}`
    const prev = totals.get(k)
    totals.set(k, r.value === null ? (prev ?? null) : (prev ?? 0) + r.value)
  }
}
for (const [k, v] of [...totals.entries()].sort()) console.log('A:', k, v)
console.log(
  'A: Knivsta (0330) shows numeric 0 (not null) for 1998–2001, then a real population from 2002 onward — one year BEFORE its formal 2003-01-01 creation.',
)
console.log(
  'A: TAB638\'s own dataset note explains why: "Folkmängd år 1983 och framåt redovisas enligt regional indelning den 1 januari efterföljande år" — the year-Y figure uses administrative boundaries as of 1 Jan (Y+1), so the 2002 figure already reflects Knivsta\'s 2003-01-01 boundary.',
)
console.log(
  'A: Uppsala (0380) drops between 2001 and 2002 (191110 → 179673, -11437), matching Knivsta appearing with 12586 in 2002 — confirming the parent needs its flagged break at 2002, not 2003.',
)

// ---------------------------------------------------------------------------
// B. Stockholm 2025: does TAB5557 expose independently-perturbed totals at different
// age-aggregation resolutions, or is every total just the sum of finer cells?
// TAB5557's Alder codelist has no single 'tot' code. It has FOUR distinct "all ages" codes —
// TOT1, TOT5, TOT10, TotSA — all labelled "totalt, samtliga åldrar" — plus single-year ages,
// 5-year groups and 10-year groups. Fetch the whole Alder codelist in one call (137 cells) and
// compare the four total codes against manually-summed single-year/5-year/10-year cells.
// ---------------------------------------------------------------------------
const CONTENT_CODE = '000007ME' // Folkmängd, per printed TAB5557 ContentsCode labels
const selB = {
  Region: ['0180'], // Stockholm
  Alder: newAges,
  Kon: ['TotSa'],
  Civilstand: ['SC'],
  ContentsCode: [CONTENT_CODE],
  Tid: ['2025'],
}
console.log('B: selection cell count:', {
  Region: selB.Region.length,
  Alder: selB.Alder.length,
  Kon: selB.Kon.length,
  Civilstand: selB.Civilstand.length,
  ContentsCode: selB.ContentsCode.length,
  Tid: selB.Tid.length,
  total: selB.Region.length * selB.Alder.length * 1 * 1 * 1 * 1,
})
const frozenB = await freezeData(NEW, selB, 'sv')
const byAge = new Map<string, number | null>()
for (const f of frozenB) {
  for (const r of toRows(f.response)) {
    const ageCode = r.dims.Alder
    if (ageCode === undefined) throw new Error('row missing Alder dimension')
    byAge.set(ageCode, r.value)
  }
}

const singleYearCodes = [...Array(100).keys()].map(String).concat(['100+1'])
const fiveYearCodes = [
  '-4',
  '5-9',
  '10-14',
  '15-19',
  '20-24',
  '25-29',
  '30-34',
  '35-39',
  '40-44',
  '45-49',
  '50-54',
  '55-59',
  '60-64',
  '65-69',
  '70-74',
  '75-79',
  '80-84',
  '85-89',
  '90-94',
  '95-99',
  '100+5',
]
const tenYearCodes = [
  '-9',
  '10-19',
  '20-29',
  '30-39',
  '40-49',
  '50-59',
  '60-69',
  '70-79',
  '80-89',
  '90-99',
  '100+10',
]

function sumOf(codes: string[]): number {
  let s = 0
  for (const c of codes) {
    const v = byAge.get(c)
    if (v === undefined) throw new Error(`missing Alder code ${c} in TAB5557 response`)
    if (v === null) throw new Error(`Alder code ${c} was null for Stockholm 2025 — unexpected`)
    s += v
  }
  return s
}

const sumSingle = sumOf(singleYearCodes)
const sum5 = sumOf(fiveYearCodes)
const sum10 = sumOf(tenYearCodes)
const tot1 = byAge.get('TOT1')
const tot5 = byAge.get('TOT5')
const tot10 = byAge.get('TOT10')
const totSA = byAge.get('TotSA')

console.log('B: sum of', singleYearCodes.length, 'single-year cells =', sumSingle)
console.log('B: sum of', fiveYearCodes.length, '5-year-group cells =', sum5)
console.log('B: sum of', tenYearCodes.length, '10-year-group cells =', sum10)
console.log('B: TOT1 (published total, single-year resolution) =', tot1)
console.log('B: TOT5 (published total, 5-year resolution)      =', tot5)
console.log('B: TOT10 (published total, 10-year resolution)     =', tot10)
console.log('B: TotSA (published overall total)                 =', totSA)
console.log('B: sumSingle - TOT1 =', sumSingle - (tot1 ?? NaN))
console.log('B: sum5 - TOT5 =', sum5 - (tot5 ?? NaN))
console.log('B: sum10 - TOT10 =', sum10 - (tot10 ?? NaN))
console.log('B: TOT1 - TOT5 =', (tot1 ?? NaN) - (tot5 ?? NaN))
console.log('B: TOT1 - TOT10 =', (tot1 ?? NaN) - (tot10 ?? NaN))
console.log('B: TOT1 - TotSA =', (tot1 ?? NaN) - (totSA ?? NaN))
console.log(
  'B: If sumSingle differs from TOT1 (or TOT1/TOT5/TOT10/TotSA differ from each other), each aggregation level carries its own independent CKM perturbation — derived age indicators must be computed from the coarsest total SCB serves (e.g. request TOT5 or a specific 5-year-group code directly) rather than summing single-year cells.',
)

// B (continued). Same check one level down: does a single published 5-year age-GROUP cell
// (not just the grand total) equal the sum of its five single-year cells?
const need = (code: string): number => {
  const v = byAge.get(code)
  if (v === null || v === undefined) throw new Error(`missing/null Alder code ${code}`)
  return v
}
const sumAges2024 = ['20', '21', '22', '23', '24'].reduce((s, c) => s + need(c), 0)
console.log(
  'B: sum of single ages 20+21+22+23+24 =',
  sumAges2024,
  "vs published '20-24' group cell =",
  need('20-24'),
  '(diff',
  sumAges2024 - need('20-24'),
  ')',
)
const sumAges1019 = ['10', '11', '12', '13', '14', '15', '16', '17', '18', '19'].reduce(
  (s, c) => s + need(c),
  0,
)
console.log(
  'B: sum of single ages 10..19 =',
  sumAges1019,
  "vs published '10-19' group cell =",
  need('10-19'),
  "vs '10-14' + '15-19' =",
  need('10-14') + need('15-19'),
)
