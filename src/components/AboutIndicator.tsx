import type { Indicator } from '../../shared/pantry'
import { coveragePhrase, priceBasisYear } from '../i18n/format'
import { t } from '../i18n/strings'
import type { Lang } from '../state/url'

/**
 * The fine print, on screen rather than buried in the repository.
 *
 * The pantry carries a description, a caveat, a derivation and a source list for every indicator,
 * in both languages, and Plan 2 spent real effort making them accurate — which table was chosen
 * and which was rejected, why a mean price resting on fewer than twenty sales is withheld, that
 * medians are never summed. This is where that earns its keep.
 *
 * Collapsed by default and never truncated. The caveats are long because the truth about this
 * data is long, and cutting them off with an ellipsis would undo the point of writing them.
 *
 * Takes the whole `Indicator` rather than looking one up through the `Lookup`, because since
 * Plan 13 the lookup carries only metadata: prose lives in each indicator's own file, and this is
 * the one component that reads it. The indicator it describes is always the one on screen, which
 * is by definition the one whose file has been fetched.
 */
export function AboutIndicator({ indicator, lang }: { indicator: Indicator; lang: Lang }) {
  const strings = t(lang)
  const basis = priceBasisYear(indicator)

  return (
    <details className="about-indicator">
      {/*
       * A heading inside summary, which HTML allows: without it the h3s below sit under the
       * legend's h2 rather than under a heading of their own, and a screen reader walking the
       * page by heading level finds "Published for" nested under "Legend".
       */}
      <summary>
        <h2>{strings.aboutHeading}</h2>
      </summary>
      <p>{indicator.description[lang]}</p>

      <h3>{strings.coverageHeading}</h3>
      <p>
        {coveragePhrase(indicator, lang)}
        {basis !== null && (lang === 'sv' ? `, ${basis} års penningvärde` : `, in ${basis} kronor`)}
      </p>

      <h3>{strings.caveatHeading}</h3>
      <p>{indicator.caveat[lang]}</p>

      <h3>{strings.derivationHeading}</h3>
      <p>{indicator.derivation}</p>

      <h3>{strings.sourcesHeading}</h3>
      <ul>
        {indicator.sources.map((source) => (
          <li key={`${source.table}-${source.contentCode}`}>
            {source.table} · {source.contentCode} · {source.note}
          </li>
        ))}
      </ul>
    </details>
  )
}
