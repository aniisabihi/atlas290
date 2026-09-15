import type { FactFamily, Indicator, Municipality, PantryData } from '../../../shared/pantry'
import {
  extremesOf,
  longestRun,
  pointsFor,
  reversal,
  noiseBoundFor,
  shareOf,
  stepIsReal,
  type Reversal,
  type Run,
} from '../stats'
import { OBSERVATION_STATUS } from '../../../shared/pantry'
import { featuresFor, windowFor, NEIGHBOURS } from '../similar/build'
import { nearest, type Feature } from '../similar/distance'
import type { Point } from '../stats'

/**
 * The five families of fact, each finding its own candidates and ranking them by its own
 * measure.
 *
 * **There is deliberately no score that compares across families.** A 47-year run of decline
 * and a tax rate three points below a municipality's twins are both striking, and any single
 * number putting one above the other would be an invention dressed as objectivity. The strip
 * takes the best of each family instead, which is also what the architect chose for the
 * hand-written strip in Plan 4.
 *
 * Every candidate carries the figures its sentence will assert, so `phrasing.ts` never has to
 * go back to the data and the two cannot disagree.
 */

export type Candidate =
  | {
      family: 'country'
      id: string
      score: number
      indicator: Indicator
      from: number
      to: number
      matching: number
      comparable: number
      direction: 'higher' | 'lower'
    }
  | { family: 'run'; id: string; score: number; direction: 1 | -1; run: Run; codes: string[] }
  | { family: 'reversal'; id: string; score: number; code: string; reversal: Reversal }
  | {
      family: 'unusual'
      id: string
      score: number
      code: string
      indicator: Indicator
      year: number
      self: number
      peers: number
      peerCodes: string[]
    }
  | {
      family: 'extreme'
      id: string
      score: number
      indicator: Indicator
      year: number
      highest: Municipality
      lowest: Municipality
      highestValue: number
      lowestValue: number
      comparable: number
    }

type Ctx = {
  data: PantryData
  rowOf: (code: string) => number
  valueAt: (indicatorId: string, code: string, year: number) => number | null
  /** The value together with why it is what it is, for the claims that have to know. */
  pointAt: (indicatorId: string, code: string, year: number) => Point | null
  /** The last year every indicator covers, which is where a cross-indicator claim has to sit. */
  commonYear: number
}

export function contextFor(data: PantryData): Ctx {
  const rows = new Map(data.municipalities.map((m, i) => [m.code, i]))
  const series = new Map(data.series.map((s) => [s.indicator, s]))
  return {
    data,
    rowOf: (code) => rows.get(code) ?? -1,
    valueAt: (indicatorId, code, year) => {
      const s = series.get(indicatorId)
      const row = rows.get(code)
      if (!s || row === undefined) return null
      const col = s.years.indexOf(year)
      return col === -1 ? null : (s.values[row]?.[col] ?? null)
    },
    pointAt: (indicatorId, code, year) => {
      const s = series.get(indicatorId)
      const row = rows.get(code)
      if (!s || row === undefined) return null
      const col = s.years.indexOf(year)
      if (col === -1) return null
      const value = s.values[row]?.[col]
      if (value === null || value === undefined) return null
      const status = OBSERVATION_STATUS[s.status[row]?.[col] ?? 0]
      if (!status) throw new Error(`${indicatorId} ${code} ${year}: status byte out of range`)
      return { year, value, status }
    },
    commonYear: Math.min(...data.indicators.map((i) => i.coverage.to)),
  }
}

/**
 * How many municipalities moved the same way across an indicator's whole record.
 *
 * Ranked by how close to unanimous the country is — the fact worth printing is the one where
 * almost every municipality did the same thing, because that is a statement about Sweden rather
 * than about any municipality in it. "288 of 289" scores 0.497; "124 of 284", a large and
 * interesting minority, scores 0.063 and loses.
 *
 * Ties are broken by the LENGTH OF THE RECORD, not alphabetically. Three candidates come out
 * unanimous or nearly so against the committed pantry — median income since 1999, post-secondary
 * education since 1985, the tax rate since 2000 — and "every municipality, for forty years" is a
 * stronger statement than the same claim over twenty-five. Sorting by id instead would pick
 * between them on the spelling of an indicator name.
 *
 * The denominator is never assumed. Knivsta has no tax rate for 2000, so the honest claim is
 * "288 of 289" — and the first draft of this plan recorded it as "288 of 290", which is why
 * `shareOf` refuses to count a municipality it cannot ask.
 */
export function countryCandidates(ctx: Ctx): Candidate[] {
  const out: Candidate[] = []
  for (const indicator of ctx.data.indicators) {
    const from = indicator.coverage.from
    const to = indicator.coverage.to
    if (to - from < 20) continue
    for (const direction of ['higher', 'lower'] as const) {
      const share = shareOf(ctx.data.municipalities, (m) => {
        const then = ctx.pointAt(indicator.id, m.code, from)
        const now = ctx.pointAt(indicator.id, m.code, to)
        if (then === null || now === null) return null
        // The same rule runs apply: when an endpoint is perturbed and the gap between the two
        // is inside the noise bound, the direction is unknown — so the municipality cannot be
        // asked, rather than being counted as having gone the way the arithmetic happens to
        // say. The bound is in the INDICATOR'S own unit: three people for a count, and zero
        // for everything else, because three percentage points is not a noise bound, it is a
        // third of the national spread. It currently excludes nobody — no municipality's
        // 1968-to-2025 population change is within three people — and it is here for the
        // refresh where that stops being true.
        if (!stepIsReal(then, now, noiseBoundFor(indicator.unit))) return null
        return direction === 'higher' ? now.value > then.value : now.value < then.value
      })
      if (share.comparable === 0) continue
      out.push({
        family: 'country',
        id: `country-${indicator.id}-${direction}`,
        score: share.matching / share.comparable - 0.5,
        indicator,
        from,
        to,
        matching: share.matching,
        comparable: share.comparable,
        direction,
      })
    }
  }
  return out.sort((a, b) => b.score - a.score || spanOf(b) - spanOf(a) || a.id.localeCompare(b.id))
}

function spanOf(candidate: Candidate): number {
  return candidate.family === 'country' ? candidate.to - candidate.from : 0
}

/**
 * The longest unbroken stretch of growth or decline in population, and who shares it.
 *
 * Ranked by length alone. The runner-up is worth recording because it is the better sentence
 * and loses anyway: Kramfors and Strömsund fell every year from 1968 to 2015, 47 years, against
 * twelve municipalities that have grown every year since 1968, 57. Length is a rule anybody can
 * check; "which of those is more interesting" is not, and inventing a tie-break to reach the
 * answer I preferred would be exactly the dressing-up this module's header refuses.
 */
export function runCandidates(ctx: Ctx): Candidate[] {
  const series = ctx.data.series.find((s) => s.indicator === 'population')
  if (!series) return []
  const out: Candidate[] = []
  for (const direction of [1, -1] as const) {
    const runs = ctx.data.municipalities
      .map((m) => ({
        code: m.code,
        run: longestRun(pointsFor(series, ctx.rowOf(m.code)), direction),
      }))
      .filter((x): x is { code: string; run: Run } => x.run !== null)
    if (runs.length === 0) continue
    const longest = Math.max(...runs.map((r) => r.run.years))
    const shared = runs.filter((r) => r.run.years === longest)
    // Every municipality sharing the longest run must also share its span, or "since 1968"
    // would be true of some of them and false of others in the same sentence.
    const span = shared[0]!.run
    const sameSpan = shared.filter((r) => r.run.from === span.from && r.run.to === span.to)
    out.push({
      family: 'run',
      id: `run-${direction === 1 ? 'growth' : 'decline'}`,
      score: longest,
      direction,
      run: span,
      codes: sameSpan.map((r) => r.code).sort(),
    })
  }
  return out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}

/** A municipality that fell to a low point and came back, ranked by depth times recovery. */
export function reversalCandidates(ctx: Ctx): Candidate[] {
  const series = ctx.data.series.find((s) => s.indicator === 'population')
  if (!series) return []
  const out: Candidate[] = []
  for (const m of ctx.data.municipalities) {
    const r = reversal(pointsFor(series, ctx.rowOf(m.code)), {
      minFallPercent: 5,
      minRecoveryPercent: 5,
      minYearsSince: 10,
    })
    if (!r) continue
    out.push({
      family: 'reversal',
      id: `reversal-${m.code}`,
      score: -r.fall * r.recovery,
      code: m.code,
      reversal: r,
    })
  }
  return out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}

/**
 * How near a municipality's neighbours must be before it can be called unusual among them.
 *
 * The nearer half. Without it the top of this family is Stockholm, whose population sits 2.61
 * standard scores above its neighbours' — not because Stockholm is surprising but because it
 * has no close neighbours, so the residual measures the failure of the match. Those cases have
 * a mean peer distance of 1.67 to 2.88 against a median of 0.99 across all candidates.
 */
export const PEER_DISTANCE_QUANTILE = 0.5

/**
 * The municipality that least resembles the places it most resembles.
 *
 * **Leave-one-out.** All ten indicators are used to find a municipality's neighbours, so asking
 * "is its population unusual among places with a similar population" is close to
 * self-contradictory. The neighbours here are recomputed on the other nine, and the surprise is
 * measured on the tenth — which is also what makes the sentence sayable: among the places most
 * like Kävlinge in every other way, Kävlinge taxes least.
 *
 * Both sides are the ten-year windowed standard scores Plan 6 already computes, never a single
 * year. On single-year values this family collapses onto the three volatile indicators — tax
 * rate, net migration and population change — and reports spikes as facts.
 */
export function unusualCandidates(ctx: Ctx): Candidate[] {
  const window = windowFor(ctx.data)
  const full = featuresFor(ctx.data, window)
  const codeAt = (index: number) => ctx.data.municipalities[index]!.code

  const rows: Array<{ candidate: Candidate; distance: number }> = []
  for (const [held, indicator] of ctx.data.indicators.entries()) {
    const reduced: Feature[] = full.map((f) => f.filter((_, i) => i !== held))
    for (const [i, m] of ctx.data.municipalities.entries()) {
      const self = full[i]?.[held]
      if (self === null || self === undefined) continue
      const neighbours = nearest(reduced, i, NEIGHBOURS, codeAt)
      const peerScores = neighbours
        .map((n) => full[n.index]?.[held])
        .filter((v): v is number => v !== null && v !== undefined)
      if (peerScores.length < 3) continue
      const peers = peerScores.reduce((a, b) => a + b, 0) / peerScores.length
      const value = ctx.valueAt(indicator.id, m.code, window.to)
      const peerValues = neighbours
        .map((n) => ctx.valueAt(indicator.id, codeAt(n.index), window.to))
        .filter((v): v is number => v !== null)
      if (value === null || peerValues.length < 3) continue
      rows.push({
        distance: neighbours.reduce((a, b) => a + b.distance, 0) / neighbours.length,
        candidate: {
          family: 'unusual',
          id: `unusual-${m.code}-${indicator.id}`,
          score: Math.abs(self - peers),
          code: m.code,
          indicator,
          year: window.to,
          self: value,
          peers: peerValues.reduce((a, b) => a + b, 0) / peerValues.length,
          peerCodes: neighbours.map((n) => codeAt(n.index)),
        },
      })
    }
  }
  if (rows.length === 0) return []
  const sorted = [...rows].map((r) => r.distance).sort((a, b) => a - b)
  const cutoff = sorted[Math.floor(sorted.length * PEER_DISTANCE_QUANTILE)] ?? Infinity
  return rows
    .filter((r) => r.distance <= cutoff)
    .map((r) => r.candidate)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}

/**
 * The widest gap between the highest and lowest municipality on one indicator.
 *
 * Ranked by ratio rather than difference, so indicators measured in kronor do not automatically
 * beat ones measured in people per square kilometre. That means the family only accepts
 * indicators whose lowest value is above zero: a ratio against zero is infinite, and a ratio
 * against a negative number is meaningless. Net migration and population change are excluded by
 * that rule, not by preference.
 */
export function extremeCandidates(ctx: Ctx): Candidate[] {
  const out: Candidate[] = []
  for (const indicator of ctx.data.indicators) {
    const year = Math.min(ctx.commonYear, indicator.coverage.to)
    const found = extremesOf(
      ctx.data.municipalities,
      (m) => ctx.valueAt(indicator.id, m.code, year),
      (m) => m.code,
    )
    if (!found) continue
    const highestValue = ctx.valueAt(indicator.id, found.highest.code, year)!
    const lowestValue = ctx.valueAt(indicator.id, found.lowest.code, year)!
    if (lowestValue <= 0) continue
    out.push({
      family: 'extreme',
      id: `extreme-${indicator.id}`,
      score: highestValue / lowestValue,
      indicator,
      year,
      highest: found.highest,
      lowest: found.lowest,
      highestValue,
      lowestValue,
      comparable: found.comparable,
    })
  }
  return out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}

export const FAMILIES: Record<FactFamily, (ctx: Ctx) => Candidate[]> = {
  country: countryCandidates,
  run: runCandidates,
  reversal: reversalCandidates,
  unusual: unusualCandidates,
  extreme: extremeCandidates,
}
