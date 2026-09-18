import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Reads the published pantry back into one object, for the build-time tools.
 *
 * Plan 13 split `data/indicators.json` into `data/index.json` plus one file per indicator. The
 * three tools here — the 580 municipality pages, the 290 preview cards and the font subset —
 * legitimately want the whole thing, and run in plain Node where the kitchen's TypeScript
 * `readPantryParts` cannot be imported.
 *
 * The one rule that has to match the TypeScript is the ORDER: the index decides it, never the
 * directory listing, because `src/state/url.ts` opens on the first indicator. `read-pantry.test.ts`
 * asserts this function agrees with `assemblePantry` on the real pantry rather than trusting that
 * two implementations of one rule stay in step.
 */
export function readPantry(pantryDir = join(root, 'public/pantry')) {
  const index = JSON.parse(readFileSync(join(pantryDir, 'data/index.json'), 'utf8'))
  const parts = index.indicators.map((meta) => {
    const file = join(pantryDir, 'data/indicators', `${meta.id}.json`)
    try {
      return JSON.parse(readFileSync(file, 'utf8'))
    } catch {
      throw new Error(
        `readPantry: the index lists "${meta.id}" but ${file} is missing; run yarn kitchen publish`,
      )
    }
  })
  return {
    schemaVersion: index.schemaVersion,
    municipalities: index.municipalities,
    indicators: parts.map((part) => part.indicator),
    series: parts.map((part) => part.series),
    priceIndex: index.priceIndex,
  }
}

/** Every published data file's path, for tools that read the pantry as text rather than as data. */
export function pantryDataFiles(pantryDir = join(root, 'public/pantry')) {
  const dir = join(pantryDir, 'data')
  const top = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => join(dir, f))
  const indicators = readdirSync(join(dir, 'indicators'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => join(dir, 'indicators', f))
  return [...top, ...indicators].sort()
}
