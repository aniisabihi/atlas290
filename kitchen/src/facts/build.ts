import {
  FACT_FAMILIES,
  type Facts,
  type Municipality,
  type PantryData,
} from '../../../shared/pantry'
import { contextFor, FAMILIES } from './families'
import { phrase } from './phrasing'

/**
 * The facts strip, built.
 *
 * One fact from each of the five families, in the order the families are declared — which is
 * roughly widest to narrowest: the country, then a stretch of years, then one municipality's
 * history, then one municipality against its twins, then the two ends of the map.
 *
 * Refuses to publish rather than publishing something thin. All three guards below describe
 * failures that would render perfectly: a strip of four, a fact with no link, a sentence with
 * an empty number in it. Nobody wrote these sentences, so nobody will notice them.
 */
export function buildFacts(data: PantryData): Facts {
  const ctx = contextFor(data)
  const municipalities = new Map(data.municipalities.map((m) => [m.code, m]))
  const lookup = {
    municipality: (code: string): Municipality | undefined => municipalities.get(code),
  }

  const facts: Facts['facts'] = []
  for (const family of FACT_FAMILIES) {
    const best = FAMILIES[family](ctx)[0]
    if (!best) {
      throw new Error(
        `facts: the '${family}' family found no candidate at all, so the strip would be short ` +
          'a fact rather than wrong — which is worse, because it looks fine',
      )
    }
    const { text, href, claim } = phrase(best, lookup)
    facts.push({ id: best.id, family, text, href, claim })
  }

  assertUsable(facts)
  return { schemaVersion: 1, facts }
}

export function assertUsable(facts: Facts['facts']): void {
  if (facts.length !== FACT_FAMILIES.length) {
    throw new Error(`facts: ${facts.length} facts for ${FACT_FAMILIES.length} families`)
  }
  for (const fact of facts) {
    for (const lang of ['sv', 'en'] as const) {
      const sentence = fact.text[lang]
      // A template that lost a value renders it as the literal string below, or leaves the
      // space where a number should be. Both read as a typo rather than as a broken build.
      if (/undefined|NaN|Infinity/.test(sentence)) {
        throw new Error(
          `facts: ${fact.id} (${lang}) contains a value that is not a number: ${sentence}`,
        )
      }
      if (!/\d/.test(sentence)) {
        throw new Error(`facts: ${fact.id} (${lang}) states no figure at all: ${sentence}`)
      }
      if (!sentence.trimEnd().endsWith('.')) {
        throw new Error(`facts: ${fact.id} (${lang}) is not a finished sentence: ${sentence}`)
      }
    }
    if (fact.text.sv === fact.text.en) {
      throw new Error(`facts: ${fact.id} reads identically in both languages: ${fact.text.sv}`)
    }
  }
}
