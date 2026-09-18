import type { IndicatorMeta } from '../../shared/pantry'
import { observationAt, ranksFor, type Lookup } from '../data/select'
import { formatValue, formatWithUnit } from '../i18n/format'
import type { Lang } from '../state/url'

/**
 * A municipality's own story, in sentences, generated from rules rather than written by hand
 * for each of the 290.
 *
 * **Its own story, not a comparison with anywhere else.** Every claim here is about this place
 * and the figures the profile panel already draws beside it, so a sentence stays true whatever
 * the similarity metric later becomes, and a reader can check any of it against the sparkline
 * on the same row.
 *
 * **A rule that cannot state its claim truthfully says nothing.** There is no filler: a
 * municipality whose population has never turned gets no turning-point sentence, and one that
 * is unremarkable on all ten measures gets no standing sentence. Two of the three rules
 * decline for a substantial minority — measured against the committed pantry at 2024, the arc
 * fires for all 290, the turn for 127 and the standing for 185 — which is the point rather
 * than a defect.
 *
 * **Every rule carries a check that re-derives its own claim**, exactly as `src/facts/facts.ts`
 * does and for the same reason: a monthly refresh is when a confident sentence quietly becomes
 * false, and `story.test.ts` runs the checks so that happens as a red build rather than as a
 * lie on the page.
 */

export type Sentence = {
  id: 'arc' | 'turn' | 'standing'
  text: Record<Lang, string>
  /** What this sentence says, in a form the pantry can be asked to confirm. */
  claim: string
}

/** A municipality's whole published history for one indicator, absences removed. */
type Point = { year: number; value: number }

function history(lk: Lookup, indicatorId: string, code: string): Point[] {
  const series = lk.series(indicatorId)
  const row = lk.rowOf(code)
  if (row === undefined) return []
  const points: Point[] = []
  for (const [col, year] of series.years.entries()) {
    const value = series.values[row]?.[col]
    if (value === null || value === undefined) continue
    points.push({ year, value })
  }
  return points
}

const percent = (from: number, to: number) => Math.round(((to - from) / from) * 100)

/**
 * How far a rank is from the nearer end of the field, as a share of the field.
 *
 * 1 of 290 and 290 of 290 both score 0.0034; 145 of 290 scores 0.5. So "extreme" means near
 * either end, with no implication that either end is the good one — there is no
 * "higher is better" anywhere in this project.
 */
function extremity(rank: number, outOf: number): number {
  return Math.min(rank, outOf - rank + 1) / outOf
}

/**
 * How near an end a rank must be before the standing sentence will claim anything.
 *
 * A tenth. Measured against the committed pantry for 2024: 116 of 290 municipalities have a
 * rank inside the top or bottom 5% of some indicator, 185 inside 10%, and 256 inside 20%. A
 * fifth would fire for almost everyone and so would say almost nothing; a twentieth would
 * leave 60% of the country with no sentence at all.
 */
export const EXTREME_SHARE = 0.1

/**
 * Rule 1 — the arc. What the population has done across the whole published record.
 *
 * Uses the municipality's OWN first published year rather than 1968, and says which year that
 * is, because six municipalities did not exist in 1968: Knivsta from 2003, Nykvarn from 1999,
 * Bollebygd and Lekeberg from 1995. "Since 1968" would be false for all of them.
 */
function arc(lk: Lookup, code: string, year: number, lang: Lang): Sentence | null {
  const points = history(lk, 'population', code).filter((p) => p.year <= year)
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last || first.year === last.year || first.value === 0) return null

  const change = percent(first.value, last.value)
  const population = lk.indicator('population')
  const from = formatValue(first.value, population, lang)
  const to = formatValue(last.value, population, lang)
  const size = Math.abs(change)

  const text: Record<Lang, string> =
    change > 0
      ? {
          sv: `Kommunen har vuxit ${size} % sedan ${first.year}, från ${from} till ${to} invånare.`,
          en: `It has grown ${size}% since ${first.year}, from ${from} to ${to} residents.`,
        }
      : change < 0
        ? {
            sv: `Kommunen har krympt ${size} % sedan ${first.year}, från ${from} till ${to} invånare.`,
            en: `It has shrunk ${size}% since ${first.year}, from ${from} to ${to} residents.`,
          }
        : {
            sv: `Kommunen har lika många invånare som ${first.year}: ${to}.`,
            en: `It has as many residents as in ${first.year}: ${to}.`,
          }

  return { id: 'arc', text, claim: `${first.year} ${first.value} -> ${last.year} ${last.value}` }
}

/**
 * Rule 2 — the turn. The year the population peaked, when that is a real turning point.
 *
 * Declines when the peak is the first or last published year, because "it peaked in its first
 * year" is a restatement of rule 1 rather than a second fact. Measured against the committed
 * pantry, the peak is interior for 160 of 290; 55 peak in their first year and 75 in their
 * last. The fall threshold below then declines a further 33, leaving 127.
 *
 * Declines again when the fall since the peak rounds to nothing. The first version of this
 * rule told Håbo "its largest population was in 2023 — 0% more than today", on a peak of
 * 22,974 against 22,973 now. One person is not a turning point, and a sentence whose own
 * figure is zero is worse than no sentence.
 *
 * Ties go to the EARLIEST peak year. A municipality that touched the same maximum twice turned
 * at the first one.
 */
export const MIN_FALL_PERCENT = 1

function turn(lk: Lookup, code: string, year: number, lang: Lang): Sentence | null {
  const points = history(lk, 'population', code).filter((p) => p.year <= year)
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last || points.length < 3) return null

  let peak = first
  for (const p of points) if (p.value > peak.value) peak = p
  if (peak.year === first.year || peak.year === last.year) return null

  const fall = Math.abs(percent(peak.value, last.value))
  if (fall < MIN_FALL_PERCENT) return null

  const population = lk.indicator('population')
  const at = formatWithUnit(peak.value, population, lang)
  return {
    id: 'turn',
    text: {
      sv: `Folkmängden var som störst ${peak.year}, ${at} — ${fall} % fler än i dag.`,
      en: `Its population peaked in ${peak.year}, at ${at} — ${fall}% more than today.`,
    },
    claim: `peak ${peak.year} ${peak.value}`,
  }
}

/**
 * Rule 3 — where it stands. The one measure this municipality is furthest out on.
 *
 * Says "highest" or "lowest" and nothing about whether that is good. Names the denominator
 * rather than assuming 290, because house prices are suppressed for too few sales in five
 * municipalities and "of 290" would simply be untrue there.
 *
 * **The measure is named first, then the standing.** The obvious phrasing — "landets högsta
 * X" — puts the indicator name inside a Swedish possessive superlative, where the adjective
 * inside the name then has to agree: it produced "landets 2:e högsta eftergymnasial
 * utbildning", which should be "eftergymnasiala". The names come from the pantry and there is
 * no reliable way to inflect an arbitrary one from the outside. Naming the measure first, and
 * using the uninflected predicative form (`högst`/`lägst`, never `högsta`/`lägsta`), is
 * grammatical for every one of the ten in both languages without any agreement at all.
 *
 * Ties in extremity are broken by the pantry's own indicator order, so the sentence is stable
 * across rebuilds rather than depending on object iteration order.
 */
function standing(lk: Lookup, code: string, year: number, lang: Lang): Sentence | null {
  let best: { indicator: IndicatorMeta; rank: number; outOf: number; share: number } | null = null
  for (const indicator of lk.data.indicators) {
    const { value } = observationAt(lk, indicator.id, code, year)
    if (value === null) continue
    const rank = ranksFor(lk, indicator.id, year).get(code)
    if (!rank) continue
    const share = extremity(rank.rank, rank.outOf)
    if (share > EXTREME_SHARE) continue
    if (!best || share < best.share) best = { indicator, ...rank, share }
  }
  if (!best) return null

  const { indicator, rank, outOf } = best
  const fromTop = rank <= outOf - rank + 1
  const place = fromTop ? rank : outOf - rank + 1
  const name = indicator.name[lang]

  const end = fromTop ? 'högst' : 'lägst'
  // Swedish has a word for second-highest and it is not "2:a högst".
  const sv = place === 1 ? end : place === 2 ? `näst ${end}` : `${place}${ordinalSv(place)} ${end}`
  const en =
    place === 1
      ? fromTop
        ? 'the highest'
        : 'the lowest'
      : `the ${place}${ordinalEn(place)} ${fromTop ? 'highest' : 'lowest'}`

  return {
    id: 'standing',
    text: {
      sv: `${name} — ${sv} i landet, av ${outOf} kommuner med siffror för ${year}.`,
      en: `${name} — ${en} in the country, of ${outOf} municipalities with figures for ${year}.`,
    },
    claim: `${indicator.id} ${rank} of ${outOf}`,
  }
}

/**
 * Swedish writes första with ":a" and every later ordinal with ":e". Second never reaches this
 * function — "näst högst" is handled above — so the ":a" case is first only.
 */
function ordinalSv(n: number): string {
  return n === 1 ? ':a' : ':e'
}

function ordinalEn(n: number): string {
  const last2 = n % 100
  if (last2 >= 11 && last2 <= 13) return 'th'
  const last = n % 10
  return last === 1 ? 'st' : last === 2 ? 'nd' : last === 3 ? 'rd' : 'th'
}

/** The rules, in the order they are read. */
export const RULES = [arc, turn, standing] as const

export function storyFor(lk: Lookup, code: string, year: number, lang: Lang): Sentence[] {
  return RULES.map((rule) => rule(lk, code, year, lang)).filter((s): s is Sentence => s !== null)
}
