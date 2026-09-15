#!/usr/bin/env node
/**
 * A performance budget with real numbers in it.
 *
 * The thresholds below were measured before they were chosen, which is the whole point: a budget
 * invented in advance is either trivially met or immediately broken, and neither teaches anybody
 * anything. Measured on 2026-09-14 against the built site: performance 90, accessibility 100,
 * best practices 100, SEO 91.
 *
 * The budget sits a little below each, because these run on shared CI hardware and a score that
 * has to be exactly right is a score that fails for reasons nobody can act on. It is an alarm for
 * a regression, not a target to chase.
 */
import { writeFileSync } from 'node:fs'
import lighthouse from 'lighthouse'
import { chromium } from 'playwright'

const BUDGET = {
  performance: 80,
  accessibility: 100,
  'best-practices': 100,
  seo: 90,
}

/**
 * The pantry is 1.05 MB uncompressed and the site fetches all of it on load. That is a deliberate
 * choice from Plan 3 — 275 kB over the wire, and cheaper than fetching per indicator — so the
 * budget accommodates it rather than pretending otherwise. This ceiling is for the SCRIPT, which
 * is the part that grows when somebody adds a dependency.
 */
const SCRIPT_BUDGET_BYTES = 180_000

const url = process.argv[2] ?? 'http://localhost:4173/en/'

const browser = await chromium.launch({ args: ['--remote-debugging-port=9222', '--no-sandbox'] })
try {
  const result = await lighthouse(
    url,
    { port: 9222, output: 'json', logLevel: 'error' },
    { extends: 'lighthouse:default', settings: { onlyCategories: Object.keys(BUDGET) } },
  )
  if (!result) throw new Error('lighthouse returned nothing')
  writeFileSync('lighthouse-report.json', result.report)

  const failures = []
  console.log(`Lighthouse, ${url}`)
  for (const [name, floor] of Object.entries(BUDGET)) {
    const score = Math.round((result.lhr.categories[name]?.score ?? 0) * 100)
    const ok = score >= floor
    console.log(
      `  ${name.padEnd(16)} ${String(score).padStart(3)}   budget ${floor}   ${ok ? 'ok' : 'BELOW BUDGET'}`,
    )
    if (!ok) failures.push(`${name} scored ${score}, budget is ${floor}`)
  }

  const scriptBytes = (result.lhr.audits['network-requests']?.details?.items ?? [])
    .filter((i) => String(i.mimeType ?? '').includes('javascript'))
    .reduce((total, i) => total + (i.transferSize ?? 0), 0)
  const scriptOk = scriptBytes <= SCRIPT_BUDGET_BYTES
  console.log(
    `  ${'script bytes'.padEnd(16)} ${String(scriptBytes).padStart(6)}   budget ${SCRIPT_BUDGET_BYTES}   ${scriptOk ? 'ok' : 'OVER BUDGET'}`,
  )
  if (!scriptOk)
    failures.push(`script transferred ${scriptBytes} bytes, budget is ${SCRIPT_BUDGET_BYTES}`)

  if (failures.length > 0) {
    console.error('\nBelow budget:\n' + failures.map((f) => `  - ${f}`).join('\n'))
    process.exit(1)
  }
  console.log('\nWithin budget.')
} finally {
  await browser.close()
}
