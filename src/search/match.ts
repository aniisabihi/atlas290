import type { Municipality } from '../../shared/pantry'
import type { Lang } from '../state/url'

/**
 * Finding a municipality by name.
 *
 * All 290 names are byte-identical in Swedish and English — verified against the published
 * pantry — so this is not a translation problem. It is a diacritics problem: someone on a
 * keyboard without å, ä and ö must still be able to find Malmö, Ängelholm and Östersund. Both the
 * query and the name are folded to their unaccented form before matching.
 *
 * Sorting uses the **Swedish** collation whatever the interface language, because the names are
 * Swedish in both editions and å, ä and ö belong at the end of the alphabet rather than filed
 * under a and o. Sorting Swedish place names by English rules puts Åre before Uppsala, which is
 * wrong in a way a Swedish reader notices immediately.
 */

export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

const CODE = /^\d{4}$/

export type Match = { municipality: Municipality; tier: number }

export function searchMunicipalities(
  query: string,
  municipalities: readonly Municipality[],
  lang: Lang,
): Municipality[] {
  const trimmed = query.trim()
  // An empty box is not a search for everything; it is not a search.
  if (trimmed === '') return []

  if (CODE.test(trimmed)) {
    const exact = municipalities.find((m) => m.code === trimmed)
    return exact ? [exact] : []
  }

  const needle = fold(trimmed)
  // What was typed, letter for letter. Folding decides WHETHER a name is offered — nobody should
  // have to find the ö key — but it used to decide the order too, so "sö" put Sollefteå,
  // Sollentuna and Solna above every name that actually begins "Sö". Within a tier, a name that
  // starts with the literal query now comes first.
  const literal = trimmed.toLocaleLowerCase('sv')
  const matches: Array<Match & { exact: boolean }> = []
  for (const municipality of municipalities) {
    const name = fold(municipality.name[lang])
    const tier = name === needle ? 0 : name.startsWith(needle) ? 1 : name.includes(needle) ? 2 : -1
    const exact = municipality.name[lang].toLocaleLowerCase('sv').startsWith(literal)
    if (tier >= 0) matches.push({ municipality, tier, exact })
  }

  return matches
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        Number(b.exact) - Number(a.exact) ||
        a.municipality.name[lang].localeCompare(b.municipality.name[lang], 'sv'),
    )
    .map((m) => m.municipality)
}
