import { PantryIndex, PantryIndicator, assemblePantry, type PantryData } from '../../shared/pantry'

/**
 * The published pantry, reassembled from the files the kitchen writes — for tests only.
 *
 * Plan 13 split `data/indicators.json` into an index plus one file per indicator, so the thirty
 * or so site tests that used to import that one file import this instead. They want a whole
 * pantry and should keep getting one; only the packaging changed.
 *
 * `import.meta.glob` rather than a list of ten imports, so an indicator added in a later plan is
 * picked up without touching this file — and so a file the kitchen stops writing disappears from
 * the fixture rather than lingering as a stale import that still resolves.
 *
 * Node's `fs` is deliberately not used: this file is compiled by tsconfig.app.json, which has
 * `vite/client` types and no Node ones, because the site is a browser program. The kitchen's own
 * tests take `readPantryParts()` from kitchen/src/publish.ts instead, which is the same assembly
 * over the same schemas, done the way a Node program does it.
 */
const rawIndex: unknown = (await import('../../public/pantry/data/index.json')).default
const rawParts = import.meta.glob('../../public/pantry/data/indicators/*.json', {
  eager: true,
  import: 'default',
})

export const publishedPantry: PantryData = assemblePantry(
  PantryIndex.parse(rawIndex),
  Object.values(rawParts).map((part) => PantryIndicator.parse(part)),
)
