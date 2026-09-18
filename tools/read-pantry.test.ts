import { describe, expect, it } from 'vitest'
import { DEFAULT_PANTRY_DIR, readPantryParts } from '../kitchen/src/publish'
import { pantryDataFiles, readPantry } from './read-pantry.mjs'

/**
 * Plan 13 Task 7. The build-time tools read the pantry in plain JavaScript, because they are plain
 * JavaScript; the kitchen reads it in TypeScript through the zod schemas. That is two
 * implementations of one rule — the index decides the order — and two implementations of one rule
 * drift unless something holds them together. This is that something.
 */
describe('readPantry, the tools’ reader', () => {
  it('agrees with the kitchen, field for field, on the real published pantry', () => {
    expect(readPantry()).toEqual(readPantryParts(DEFAULT_PANTRY_DIR))
  })

  it('orders indicators by the index, which is what decides the opening view', () => {
    const fromTools = readPantry().indicators.map((i: { id: string }) => i.id)
    const fromKitchen = readPantryParts(DEFAULT_PANTRY_DIR).indicators.map((i) => i.id)
    expect(fromTools).toEqual(fromKitchen)
    // Not alphabetical — that is the whole point of reading the index rather than the directory.
    expect(fromTools).not.toEqual([...fromTools].sort())
  })

  it('lists every published data file for the font subset to sample', () => {
    const files = pantryDataFiles()
    expect(files.length).toBeGreaterThanOrEqual(12)
    expect(files.some((f: string) => f.endsWith('index.json'))).toBe(true)
    expect(files.some((f: string) => f.includes('/indicators/'))).toBe(true)
  })
})
