import { describe, expect, it } from 'vitest'
import { DEFAULT_PANTRY_DIR, readPantryParts } from '../publish'
import { FACT_FAMILIES, Facts } from '../../../shared/pantry'
import { assertUsable, buildFacts } from './build'

/** The published pantry, reassembled from the files the kitchen writes (Plan 13). */
const publishedPantry = readPantryParts(DEFAULT_PANTRY_DIR)

const data = publishedPantry
const built = buildFacts(data)

describe('buildFacts', () => {
  it('produces exactly one fact from each of the five families', () => {
    expect(built.facts).toHaveLength(FACT_FAMILIES.length)
    expect(built.facts.map((f) => f.family)).toEqual([...FACT_FAMILIES])
  })

  it('passes its own published schema', () => {
    expect(() => Facts.parse(built)).not.toThrow()
  })

  it('is deterministic — the same pantry builds the same file', () => {
    expect(buildFacts(data)).toEqual(built)
  })

  it('gives every fact a stable id naming what it is about', () => {
    expect(built.facts.map((f) => f.id)).toEqual([
      'country-post-secondary-education-gap-higher',
      'run-growth',
      'reversal-0183',
      'unusual-1261-tax-rate',
      'extreme-density',
    ])
  })
})

describe('assertUsable', () => {
  const ok = built.facts

  it('accepts the real strip', () => {
    expect(() => assertUsable(ok)).not.toThrow()
  })

  it('refuses a strip that is short a fact', () => {
    // It would render perfectly: four items instead of five, and nobody wrote them, so
    // nobody would notice.
    expect(() => assertUsable(ok.slice(0, 4))).toThrow(/4 facts for 5 families/)
  })

  it('refuses a sentence carrying a value that is not a number', () => {
    const broken = [...ok]
    broken[0] = { ...ok[0]!, text: { sv: 'Folkmängden steg med undefined %.', en: ok[0]!.text.en } }
    expect(() => assertUsable(broken)).toThrow(/contains a value that is not a number/)
  })

  it('refuses a sentence that states no figure at all', () => {
    const broken = [...ok]
    broken[0] = { ...ok[0]!, text: { sv: 'Något hände i Sverige.', en: ok[0]!.text.en } }
    expect(() => assertUsable(broken)).toThrow(/states no figure at all/)
  })

  it('refuses an unfinished sentence', () => {
    const broken = [...ok]
    broken[0] = { ...ok[0]!, text: { sv: 'Folkmängden steg i 284 kommuner', en: ok[0]!.text.en } }
    expect(() => assertUsable(broken)).toThrow(/is not a finished sentence/)
  })

  it('refuses a fact that reads identically in both languages', () => {
    // Which is what an untranslated template looks like from the outside.
    const broken = [...ok]
    broken[0] = { ...ok[0]!, text: { sv: ok[0]!.text.en, en: ok[0]!.text.en } }
    expect(() => assertUsable(broken)).toThrow(/reads identically in both languages/)
  })
})
