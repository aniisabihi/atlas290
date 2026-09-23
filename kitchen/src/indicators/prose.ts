import type { Bilingual } from '../../../shared/pantry'

/**
 * A piece of indicator prose that reads the same in both languages — "1968–2024", "Kon=2",
 * "2015, 2020, 200 m" — written once rather than twice.
 *
 * Only for text with nothing to translate. `registry.test.ts` checks every published note whose
 * two languages are identical and refuses any that contains a word, so this cannot become a way
 * of putting English on the Swedish page again (issue #48).
 *
 * Its own module, importing nothing that runs, because every indicator module uses it and the
 * registry's import graph is circular by necessity — see the note above `ensureRegistered`.
 */
export function neutral(text: string): Bilingual {
  return { sv: text, en: text }
}
