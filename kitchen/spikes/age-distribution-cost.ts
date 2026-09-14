/**
 * Task 2 spike (Plan 2): can median age and share aged 65+ be built at all?
 *
 * Both indicators need population broken down by age. Plan 1 fetched only the age TOTAL
 * (290 cells/year). The naive full cross-tab is 290 municipalities x 102 ages x 2 sexes x
 * 4 marital states x 57 years ~= 13.5M cells, guessed at 150-250 MB frozen. This script
 * replaces that guess with real measurements and answers:
 *
 *  1. Which server-side aggregation codelists TAB638/TAB5557 actually expose (Alder, Kon,
 *     Civilstand) - read from the RAW frozen metadata JSON, since parseMetadata (client.ts)
 *     does not surface codelists and is NOT changed by this spike.
 *  2. The real frozen-file byte cost of single ages, 5-year groups and 10-year groups, for
 *     one year across all 290 municipalities - measured, not estimated.
 *  3. Whether SCB's v2 client abstraction in this project (Selection/toRequestBody in
 *     client.ts) can even express a codelist-based server-side aggregation.
 *  4. Whether SCB publishes mean/median age per municipality directly (a separate, ad hoc
 *     /tables?query= search - not data, so not routed through freezeData/freezeMetadata).
 *
 * Run: yarn tsx kitchen/spikes/age-distribution-cost.ts
 */
import {
  freezeData,
  freezeMetadata,
  rawPath,
  selectionKey,
  DEFAULT_RAW_DIR,
} from '../src/scb/freeze'
import { statSync } from 'node:fs'
import { SCB_MAX_CELLS } from '../src/scb/client'

const TAB638 = 'TAB638' // Folkmängden ... 1968-2024 (pre-CKM)
const TAB5557 = 'TAB5557' // same series, 2025- (CKM noise)

type RawDimension = {
  label?: string
  category: { index: Record<string, number> | string[] }
  extension?: { codelists?: Array<{ id: string; label: string; type: string }> }
}
type RawMeta = { id: string[]; dimension: Record<string, RawDimension> }

function codesOf(dim: RawDimension): string[] {
  const idx = dim.category.index
  return Array.isArray(idx) ? idx : Object.keys(idx)
}

function requireDim(raw: RawMeta, code: string): RawDimension {
  const dim = raw.dimension[code]
  if (!dim) throw new Error(`metadata lacks dimension ${code}`)
  return dim
}

// ---------------------------------------------------------------------------
// Step 1: codelists, read straight from the raw metadata JSON (not parseMetadata).
// ---------------------------------------------------------------------------
console.log('=== Step 1: codelists exposed per dimension ===\n')

const metaSv638 = await freezeMetadata(TAB638, 'sv')
const metaSv5557 = await freezeMetadata(TAB5557, 'sv')

function printCodelists(label: string, raw: RawMeta) {
  console.log(`-- ${label} --`)
  for (const varCode of raw.id) {
    const dim = raw.dimension[varCode]
    if (!dim) continue
    const n = codesOf(dim).length
    const lists = dim.extension?.codelists ?? []
    if (lists.length === 0) {
      console.log(`  ${varCode}: ${n} values, no codelists`)
    } else {
      console.log(`  ${varCode}: ${n} values, codelists:`)
      for (const cl of lists) console.log(`    - ${cl.id} (${cl.type}): ${cl.label}`)
    }
  }
  console.log()
}

printCodelists(TAB638, metaSv638.response as RawMeta)
printCodelists(TAB5557, metaSv5557.response as RawMeta)

console.log(
  'NOTE: TAB638.Alder exposes two Aggregation codelists (agg_Ålder5år, agg_Ålder10årJ) that ' +
    'would let the SERVER sum single years into groups. Selecting one requires a `codelist` ' +
    'field per-variable in the v2 POST body (confirmed against the PxWeb v2 user guide: ' +
    '`{"variableCode":"Alder","codelist":"agg_Ålder5år","valueCodes":[...]}`). This project\'s ' +
    'Selection type (client.ts) is `Record<string, string[]>` and toRequestBody() emits only ' +
    '`{variableCode, valueCodes}` - there is no way to express a codelist through freezeData ' +
    'today. This spike does NOT extend client.ts (out of scope, and the brief only protects ' +
    'parseMetadata explicitly, but widening the shared Selection/toRequestBody contract is a ' +
    "production-code change this task should not make unilaterally). Concretely: TAB638's " +
    '5-year/10-year server-side aggregation is UNTESTED and UNREACHABLE from this codebase ' +
    'as it stands - a real finding, not a measurement.',
)
console.log(
  'Neither table exposes ANY codelist for Kon or Civilstand - no server-side "total across ' +
    'sex" or "total across marital status" aggregation exists for either table. TAB638 also ' +
    'has no literal total VALUE for Kon or Civilstand (Kon: 1,2 only; Civilstand: OG,G,SK,ÄNKL ' +
    'only) - every TAB638 age query needs the full 2x4 cross-tab regardless of age ' +
    'granularity. TAB5557 (2025-) is different: it carries literal total VALUES in its plain ' +
    "value lists - Kon='TotSa', Civilstand='SC' - which are ordinary selectable codes, not a " +
    'codelist mechanism, so they ARE reachable through the existing Selection type.',
)

// ---------------------------------------------------------------------------
// Step 2: measure real frozen byte cost, one year, all 290 municipalities, per option.
// ---------------------------------------------------------------------------
console.log('\n=== Step 2: measured one-year costs ===\n')

const regionCodes = codesOf(requireDim(metaSv638.response as RawMeta, 'Region')).filter((c) =>
  /^\d{4}$/.test(c),
)
if (regionCodes.length !== 290) {
  throw new Error(
    `expected 290 municipality codes in TAB638 Region metadata, got ${regionCodes.length}`,
  )
}

const singleAgeCodes638 = codesOf(requireDim(metaSv638.response as RawMeta, 'Alder')).filter(
  (c) => c !== 'tot',
)
const KON638 = ['1', '2']
const CIVIL638 = ['OG', 'G', 'SK', 'ÄNKL']

const fiveYearCodes5557 = [
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
const tenYearCodes5557 = [
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
const singleAgeCodes5557 = [...Array(100).keys()].map(String).concat(['100+1'])

// Ages 65..100+ only (36 codes) - share-65+ needs no per-age granularity, only a partition
// at 65: numerator = sum of ages 65+, denominator = the age TOTAL Plan 1 already fetches.
// Cheaper than any full age-distribution option below, and exact on TAB638 (pre-CKM).
const ages65Plus638 = singleAgeCodes638.filter((c) => c === '100+' || Number(c) >= 65)

type Option = {
  name: string
  table: string
  lang: 'sv'
  selection: Record<string, string[]>
}

// Measured options. Each is exactly one year, all 290 municipalities, through freezeData
// (which auto-chunks over the 150,000-cell limit and skips anything already frozen).
const options: Option[] = [
  {
    name: 'TAB638 single ages, full 2 sex x 4 marital cross-tab (only option TAB638 can serve)',
    table: TAB638,
    lang: 'sv',
    selection: {
      Region: regionCodes,
      Alder: singleAgeCodes638,
      Kon: KON638,
      Civilstand: CIVIL638,
      ContentsCode: ['BE0101N1'],
      Tid: ['2024'],
    },
  },
  {
    name: 'TAB638 ages 65+ ONLY, full 2 sex x 4 marital cross-tab (share-65+ numerator, no full distribution needed)',
    table: TAB638,
    lang: 'sv',
    selection: {
      Region: regionCodes,
      Alder: ages65Plus638,
      Kon: KON638,
      Civilstand: CIVIL638,
      ContentsCode: ['BE0101N1'],
      Tid: ['2024'],
    },
  },
  {
    name: 'TAB5557 single ages, sex+marital TOTAL codes (TotSa/SC)',
    table: TAB5557,
    lang: 'sv',
    selection: {
      Region: regionCodes,
      Alder: singleAgeCodes5557,
      Kon: ['TotSa'],
      Civilstand: ['SC'],
      ContentsCode: ['000007ME'],
      Tid: ['2025'],
    },
  },
  {
    name: 'TAB5557 5-year groups, sex+marital TOTAL codes (TotSa/SC)',
    table: TAB5557,
    lang: 'sv',
    selection: {
      Region: regionCodes,
      Alder: fiveYearCodes5557,
      Kon: ['TotSa'],
      Civilstand: ['SC'],
      ContentsCode: ['000007ME'],
      Tid: ['2025'],
    },
  },
  {
    name: 'TAB5557 10-year groups, sex+marital TOTAL codes (TotSa/SC)',
    table: TAB5557,
    lang: 'sv',
    selection: {
      Region: regionCodes,
      Alder: tenYearCodes5557,
      Kon: ['TotSa'],
      Civilstand: ['SC'],
      ContentsCode: ['000007ME'],
      Tid: ['2025'],
    },
  },
]

const YEARS_TAB638 = 57 // 1968-2024
const YEARS_TAB5557_SO_FAR = 1 // 2025 only, so far

type Result = { name: string; cells: number; bytes: number; files: number }
const results: Record<string, Result> = {}

for (const opt of options) {
  const cells =
    opt.selection.Region!.length *
    opt.selection.Alder!.length *
    opt.selection.Kon!.length *
    opt.selection.Civilstand!.length *
    opt.selection.ContentsCode!.length *
    opt.selection.Tid!.length
  console.log(`-- ${opt.name} --`)
  console.log(`   cells requested: ${cells} (limit per query: ${SCB_MAX_CELLS})`)
  const frozen = await freezeData(opt.table, opt.selection, opt.lang)
  let bytes = 0
  for (const f of frozen) {
    const key = selectionKey(f.selection)
    const path = rawPath(DEFAULT_RAW_DIR, opt.table, opt.lang, key)
    bytes += statSync(path).size
  }
  console.log(`   chunks written/read: ${frozen.length}, total frozen bytes: ${bytes}`)
  results[opt.name] = { name: opt.name, cells, bytes, files: frozen.length }
}

console.log('\n=== Measured summary (one year, all 290 municipalities) ===\n')
console.log('option | cells | measured bytes')
for (const r of Object.values(results)) {
  console.log(`${r.name} | ${r.cells} | ${r.bytes} B`)
}

console.log('\n=== Projections across the full series ===\n')
const singleFull =
  results['TAB638 single ages, full 2 sex x 4 marital cross-tab (only option TAB638 can serve)']!
const age65 =
  results[
    'TAB638 ages 65+ ONLY, full 2 sex x 4 marital cross-tab (share-65+ numerator, no full distribution needed)'
  ]!
console.log(
  `Single ages, full cross-tab, TAB638 alone (${YEARS_TAB638} years, 1968-2024): ` +
    `${singleFull.bytes} B/yr x ${YEARS_TAB638} = ${singleFull.bytes * YEARS_TAB638} B ` +
    `(${((singleFull.bytes * YEARS_TAB638) / 1_000_000).toFixed(1)} MB)`,
)
console.log(
  `Ages 65+ only, full cross-tab, TAB638 alone (${YEARS_TAB638} years, 1968-2024): ` +
    `${age65.bytes} B/yr x ${YEARS_TAB638} = ${age65.bytes * YEARS_TAB638} B ` +
    `(${((age65.bytes * YEARS_TAB638) / 1_000_000).toFixed(1)} MB). This is the real cost of a ` +
    'share-65+ numerator built from TAB638 - the denominator (age total) is already fetched by ' +
    'Plan 1 at ~zero incremental cost, so this number alone approximates the full historical ' +
    'share-65+ cost, no age distribution needed.',
)
for (const name of [
  'TAB5557 single ages, sex+marital TOTAL codes (TotSa/SC)',
  'TAB5557 5-year groups, sex+marital TOTAL codes (TotSa/SC)',
  'TAB5557 10-year groups, sex+marital TOTAL codes (TotSa/SC)',
]) {
  const r = results[name]!
  console.log(
    `${r.name}: ${r.bytes} B for 1 year (TAB5557, 2025 only so far - ${YEARS_TAB5557_SO_FAR} year of ` +
      `real CKM data exists). This option has NO TAB638 equivalent without the untested/unreachable ` +
      `agg_Ålder5år / agg_Ålder10årJ codelists (see Step 1), so it cannot be projected across the ` +
      'full 1968-2024 span with a real measurement - only forward from 2025.',
  )
}

console.log(
  '\nFor reference, if the untested TAB638 aggregation codelists DID work exactly as documented, ' +
    'the cell count for TAB638 5-year groups would be 290 x 21 x 2 x 4 = 48,720 cells/year (per ' +
    "the brief's arithmetic) - same order of magnitude as this script's single-ages measurement " +
    'divided by ~4.8, so a rough (not measured) byte estimate would be singleFull.bytes/4.8/yr. This ' +
    'number is explicitly NOT a measurement and must not be reported as one.',
)

// ---------------------------------------------------------------------------
// Step 3: search for a direct mean/median age table (not data - not frozen: this is a
// table-index SEARCH, not a per-table metadata or data fetch, so freezeMetadata/freezeData
// do not apply and nothing here is committed).
// ---------------------------------------------------------------------------
console.log('\n=== Step 3: searching for a direct mean/median age table ===\n')
const queries = ['medelålder region', 'medianålder kommun', 'genomsnittsålder kommun']
type TableHit = { id: string; label: string; firstPeriod?: string; lastPeriod?: string }
for (const q of queries) {
  const url = `https://statistikdatabasen.scb.se/api/v2/tables?query=${encodeURIComponent(q)}&lang=sv`
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  console.log(`query "${q}" -> HTTP ${res.status}`)
  if (res.ok) {
    const body = (await res.json()) as { tables?: TableHit[] }
    const tables = body.tables ?? []
    console.log(`  ${tables.length} table(s):`)
    for (const t of tables.slice(0, 15)) {
      console.log(`  - ${t.id}: ${t.label} (${t.firstPeriod ?? '?'}-${t.lastPeriod ?? '?'})`)
    }
  }
}

console.log('\n-- Checking the two mean/median-age candidates found above --\n')
for (const tab of ['TAB637', 'TAB4659']) {
  const metaUrl = `https://statistikdatabasen.scb.se/api/v2/tables/${tab}/metadata?lang=sv`
  const res = await fetch(metaUrl, { headers: { accept: 'application/json' } })
  const body = (await res.json()) as RawMeta & { label?: string }
  const regionDim = requireDim(body, 'Region')
  const regionCodesHere = codesOf(regionDim)
  const kommunCount = regionCodesHere.filter((c) => /^\d{4}$/.test(c)).length
  const contentsDim = requireDim(body, 'ContentsCode')
  const contentsCodesHere = codesOf(contentsDim)
  console.log(`${tab}: ${body.label ?? '?'}`)
  console.log(
    `  Region: ${regionCodesHere.length} values, ${kommunCount} of them 4-digit kommun codes`,
  )
  console.log(`  ContentsCode values: ${contentsCodesHere.join(', ')}`)
}
console.log(
  '\nTAB637 ("Befolkningens medelålder efter region och kön", 1998-2025) covers all 290 kommuner ' +
    'and has a Kon total code (1+2=totalt) - MEAN age per municipality is available as a direct, ' +
    'single-content-code fetch (290 cells/year, same order of magnitude as the age total Plan 1 ' +
    'already fetches). TAB4659 ("Befolkningens medelålder och medianålder efter region och kön", ' +
    '2000-2025) DOES carry a Medianålder content code, but its Region dimension only has 22 values ' +
    '(riket + 21 län) - NO kommun-level breakdown. SCB does not publish median age per municipality ' +
    'directly; it only publishes it at county level and above. Mean age per municipality, however, ' +
    'is directly available and requires no age-distribution fetch at all.',
)
