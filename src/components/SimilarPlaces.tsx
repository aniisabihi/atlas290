import type { Similar } from '../../shared/pantry'
import { similarTo } from '../data/similar'
import type { Lookup } from '../data/select'
import { t } from '../i18n/strings'
import { toUrl, type AppState, type PantryMeta } from '../state/url'

/**
 * The five municipalities most like this one.
 *
 * **Presented as a set, never as a ranking.** No ordinals, no numbering, no distances. The
 * kitchen's order is real but the gaps between adjacent entries are not: the measured median
 * gap between the fifth and sixth nearest is 0.032 against typical distances near 1.0, with a
 * minimum of exactly 0.000. "The third most similar" would be a claim the arithmetic does not
 * support, and a number to two decimals would invite the reader to take the ordering seriously.
 *
 * The method line is rendered from the published `method` object rather than written here, so
 * changing the window or the indicator set in the kitchen cannot leave a stale sentence behind
 * in the site.
 *
 * Real anchors, not buttons: they carry the full URL state, so middle-click and "open in new
 * tab" work the way they do everywhere else on this site, and a visitor can hold one
 * municipality open while opening another beside it.
 */
export function SimilarPlaces({
  lk,
  similar,
  meta,
  state,
  lang,
  onHighlight,
}: {
  lk: Lookup
  similar: Similar
  meta: PantryMeta
  /** The current state, so each link keeps the indicator and year the visitor is looking at. */
  state: AppState
  lang: AppState['lang']
  /**
   * Points the map at the neighbour under the pointer. Five names are five places a visitor has
   * no way to find on a map of 290 shapes; this is how the list and the map become one thing.
   * Transient, and deliberately not URL state.
   */
  onHighlight?: (code: string | null) => void
}) {
  const strings = t(lang)
  const codes = similarTo(similar, state.selected ?? '')
  if (codes.length === 0) return null

  return (
    <section className="similar" aria-labelledby="similar-heading">
      <h3 id="similar-heading">{strings.similarHeading}</h3>
      <ul className="similar-list">
        {codes.map((code) => {
          const municipality = lk.municipality(code)
          if (!municipality) return null
          return (
            <li key={code}>
              {/*
               * The comparison partner is deliberately cleared. Carrying `compare` across
               * would leave the new municipality compared against whatever the previous one
               * was compared against, which is a statement nobody asked for.
               */}
              <a
                href={toUrl({ ...state, selected: code, compare: null }, meta)}
                // Focus as well as hover, so the keyboard gets the same answer as the pointer.
                onMouseEnter={() => onHighlight?.(code)}
                onMouseLeave={() => onHighlight?.(null)}
                onFocus={() => onHighlight?.(code)}
                onBlur={() => onHighlight?.(null)}
              >
                {municipality.name[lang]}
              </a>
            </li>
          )
        })}
      </ul>
      <p className="similar-method">
        {strings.similarMethod(
          similar.method.indicators.length,
          similar.method.window.from,
          similar.method.window.to,
        )}
      </p>
    </section>
  )
}
