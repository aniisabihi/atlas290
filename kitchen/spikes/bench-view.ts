/**
 * Throwaway (Plan 13): what re-parsing the growing view costs when a profile opens.
 *
 * `shared/pantry.ts` turns zod's JIT off when `document` exists, because the deployed CSP refuses
 * the `new Function` it compiles with. Faking `document` here measures the path the BROWSER takes,
 * which is the one that matters — the kitchen's own numbers are the fast path and would flatter it.
 */
;(globalThis as { document?: unknown }).document = {}

const { readPantryParts, DEFAULT_PANTRY_DIR } = await import('../src/publish')
const { splitPantry, viewOf } = await import('../../shared/pantry')

const pantry = readPantryParts(DEFAULT_PANTRY_DIR)
const { index, parts } = splitPantry(pantry)

let total = 0
for (let n = 1; n <= parts.length; n++) {
  const t = performance.now()
  viewOf(index, parts.slice(0, n))
  const ms = performance.now() - t
  total += ms
  console.log(`viewOf with ${String(n).padStart(2)} series: ${ms.toFixed(1)} ms`)
}
console.log(`\ncumulative for one profile open: ${total.toFixed(0)} ms`)

export {}
