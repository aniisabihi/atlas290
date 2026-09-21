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
 *
 * **That last paragraph was right and the number under it was wrong.** Eight CI runs between
 * 2026-09-15 and 2026-09-16 scored 79, 80, 80, 80, 81, 83, 84 and 85 against a floor of 80 —
 * three of them landed exactly on it and one fell a single point through. The floor was inside
 * the noise of the thing it measures, so it was passing by luck and failing without a cause
 * anybody could act on. Two changes, below: the score is now a median of several runs, and the
 * floor sits clear of the spread that remains.
 */
import { writeFileSync } from 'node:fs'
import lighthouse from 'lighthouse'
import { chromium } from 'playwright'

const BUDGET = {
  // Clear of the measured CI spread rather than inside it. The observed floor across those eight
  // runs was 79, and a median of three lands higher and varies less than any single run — so 72
  // is roughly a ten-point drop below anything yet seen, which is a regression somebody broke
  // rather than a runner somebody was unlucky with. Raise it when the median has a track record.
  //
  // One floor for both pages in DEFAULT_URLS, not two. After ADR-0019 the municipality page
  // measures 90, 92, 95 against the root's 91, 92, 91 on the same machine — they are no longer
  // distinguishable, so a second number would be inventing a precision the measurements do not
  // support. It was 63, 68, 68 before that change.
  performance: 72,
  // These three do not drift. They have returned the same number on every run ever recorded, so
  // they are held exactly where they are: a single point of movement in any of them is a real
  // change and should stop the build.
  //
  // "Every run ever recorded" meant the ROOT until 2026-09-21, because nothing else was ever
  // measured. Before gating the municipality page on them they were measured there too, built
  // with SITE_ORIGIN set the way CI builds it: 100 / 100 / 100, three runs each. Without
  // SITE_ORIGIN the same page scores 83 on SEO, for the absolute canonical and the hreflang
  // alternates the deploy writes and a bare local build does not — decision 0008 records the
  // same trap on the root.
  accessibility: 100,
  'best-practices': 100,
  seo: 90,
}

/**
 * A ceiling for the SCRIPT, which is the part that grows when somebody adds a dependency — not
 * for the pantry, which Plan 13 split into an index plus a file per indicator precisely so a view
 * fetches what it draws.
 *
 * Unlike the scores this is not noisy at all: the same build transfers the same bytes every time.
 * It is the assertion in this file that can be trusted to the byte, and it is the one that
 * actually catches a careless dependency.
 */
const SCRIPT_BUDGET_BYTES = 180_000

/**
 * Lighthouse's performance score is a sample, not a measurement, and a shared CI runner is a
 * noisy place to take one. Lighthouse's own guidance is to run several times and take the median;
 * three is the compromise between that advice and a job nobody wants to wait for.
 */
const RUNS = Number(process.env['BUDGET_RUNS'] ?? 3)
if (!Number.isInteger(RUNS) || RUNS < 1) {
  // Zero runs used to reach `writeFileSync(path, null)` and a median of nothing, which failed
  // with a type error three steps from the cause.
  throw new Error(
    `BUDGET_RUNS must be a whole number of at least 1, got ${process.env['BUDGET_RUNS']}`,
  )
}

/**
 * Two pages by default, not one, and that is the whole point of this list.
 *
 * Until 2026-09-21 this defaulted to the root alone and CI passed it that same root explicitly,
 * so the 580 municipality pages had NEVER been measured by anything. They are the pages people
 * paste into a chat; they are also the only pages that open a profile, which is where all the
 * work is. The place page scored 86 at ten indicators and 82 at twenty-seven — above the floor
 * by luck rather than by a gate — and then fell to 68 at thirty-five without anything going red.
 * Issue #35, ADR-0019.
 *
 * Stockholm because it is the likeliest link to be shared. Which municipality makes no difference
 * to the work: every series carries all 290 rows whoever is selected, so the profile costs the
 * same on Bjurholm.
 */
const DEFAULT_URLS = ['http://localhost:4173/en/', 'http://localhost:4173/en/stockholm-0180/']

const urls = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_URLS

const median = (numbers) => {
  const sorted = [...numbers].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

const browser = await chromium.launch({ args: ['--remote-debugging-port=9222', '--no-sandbox'] })
const failures = []
try {
  for (const [n, url] of urls.entries()) {
    // Each URL is measured inside its own try, so a page that THROWS — a dead server, a
    // navigation error — is reported as a failure of that page and the rest are still measured.
    // Hoisting `failures` out of the loop achieves nothing on its own: the block that prints it
    // only runs if control reaches the end.
    try {
      const runs = []
      let lastReport = null
      for (let i = 0; i < RUNS; i++) {
        const result = await lighthouse(
          url,
          { port: 9222, output: 'json', logLevel: 'error' },
          { extends: 'lighthouse:default', settings: { onlyCategories: Object.keys(BUDGET) } },
        )
        if (!result) throw new Error('lighthouse returned nothing')
        lastReport = result.report
        runs.push({
          scores: Object.fromEntries(
            Object.keys(BUDGET).map((name) => [
              name,
              Math.round((result.lhr.categories[name]?.score ?? 0) * 100),
            ]),
          ),
          scriptBytes: (result.lhr.audits['network-requests']?.details?.items ?? [])
            .filter((item) => String(item.mimeType ?? '').includes('javascript'))
            .reduce((total, item) => total + (item.transferSize ?? 0), 0),
        })
      }
      // The last run's full report, for anyone opening the artefact. The medians below are what the
      // build is judged on; this is for reading afterwards. One file per URL, so measuring two pages
      // does not leave only the second one's evidence behind.
      writeFileSync(
        n === 0 ? 'lighthouse-report.json' : `lighthouse-report-${n + 1}.json`,
        lastReport,
      )

      console.log(
        `${n === 0 ? '' : '\n'}Lighthouse, ${url} — median of ${RUNS} run${RUNS === 1 ? '' : 's'}`,
      )
      for (const [name, floor] of Object.entries(BUDGET)) {
        const all = runs.map((r) => r.scores[name])
        const score = median(all)
        const ok = score >= floor
        // Every run is printed, not just the median. A median that passes while the spread underneath
        // it is widening is exactly the thing a single number hides, and it is what went wrong here.
        const spread = RUNS > 1 ? `   runs ${all.join(', ')}` : ''
        console.log(
          `  ${name.padEnd(16)} ${String(score).padStart(3)}   budget ${floor}   ${ok ? 'ok' : 'BELOW BUDGET'}${spread}`,
        )
        if (!ok)
          failures.push(
            `${url}: ${name} scored ${score}, budget is ${floor} (runs: ${all.join(', ')})`,
          )
      }

      const scriptBytes = median(runs.map((r) => r.scriptBytes))
      const scriptOk = scriptBytes <= SCRIPT_BUDGET_BYTES
      console.log(
        `  ${'script bytes'.padEnd(16)} ${String(scriptBytes).padStart(6)}   budget ${SCRIPT_BUDGET_BYTES}   ${scriptOk ? 'ok' : 'OVER BUDGET'}`,
      )
      if (!scriptOk)
        failures.push(
          `${url}: script transferred ${scriptBytes} bytes, budget is ${SCRIPT_BUDGET_BYTES}`,
        )
    } catch (error) {
      console.error(`\nLighthouse, ${url} — could not be measured`)
      console.error(`  ${error instanceof Error ? error.message : String(error)}`)
      failures.push(`${url}: could not be measured`)
    }
  }

  // Every URL is measured before anything exits, so one bad page does not hide a second one.
  if (failures.length > 0) {
    console.error('\nBelow budget:\n' + failures.map((f) => `  - ${f}`).join('\n'))
    process.exit(1)
  }
  console.log('\nWithin budget.')
} finally {
  await browser.close()
}
