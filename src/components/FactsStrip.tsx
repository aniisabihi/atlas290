import { FACTS } from '../facts/facts'
import { t } from '../i18n/strings'
import type { Lang } from '../state/url'

/**
 * Five things nobody thought to ask, each one link away from the view that proves it.
 *
 * The links are real anchors into the site's own URL state, so they work without JavaScript, can
 * be opened in a new tab, and land on a view the visitor can then drive themselves — which is the
 * difference between a fact and a claim.
 */
export function FactsStrip({ lang }: { lang: Lang }) {
  return (
    <section className="facts panel" aria-labelledby="facts-heading">
      <h2 id="facts-heading">{t(lang).factsHeading}</h2>
      <ul>
        {FACTS.map((fact) => (
          <li key={fact.id}>
            <a href={`/${lang}${fact.href}`}>{fact.text[lang]}</a>
          </li>
        ))}
      </ul>
    </section>
  )
}
