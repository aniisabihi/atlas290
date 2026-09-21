/**
 * Throwaway (plan 19): the two questions about `TAB708` that only the DATA could answer.
 *
 * The fifth slice design named `councillor-gap` from `000000BO` and left the background total
 * open, promising the total would be chosen by checking. Both promises landed here, and both
 * answers changed the plan:
 *
 *  1. `000000BO` — "Skillnad mot röstberättigad befolkning" — is null for ALL 1,450 cells at the
 *     background total. The gap is defined per background group; against the whole population it
 *     is zero by construction, so SCB publishes nothing. The indicator became the share of
 *     councillors who are women (`0000009U`), which is complete. This is ADR-0018's content-code
 *     trap for the second time in one slice, which is why docs/kitchen.md now states it as a
 *     rule rather than an anecdote.
 *  2. `BakgrVar`'s seven "samtliga" codes do NOT agree — each totals only the representatives
 *     its own cross-tabulation can classify. `samald` is the one that counts them all.
 *
 * Writes to a scratch directory, never to kitchen/raw: this reads cells no indicator publishes.
 * Run: yarn tsx kitchen/spikes/probe-708.ts
 */
import { freezeData, freezeMetadata } from '../src/scb/freeze'
import { parseMetadata } from '../src/scb/client'

const RAW = process.env['PROBE_RAW_DIR'] ?? '/tmp/atlas290-probe-708'
const meta = parseMetadata(
  'TAB708',
  (await freezeMetadata('TAB708', 'sv', { rawDir: RAW })).response,
)
const regions = meta.variables
  .find((v) => v.code === 'Region')!
  .values.map((v) => v.code)
  .filter((c) => /^\d{4}$/.test(c))
const periods = meta.variables.find((v) => v.code === 'Tid')!.values.map((v) => v.code)
console.log(`four-digit regions: ${regions.length}   periods: ${periods.join(', ')}`)

// Question 1: which content codes actually have values at the background total?
for (const [code, what] of [
  ['0000009U', 'sex distribution among councillors'],
  ['000000BO', 'gap against the eligible population'],
  ['0000009T', 'councillors, count'],
] as const) {
  const frozen = await freezeData(
    'TAB708',
    { Region: regions, Kon: ['030'], BakgrVar: ['samald'], ContentsCode: [code], Tid: periods },
    'sv',
    { rawDir: RAW },
  )
  let nonNull = 0
  let total = 0
  for (const chunk of frozen) {
    const values = (chunk.response as { value: Array<number | null> }).value
    total += values.length
    nonNull += values.filter((v) => v !== null).length
  }
  console.log(`${code} (${what}): ${nonNull}/${total} non-null`)
}

// Question 2: do the seven background totals agree with each other?
const TOTALS = ['samald', 'samu6', 'samu18', 'samtcs', 'samutb', 'samiu', 'samink']
const one = await freezeData(
  'TAB708',
  {
    Region: ['0180'],
    Kon: ['030'],
    BakgrVar: TOTALS,
    ContentsCode: ['0000009T'],
    Tid: ['2023-2026'],
  },
  'sv',
  { rawDir: RAW },
)
const r = one[0]!.response as {
  id: string[]
  dimension: Record<string, { category: { index: Record<string, number> } }>
  value: Array<number | null>
}
const order = Object.entries(r.dimension['BakgrVar']!.category.index)
  .sort((a, b) => a[1] - b[1])
  .map(([k]) => k)
console.log(
  'Stockholm 2023-2026, councillors counted under each "samtliga" code:',
  order.map((code, i) => `${code}=${r.value[i]}`).join('  '),
)
