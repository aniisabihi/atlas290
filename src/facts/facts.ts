import { observationAt, type Lookup } from '../data/select'
import type { Lang } from '../state/url'

/**
 * Five hand-written facts, each a link straight into the view that proves it.
 *
 * **Every fact carries a check that re-derives its own claim from the pantry.** A confident
 * sentence on the front page that the data no longer supports would be worse than no sentence at
 * all, and a monthly data refresh is exactly when that happens. `facts.test.ts` runs every check,
 * so a refresh that falsifies a fact fails the build rather than quietly publishing a lie.
 *
 * The claim is written in a form the check can reproduce exactly, so the two cannot drift: the
 * test asserts that `check(pantry)` equals `claim`, and a failure prints both.
 */
export type Fact = {
  id: string
  text: Record<Lang, string>
  /** Where the fact can be seen. Parsed and validated by the tests, never hand-checked. */
  href: string
  /** What this fact says, in a form the pantry can be asked to confirm. */
  claim: string
  check: (lk: Lookup) => string
}

const value = (lk: Lookup, indicator: string, code: string, year: number): number => {
  const { value: v } = observationAt(lk, indicator, code, year)
  if (v === null) throw new Error(`fact check: no ${indicator} for ${code} in ${year}`)
  return v
}

const percentChange = (from: number, to: number) => Math.round(((to - from) / from) * 100)

export const FACTS: Fact[] = [
  {
    id: 'fastest-and-slowest',
    text: {
      sv: 'Håbo har vuxit 406 % sedan 1968. Åsele har krympt 53 %.',
      en: 'Håbo has grown 406% since 1968. Åsele has shrunk 53%.',
    },
    href: '/?i=population&y=2024&m=0305',
    claim: 'Håbo +406%, Åsele -53%',
    check: (lk) =>
      `Håbo ${percentChange(value(lk, 'population', '0305', 1968), value(lk, 'population', '0305', 2024)) >= 0 ? '+' : ''}${percentChange(value(lk, 'population', '0305', 1968), value(lk, 'population', '0305', 2024))}%, ` +
      `Åsele ${percentChange(value(lk, 'population', '2463', 1968), value(lk, 'population', '2463', 2024))}%`,
  },
  {
    id: 'emptier-than-1968',
    text: {
      sv: '124 av 284 kommuner har färre invånare i dag än 1968.',
      en: '124 of 284 municipalities have fewer people today than in 1968.',
    },
    href: '/?i=population-change&y=2024',
    claim: '124 of 284',
    check: (lk) => {
      let comparable = 0
      let smaller = 0
      for (const m of lk.data.municipalities) {
        const then = observationAt(lk, 'population', m.code, 1968).value
        const now = observationAt(lk, 'population', m.code, 2024).value
        // Six municipalities did not exist in 1968, so they are not part of the denominator —
        // "124 of 290" would be the easy and wrong way to say this.
        if (then === null || now === null) continue
        comparable += 1
        if (now < then) smaller += 1
      }
      return `${smaller} of ${comparable}`
    },
  },
  {
    id: 'oldest-and-youngest',
    text: {
      sv: 'Borgholms genomsnittliga invånare är 53,3 år. Knivstas är 37,8.',
      en: "Borgholm's average resident is 53.3 years old. Knivsta's is 37.8.",
    },
    href: '/?i=mean-age&y=2025&m=0885',
    claim: 'Borgholm 53.3, Knivsta 37.8',
    check: (lk) =>
      `Borgholm ${value(lk, 'mean-age', '0885', 2025)}, Knivsta ${value(lk, 'mean-age', '0330', 2025)}`,
  },
  {
    id: 'house-price-gap',
    text: {
      sv: 'Ett hus i Danderyd kostar 22 gånger så mycket som ett i Malå.',
      en: 'A house in Danderyd costs 22 times one in Malå.',
    },
    href: '/?i=house-prices&y=2025&m=0162',
    claim: '22 times',
    check: (lk) =>
      `${Math.round(value(lk, 'house-prices', '0162', 2025) / value(lk, 'house-prices', '2418', 2025))} times`,
  },
  {
    id: 'emptiest-and-densest',
    text: {
      sv: 'Arjeplog har 0,2 invånare per kvadratkilometer. Sundbyberg har 6 529.',
      en: 'Arjeplog has 0.2 people per square kilometre. Sundbyberg has 6,529.',
    },
    href: '/?i=density&y=2025&m=2506',
    claim: 'Arjeplog 0.2, Sundbyberg 6529',
    check: (lk) =>
      `Arjeplog ${value(lk, 'density', '2506', 2025)}, Sundbyberg ${Math.round(value(lk, 'density', '0183', 2025))}`,
  },
]
