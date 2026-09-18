/**
 * Plan 16, step 0: verify every source the fourth-slice design names, against live SCB metadata,
 * BEFORE a single definition is written.
 *
 * The design's table was compiled from the question list, which was itself verified on
 * 2026-09-17 — but it records content CODES, and this project resolves content by stable Swedish
 * LABEL (decision 0001, trap 2). Those labels are not in the design, so they have to be read off
 * the table. The same goes for each dimension's name and its total code, which is what decides
 * whether a definition says `'total'`, `{ label }` or explicit values.
 *
 * It also answers the two questions the design flagged as risks rather than facts:
 *  - how many four-digit Region codes each table actually offers (D2: assert 290, never trust
 *    the catalogue — four candidates in the question list said "efter region" and had one, five
 *    or six of them);
 *  - how big a full fetch would be, in cells, since TAB1264/TAB960 are age x sex cubes and the
 *    comparable table already in the pantry, TAB638, is 48 MB frozen.
 *
 * Metadata only: this fetches no data. Run: yarn tsx kitchen/spikes/verify-fifteen-sources.ts
 */
import { freezeMetadata } from '../src/scb/freeze'
import { parseMetadata, type TableMeta } from '../src/scb/client'

/** Every table the design names, with the content code it claims and what it is wanted for. */
const WANTED: Array<{ table: string; claims: string; indicator: string }> = [
  { table: 'TAB1264', claims: '—', indicator: 'natural-change-rate (births)' },
  { table: 'TAB960', claims: '—', indicator: 'natural-change-rate (deaths)' },
  { table: 'TAB4805', claims: '000001J4', indicator: 'fertility-rate' },
  { table: 'TAB4642', claims: '00000708', indicator: 'dependency-ratio' },
  { table: 'TAB3200', claims: '000002NS / 000002NN', indicator: 'employment / unemployment' },
  { table: 'TAB3600', claims: 'OE0101A0', indicator: 'taxable-income-per-resident' },
  { table: 'TAB1492', claims: '000006SY', indicator: 'disposable-household-income' },
  { table: 'TAB2538', claims: 'BO0101A5', indicator: 'dwellings-completed-rate' },
  {
    table: 'TAB824',
    claims: 'BO0104AH',
    indicator: 'dwellings-per-1000 / share-houses / share-rentals',
  },
  { table: 'TAB4590', claims: '000000J4', indicator: 'median-rent' },
  { table: 'TAB4357', claims: 'substance GHG', indicator: 'greenhouse-gas-per-resident' },
]

function fourDigitRegions(meta: TableMeta): number {
  const region = meta.variables.find((v) => v.code === 'Region')
  if (!region) return -1
  return region.values.filter((v) => /^\d{4}$/.test(v.code)).length
}

function years(meta: TableMeta): string {
  const tid = meta.variables.find((v) => v.code === 'Tid')
  if (!tid || tid.values.length === 0) return 'no Tid'
  const codes = tid.values.map((v) => v.code)
  return `${codes[0]}..${codes[codes.length - 1]} (${codes.length})`
}

function fullCells(meta: TableMeta): number {
  return meta.variables.reduce((n, v) => n * Math.max(v.values.length, 1), 1)
}

for (const { table, claims, indicator } of WANTED) {
  console.log(`\n${'='.repeat(78)}\n${table} — ${indicator}\n  design claims content: ${claims}`)
  try {
    const frozen = await freezeMetadata(table, 'sv')
    const meta = parseMetadata(table, frozen.response)
    console.log(`  label: ${meta.label}`)
    console.log(`  Region: ${fourDigitRegions(meta)} four-digit codes`)
    console.log(`  Tid: ${years(meta)}`)
    console.log(`  full cube: ${fullCells(meta).toLocaleString('en')} cells`)
    for (const v of meta.variables) {
      if (v.code === 'Region' || v.code === 'Tid') continue
      const shown = v.values.slice(0, 14).map((x) => `${x.code}=${x.label}`)
      const more = v.values.length > 14 ? ` … +${v.values.length - 14} more` : ''
      console.log(`  ${v.code} (${v.values.length}): ${shown.join(' | ')}${more}`)
    }
  } catch (err) {
    console.log(`  FAILED: ${err instanceof Error ? err.message : String(err)}`)
  }
}
