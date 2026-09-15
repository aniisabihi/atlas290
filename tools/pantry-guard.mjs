#!/usr/bin/env node
/**
 * Refuses a refresh that loses data.
 *
 * The monthly job talks to a real service that can be slow, partial or briefly wrong. The check
 * stage already rejects implausible values, but it cannot tell the difference between "SCB
 * withdrew a series" and "the fetch came back half empty" — both look like fewer values. So this
 * compares the published pantry against the one already committed and stops if the count of
 * actual, non-null observations has fallen at all.
 *
 * Counts can legitimately fall: SCB occasionally withdraws or restates a series. When that
 * happens this fails, a person looks, and the refresh is run again with the drop understood. That
 * is the intended outcome — a human reading a diff — not an obstacle to it.
 *
 *   node tools/pantry-guard.mjs <before.json> <after.json>
 */
import { readFileSync } from 'node:fs'

const [, , beforePath, afterPath] = process.argv
if (!beforePath || !afterPath) {
  console.error('usage: pantry-guard.mjs <before.json> <after.json>')
  process.exit(2)
}

const read = (path) => JSON.parse(readFileSync(path, 'utf8'))
const countByIndicator = (pantry) => {
  const counts = new Map()
  for (const series of pantry.series) {
    let present = 0
    for (const row of series.values) for (const value of row) if (value !== null) present += 1
    counts.set(series.indicator, present)
  }
  return counts
}

const before = countByIndicator(read(beforePath))
const after = countByIndicator(read(afterPath))

const losses = []
for (const [indicator, was] of before) {
  const now = after.get(indicator)
  if (now === undefined) {
    losses.push(`${indicator}: the whole series disappeared (${was} values)`)
  } else if (now < was) {
    losses.push(`${indicator}: ${was} values before, ${now} after (${was - now} lost)`)
  }
}

const gained = [...after]
  .filter(([indicator, now]) => (before.get(indicator) ?? 0) < now)
  .map(([indicator, now]) => `${indicator}: +${now - (before.get(indicator) ?? 0)}`)

if (gained.length > 0) console.log('New values:\n' + gained.map((g) => `  ${g}`).join('\n'))

if (losses.length > 0) {
  console.error(
    '\nThis refresh would REMOVE published values:\n' + losses.map((l) => `  ${l}`).join('\n'),
  )
  console.error(
    '\nStopping. Statistics Sweden does sometimes withdraw or restate a series, so this is not\n' +
      'necessarily wrong — but it is not something to publish without a person having looked.',
  )
  process.exit(1)
}

if (gained.length === 0) console.log('No change in the number of published values.')
