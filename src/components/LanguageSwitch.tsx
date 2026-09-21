import { t } from '../i18n/strings'
import { toUrl, type AppState, type PantryMeta } from '../state/url'

/**
 * A real link, not a button.
 *
 * `/sv/` and `/en/` are separate documents with their own `lang` and their own title, so
 * switching language is a navigation rather than a state change. Written as an anchor it works
 * without JavaScript, opens in a new tab if someone middle-clicks it, appears in history the way
 * a page change should, and carries the current view across so nobody loses their place.
 */
export function LanguageSwitch({ state, meta }: { state: AppState; meta: PantryMeta }) {
  const other = state.lang === 'sv' ? 'en' : 'sv'
  return (
    <a
      className="language-switch"
      href={toUrl({ ...state, lang: other }, meta)}
      hrefLang={other}
      lang={other}
      aria-label={t(state.lang).switchLanguage}
    >
      {/* A globe, drawn like the theme switch's sun and moon, so the two chips are one pair. */}
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" />
      </svg>
      {t(state.lang).otherLanguage}
    </a>
  )
}
