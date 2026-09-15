import {
  UNIT_DECIMALS,
  type Bilingual,
  type Indicator,
  type Municipality,
} from '../../../shared/pantry'
import type { Candidate } from './families'

/**
 * Turning a candidate into a sentence, in both languages.
 *
 * Swedish and English are written out separately rather than one being generated from the
 * other. They are not the same sentence with the words swapped — Swedish puts the measure
 * first where English wants an article, and the two count and punctuate numbers differently —
 * and a template that pretends otherwise produces text that is grammatical in one language
 * and merely parseable in the other.
 *
 * **No template says whether anything is good.** A 47-year decline is not a tragedy and 288
 * municipalities raising tax is not a scandal. The sentences state what happened and stop,
 * which is the same rule the map, the legend and the comparison already follow.
 */

const LOCALE = { sv: 'sv-SE', en: 'en-GB' } as const

function number(value: number, decimals: number, lang: 'sv' | 'en'): string {
  return new Intl.NumberFormat(LOCALE[lang], {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/** A value in its indicator's own precision — the same table the kitchen rounds the pantry to. */
function measure(value: number, indicator: Indicator, lang: 'sv' | 'en'): string {
  return number(value, UNIT_DECIMALS[indicator.unit], lang)
}

/**
 * A list of names in the reader's language: "A, B och C" against "A, B and C".
 *
 * Beyond `maxNamed` the list is replaced by a count. Twelve municipality names in one sentence
 * on a strip is not a fact anybody reads; it is a list with a number hidden in it.
 */
export const MAX_NAMED = 3

function names(municipalities: Municipality[], lang: 'sv' | 'en'): string {
  const list = municipalities.map((m) => m.name[lang])
  if (list.length === 1) return list[0]!
  const last = list[list.length - 1]!
  return `${list.slice(0, -1).join(', ')} ${lang === 'sv' ? 'och' : 'and'} ${last}`
}

export type Phrasing = { text: Bilingual; href: string; claim: string }

export function phrase(
  candidate: Candidate,
  lookup: { municipality: (code: string) => Municipality | undefined },
): Phrasing {
  switch (candidate.family) {
    case 'country': {
      const { indicator, matching, comparable, from, to, direction } = candidate
      const all = matching === comparable
      // The measure is the SUBJECT and the movement is a verb — "X has risen in N
      // municipalities" — rather than the measure being an object of "have higher…". The
      // obvious phrasing produced "Alla 284 kommuner har högre eftergymnasial utbildning än
      // 1985", which reads as though municipalities possess an education; the indicator is a
      // share of residents, and only some of the ten are things a place can have more of. A
      // verb form is grammatical for all ten in both languages without knowing which is which.
      const moved = {
        sv: direction === 'higher' ? 'stigit' : 'sjunkit',
        en: direction === 'higher' ? 'risen' : 'fallen',
      }
      const where = {
        sv: all ? `alla ${comparable} kommuner` : `${matching} av ${comparable} kommuner`,
        en: all
          ? `all ${comparable} municipalities`
          : `${matching} of ${comparable} municipalities`,
      }
      return {
        text: {
          sv: `${indicator.name.sv} har ${moved.sv} i ${where.sv} sedan ${from}.`,
          en: `${indicator.name.en} has ${moved.en} in ${where.en} since ${from}.`,
        },
        href: `/?i=${indicator.id}&y=${to}`,
        claim: `${matching} of ${comparable} ${direction} in ${to} than ${from}`,
      }
    }
    case 'run': {
      const { run, codes, direction } = candidate
      const municipalities = codes
        .map((c) => lookup.municipality(c))
        .filter((m): m is Municipality => m !== undefined)
      const named = municipalities.length <= MAX_NAMED
      const who = named
        ? { sv: names(municipalities, 'sv'), en: names(municipalities, 'en') }
        : { sv: `${municipalities.length} kommuner`, en: `${municipalities.length} municipalities` }
      const verb = {
        sv: direction === 1 ? 'vuxit' : 'krympt',
        en: direction === 1 ? 'grown' : 'shrunk',
      }
      return {
        text: {
          sv: `${who.sv} har ${verb.sv} varje år sedan ${run.from} — ${run.years} år i rad.`,
          en: `${who.en} ${named && municipalities.length === 1 ? 'has' : 'have'} ${verb.en} every year since ${run.from} — ${run.years} years running.`,
        },
        href: `/?i=population&y=${run.to}${named && municipalities[0] ? `&m=${municipalities[0].code}` : ''}`,
        claim: `${direction === 1 ? 'growth' : 'decline'} ${run.years} years ${run.from}-${run.to}, ${codes.length} municipalities`,
      }
    }
    case 'reversal': {
      const { reversal: r, code } = candidate
      const municipality = lookup.municipality(code)
      const who = municipality?.name ?? { sv: code, en: code }
      const fall = Math.round(-r.fall)
      const back = Math.round(r.recovery)
      return {
        text: {
          sv: `${who.sv} var ${fall} % mindre ${r.trough.year} än ${r.peak.year} — och är nu ${back} % större än då.`,
          en: `${who.en} was ${fall}% smaller in ${r.trough.year} than in ${r.peak.year} — and is now ${back}% larger than that low.`,
        },
        href: `/?i=population&y=${r.trough.year}&m=${code}`,
        claim: `${code} peak ${r.peak.year} trough ${r.trough.year} fall ${fall}% recovery ${back}%`,
      }
    }
    case 'unusual': {
      const { code, indicator, self, peers, year } = candidate
      const municipality = lookup.municipality(code)
      const who = municipality?.name ?? { sv: code, en: code }
      const lower = self < peers
      const name = {
        sv: indicator.name.sv.toLocaleLowerCase('sv-SE'),
        en: indicator.name.en.toLocaleLowerCase('en-GB'),
      }
      return {
        text: {
          sv: `${who.sv} har ${lower ? 'lägre' : 'högre'} ${name.sv} än platserna som liknar den: ${measure(self, indicator, 'sv')} mot ${measure(peers, indicator, 'sv')}.`,
          en: `${who.en} has ${lower ? 'lower' : 'higher'} ${name.en} than the places most like it: ${measure(self, indicator, 'en')} against ${measure(peers, indicator, 'en')}.`,
        },
        href: `/?i=${indicator.id}&y=${year}&m=${code}`,
        claim: `${code} ${indicator.id} ${year}: ${self} vs peers ${peers}`,
      }
    }
    case 'extreme': {
      const { indicator, year, highest, lowest, highestValue, lowestValue, comparable } = candidate
      const times = Math.round(highestValue / lowestValue)
      const name = {
        sv: indicator.name.sv.toLocaleLowerCase('sv-SE'),
        en: indicator.name.en.toLocaleLowerCase('en-GB'),
      }
      return {
        text: {
          sv: `${highest.name.sv} har ${number(times, 0, 'sv')} gånger så hög ${name.sv} som ${lowest.name.sv}: ${measure(highestValue, indicator, 'sv')} mot ${measure(lowestValue, indicator, 'sv')}.`,
          en: `${highest.name.en} has ${number(times, 0, 'en')} times the ${name.en} of ${lowest.name.en}: ${measure(highestValue, indicator, 'en')} against ${measure(lowestValue, indicator, 'en')}.`,
        },
        href: `/?i=${indicator.id}&y=${year}&m=${highest.code}`,
        claim: `${indicator.id} ${year}: ${highest.code} ${highestValue} vs ${lowest.code} ${lowestValue}, of ${comparable}`,
      }
    }
  }
}
