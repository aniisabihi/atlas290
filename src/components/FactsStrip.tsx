import type { Facts } from '../../shared/pantry'
import { factsFrom } from '../facts/facts'
import { t } from '../i18n/strings'
import type { Lang } from '../state/url'
import type { Strings } from '../i18n/strings'

/**
 * Each family gets its own label rather than a number. The five facts are not a sequence — there
 * is deliberately no score ranking them against each other (decision 0003) — so `01 02 03` would
 * be structure the content does not have. The family is true information, and it says out loud
 * that something went looking.
 */
const FAMILY_LABEL: Record<string, keyof Strings> = {
  country: 'familyCountry',
  run: 'familyRun',
  reversal: 'familyReversal',
  unusual: 'familyUnusual',
  extreme: 'familyExtreme',
}

/**
 * The municipality a fact's link lands on, if it lands on one.
 *
 * Read from the href rather than from a new field in the pantry: the link is already the claim's
 * proof, so whatever it selects is by definition what the sentence is about, and no fact file
 * has to be republished for the map to follow along.
 */
export function municipalityInHref(href: string): string | null {
  const query = href.slice(href.indexOf('?') + 1)
  return new URLSearchParams(query).get('m')
}

/**
 * Five things nobody thought to ask, each one link away from the view that proves it.
 *
 * The links are real anchors into the site's own URL state, so they work without JavaScript, can
 * be opened in a new tab, and land on a view the visitor can then drive themselves — which is the
 * difference between a fact and a claim.
 *
 * Since Plan 7 nobody wrote these sentences: the kitchen finds them, one from each of five
 * families, and publishes them with the figures each asserts. This component renders whatever
 * the file holds and chooses nothing.
 */
export function FactsStrip({
  lang,
  facts,
  onHighlight,
}: {
  lang: Lang
  facts: Facts
  /** Rings the municipality a fact is about while the pointer is on it. Not URL state. */
  onHighlight?: (code: string | null) => void
}) {
  return (
    <section className="facts panel" aria-labelledby="facts-heading">
      <h2 id="facts-heading">{t(lang).factsHeading}</h2>
      <ul>
        {factsFrom(facts).map((fact) => (
          <li key={fact.id}>
            {FAMILY_LABEL[fact.family] && (
              <p className="fact-family">{t(lang)[FAMILY_LABEL[fact.family]!] as string}</p>
            )}
            <a
              href={`/${lang}${fact.href}`}
              onMouseEnter={() => onHighlight?.(municipalityInHref(fact.href))}
              onMouseLeave={() => onHighlight?.(null)}
              onFocus={() => onHighlight?.(municipalityInHref(fact.href))}
              onBlur={() => onHighlight?.(null)}
            >
              {fact.text[lang]}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
