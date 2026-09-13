/**
 * Empirically verifies ruling R15's CREATED years for the six municipalities that were
 * split off between 1991 and 2002, against frozen TAB638 (population 1968–2024) data.
 *
 * For each child/parent pair this fetches total population (summed over Alder='tot',
 * both Kon values, all four Civilstand values, ContentsCode BE0101N1) for a narrow window
 * of years around the formal split date, and prints:
 *   - the last year the child reads literal 0
 *   - the first year the child reads a real (non-zero) number
 *   - the parent's year-over-year drop in that same year
 *
 * Ruling R15 claims the child's first real year is one year BEFORE the formal creation
 * date (SCB reports year Y using the administrative division as of 1 Jan of year Y+1).
 * This script does not assume that — it reads the actual frozen data and reports what
 * it finds, so kitchen/src/municipalities.ts's CREATED constant can be checked against it.
 *
 * Run: yarn tsx kitchen/spikes/verify-split-years.ts
 */
import { freezeData } from '../src/scb/freeze'
import { toRows } from '../src/scb/jsonstat'

const TABLE = 'TAB638'

type Split = {
  child: string
  childName: string
  parent: string
  parentName: string
  formalDate: string
  years: string[]
}

// Formal creation dates and parents, per "Ändringar i kommunindelningen efter 1974"
// (docs/research/reports/scb-pxweb.md section 7). Year windows are roughly three years
// either side of the formal creation year.
const SPLITS: Split[] = [
  {
    child: '0461',
    childName: 'Gnesta',
    parent: '0480',
    parentName: 'Nyköping',
    formalDate: '1992-01-01',
    years: ['1989', '1990', '1991', '1992', '1993', '1994'],
  },
  {
    child: '0488',
    childName: 'Trosa',
    parent: '0480',
    parentName: 'Nyköping',
    formalDate: '1992-01-01',
    years: ['1989', '1990', '1991', '1992', '1993', '1994'],
  },
  {
    // NOTE: the task-7 brief and ruling R15 give Bollebygd's code as '1535' and Borås's
    // as '1583'. Those are the codes assigned when Bollebygd was formally created in 1995,
    // but TAB638's live metadata (checked 2026-09-13) does NOT contain '1535' or '1583' —
    // it only has '1443' (Bollebygd) and '1490' (Borås). This is the Västra Götaland
    // county-code renumbering of 1998-01-01 (docs/research/reports/scb-pxweb.md section 7:
    // "1998-01-01 skedde kodändringar av kommuner till följd av länssammanslagningar").
    // TAB638 presents its whole 1968–2024 time series under CURRENT codes, so we must use
    // 1443/1490 here — using 1535/1583 makes the SCB API reject the query outright
    // ("Non-existent value"), which is how this was caught.
    child: '1443',
    childName: 'Bollebygd',
    parent: '1490',
    parentName: 'Borås',
    formalDate: '1995-01-01',
    years: ['1992', '1993', '1994', '1995', '1996', '1997'],
  },
  {
    child: '1814',
    childName: 'Lekeberg',
    parent: '1880',
    parentName: 'Örebro',
    formalDate: '1995-01-01',
    years: ['1992', '1993', '1994', '1995', '1996', '1997'],
  },
  {
    child: '0140',
    childName: 'Nykvarn',
    parent: '0181',
    parentName: 'Södertälje',
    formalDate: '1999-01-01',
    years: ['1996', '1997', '1998', '1999', '2000', '2001'],
  },
  {
    child: '0330',
    childName: 'Knivsta',
    parent: '0380',
    parentName: 'Uppsala',
    formalDate: '2003-01-01',
    years: ['2000', '2001', '2002', '2003', '2004', '2005'],
  },
]

// One freezeData call per distinct (region-set, year-window) pair, to keep the number of
// HTTP requests small and each one a modest, cacheable query.
const groups = new Map<string, { regions: Set<string>; years: string[]; splits: Split[] }>()
for (const s of SPLITS) {
  const key = s.years.join(',')
  const g = groups.get(key) ?? { regions: new Set<string>(), years: s.years, splits: [] }
  g.regions.add(s.child)
  g.regions.add(s.parent)
  g.splits.push(s)
  groups.set(key, g)
}

const totals = new Map<string, number>() // `${region} ${year}` -> total population

let totalCells = 0
for (const g of groups.values()) {
  const sel = {
    Region: [...g.regions],
    Alder: ['tot'],
    Kon: ['1', '2'],
    Civilstand: ['OG', 'G', 'SK', 'ÄNKL'],
    ContentsCode: ['BE0101N1'],
    Tid: g.years,
  }
  const cells = sel.Region.length * 1 * 2 * 4 * 1 * sel.Tid.length
  totalCells += cells
  console.log(`group [${[...g.regions].join(',')}] x years [${g.years.join(',')}]: ${cells} cells`)
  const frozen = await freezeData(TABLE, sel, 'sv')
  for (const f of frozen) {
    for (const r of toRows(f.response)) {
      const k = `${r.dims.Region} ${r.dims.Tid}`
      const prev = totals.get(k) ?? 0
      totals.set(k, prev + (r.value ?? 0))
    }
  }
}
console.log(`Total cells fetched across all groups: ${totalCells}`)
console.log()

console.log(
  'code  name        parent      lastZero  firstReal  R15 says firstReal  parentDrop(lastZero->firstReal)',
)
const results: Array<{
  child: string
  childName: string
  lastZero: string | undefined
  firstReal: string | undefined
  r15FirstReal: number
  parentDrop: number | undefined
  matchesR15: boolean
}> = []

// R15's claimed first-real year = formal year - 1
const r15FirstReal: Record<string, number> = {
  '0461': 1991,
  '0488': 1991,
  '1443': 1994, // R15 named this '1535'; corrected to the current code, see note above
  '1814': 1994,
  '0140': 1998,
  '0330': 2002,
}

for (const s of SPLITS) {
  let lastZero: string | undefined
  let firstReal: string | undefined
  for (const year of s.years) {
    const v = totals.get(`${s.child} ${year}`)
    if (v === undefined) throw new Error(`missing data for ${s.child} ${year}`)
    if (v === 0) lastZero = year
    else if (firstReal === undefined) firstReal = year
  }
  let parentDrop: number | undefined
  if (lastZero !== undefined && firstReal !== undefined) {
    const before = totals.get(`${s.parent} ${lastZero}`)
    const after = totals.get(`${s.parent} ${firstReal}`)
    if (before !== undefined && after !== undefined) parentDrop = after - before
  }
  const matchesR15 = firstReal !== undefined && Number(firstReal) === r15FirstReal[s.child]
  results.push({
    child: s.child,
    childName: s.childName,
    lastZero,
    firstReal,
    r15FirstReal: r15FirstReal[s.child]!,
    parentDrop,
    matchesR15,
  })
  console.log(
    `${s.child}  ${s.childName.padEnd(10)}  ${s.parentName.padEnd(10)}  ${(lastZero ?? '-').padEnd(8)}  ${(firstReal ?? '-').padEnd(9)}  ${r15FirstReal[s.child]}                    ${parentDrop ?? '-'}  ${matchesR15 ? 'MATCH' : 'MISMATCH'}`,
  )
}

console.log()
const allMatch = results.every((r) => r.matchesR15)
console.log(allMatch ? 'ALL SIX MATCH ruling R15.' : 'DISAGREEMENT FOUND with ruling R15:')
if (!allMatch) {
  for (const bad of results.filter((r) => !r.matchesR15)) {
    console.log(
      `  ${bad.child} ${bad.childName}: R15 claims first real year ${bad.r15FirstReal}, data shows firstReal=${bad.firstReal}, lastZero=${bad.lastZero}`,
    )
  }
}
