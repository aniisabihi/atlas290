/**
 * The thirteen tables left over after the fourth slice, verified against live SCB metadata
 * before any of them is designed around.
 *
 * Plan 16's lesson, written into docs/kitchen.md: read the table first. Six of that slice's
 * fifteen came out different from what the design assumed, and every one of those differences
 * was visible in the metadata.
 *
 * What this run has to settle, beyond the usual 290-regions check:
 *
 *  - Which `Tid` values each table actually publishes. For most of these that is the whole
 *    question — whether a series is annual, sparse, or keyed by something that is not a year at
 *    all. The question list records "1998-2002 … 2021-2025" for life expectancy and "mandate
 *    period" for elected representatives; if those are real `Tid` codes then `years: number[]`
 *    cannot hold them, and that is a contract question rather than an indicator question.
 *  - Whether the question list's coverage claims hold. Q25 is recorded as 2013–2025, which would
 *    make it annual and NOT part of the sparse group the slice design put it in.
 *
 * Metadata only; fetches no data. Run: yarn tsx kitchen/spikes/verify-the-rest.ts
 */
import { freezeMetadata } from '../src/scb/freeze'
import { parseMetadata, type TableMeta } from '../src/scb/client'

const WANTED: Array<{ table: string; q: string; claim: string }> = [
  { table: 'TAB3267', q: 'Q10/Q11', claim: 'commuting 1993–2003' },
  { table: 'TAB3266', q: 'Q10/Q11', claim: 'commuting 2004–2018' },
  { table: 'TAB5839', q: 'Q10/Q11', claim: 'commuting 2019–2021' },
  { table: 'TAB4374', q: 'Q18', claim: 'persons per household, 2011–2025' },
  { table: 'TAB3276', q: 'Q28', claim: 'cars in traffic, 2002–2025' },
  { table: 'TAB4422', q: 'Q25', claim: 'near protected nature, 2013–2025 — annual?' },
  { table: 'TAB4394', q: 'Q3', claim: 'life expectancy, FIVE-YEAR WINDOWS' },
  { table: 'TAB708', q: 'Q21', claim: 'councillors, MANDATE PERIODS' },
  { table: 'TAB2707', q: 'Q19/Q20', claim: 'turnout, election years only' },
  { table: 'TAB5118', q: 'Q23', claim: 'land use, 2010/2015/2020' },
  { table: 'TAB6002', q: 'Q24', claim: 'farmland, 9 points from 1951' },
  { table: 'TAB5591', q: 'Q26', claim: 'green space, 2015/2020' },
  { table: 'TAB4198', q: 'Q27', claim: 'holiday homes, 2015/2020' },
]

function regions(meta: TableMeta): string {
  const r = meta.variables.find((v) => v.code === 'Region')
  if (!r) return 'NO Region dimension'
  const four = r.values.filter((v) => /^\d{4}$/.test(v.code)).length
  return `${four} four-digit${four === 290 ? '' : `  <-- NOT 290, of ${r.values.length} total`}`
}

for (const { table, q, claim } of WANTED) {
  console.log(`\n${'='.repeat(78)}\n${table}  (${q}) — list claims: ${claim}`)
  try {
    const meta = parseMetadata(table, (await freezeMetadata(table, 'sv')).response)
    console.log(`  ${meta.label}`)
    console.log(`  Region: ${regions(meta)}`)
    const tid = meta.variables.find((v) => v.code === 'Tid')
    if (tid) {
      const codes = tid.values.map((v) => v.code)
      // Printed in full, not as a range: whether these are years at all is the question.
      console.log(`  Tid (${codes.length}): ${codes.join(' ')}`)
      const allYears = codes.every((c) => /^\d{4}$/.test(c))
      console.log(`  Tid values are plain four-digit years: ${allYears ? 'YES' : 'NO'}`)
      if (allYears && codes.length > 1) {
        const ys = codes.map(Number).sort((a, b) => a - b)
        const span = ys[ys.length - 1]! - ys[0]! + 1
        console.log(`  density: ${ys.length} values across ${span} years`)
      }
    } else {
      console.log('  NO Tid dimension')
    }
    for (const v of meta.variables) {
      if (v.code === 'Region' || v.code === 'Tid') continue
      const shown = v.values.slice(0, 10).map((x) => `${x.code}=${x.label}`)
      const more = v.values.length > 10 ? ` … +${v.values.length - 10}` : ''
      console.log(`  ${v.code} (${v.values.length}): ${shown.join(' | ')}${more}`)
    }
  } catch (err) {
    console.log(`  FAILED: ${err instanceof Error ? err.message : String(err)}`)
  }
}
