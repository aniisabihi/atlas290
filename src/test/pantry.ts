import {
  PantryIndex,
  PantryIndicator,
  assemblePantry,
  viewOf,
  type PantryData,
  type PantryView,
} from '../../shared/pantry'

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

/** The index exactly as published. */
export const publishedIndex = PantryIndex.parse(rawIndex)

/** Every indicator's file, keyed by id — the shape `LoadedPantry.parts` holds at runtime. */
export const publishedParts: ReadonlyMap<string, PantryIndicator> = new Map(
  Object.values(rawParts)
    .map((part) => PantryIndicator.parse(part))
    .map((part) => [part.indicator.id, part]),
)

export const publishedPantry: PantryData = assemblePantry(publishedIndex, [
  ...publishedParts.values(),
])

/**
 * A fully loaded pantry, as `App` receives it once every file has arrived. Tests that render the
 * whole application use this so they exercise the real prop shape; the data half is complete, so
 * nothing in a test ever waits on a fetch.
 */
export const loadedDataFor = () => ({
  view: publishedPantry,
  index: publishedIndex,
  parts: publishedParts,
})

/**
 * The pantry as it looks mid-load: every indicator's metadata, but only the named series.
 *
 * This is the state the site is genuinely in for the first moments of every visit, and the one
 * the fully-loaded fixture above cannot exercise.
 */
export function partialPantry(ids: readonly string[]): PantryView {
  return viewOf(
    publishedIndex,
    ids.map((id) => {
      const part = publishedParts.get(id)
      if (!part) throw new Error(`partialPantry: the pantry has no indicator "${id}"`)
      return part
    }),
  )
}
