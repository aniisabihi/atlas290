import type { Similar } from '../../shared/pantry'

/**
 * Reading "places like this" out of the published file.
 *
 * Deliberately thin. The metric lives in the kitchen and the site is not allowed a second
 * opinion about it — every claim the panel makes about how the neighbours were found is read
 * off `method`, so the kitchen changing the window or the transform cannot leave the site
 * describing a method it no longer uses.
 */

/**
 * The codes of the municipalities most like `code`, or an empty list if it has none.
 *
 * Empty rather than a throw: a municipality can legitimately be missing from the file — a new
 * one, or one the kitchen could not compare — and a profile panel that crashes rather than
 * omitting one section would be a worse failure than the missing section.
 *
 * The ORDER is the ascending distance the kitchen computed, but nothing rendered may present
 * it as a ranking: the gap between the fifth and sixth nearest has a measured median of 0.032
 * against typical distances near 1.0, and a minimum of exactly 0.000.
 */
export function similarTo(similar: Similar, code: string): readonly string[] {
  return similar.nearest[code] ?? []
}

/**
 * Whether two municipalities are each other's neighbours.
 *
 * Exists to stop anything wording the relationship as symmetric by accident: it is mutual for
 * only 55% of the 1,450 relationships in the published file. Nothing may say "X and Y are
 * alike" from one direction alone.
 */
export function isMutual(similar: Similar, a: string, b: string): boolean {
  return similarTo(similar, a).includes(b) && similarTo(similar, b).includes(a)
}
