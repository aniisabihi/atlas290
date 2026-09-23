import { t } from '../i18n/strings'
import type { Lang } from '../state/url'
import { useTheme } from '../state/theme'

/**
 * The theme switch.
 *
 * The label names what pressing it will do, not what the page currently is — "Dark" on a light
 * page — because a control that describes its own state reads as a statement rather than an
 * offer. `aria-pressed` carries the state for anyone who wants it stated outright.
 */
export function ThemeToggle({ lang }: { lang: Lang }) {
  const strings = t(lang)
  const { theme, setTheme } = useTheme()
  const dark = theme === 'dark'

  return (
    <button
      type="button"
      className="theme-toggle"
      // No aria-pressed: the name states the ACTION, and a pressed state beside it made a screen
      // reader announce "Switch to the light theme, pressed" — two claims that disagree.
      aria-label={dark ? strings.switchToLight : strings.switchToDark}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {dark ? (
          <path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5a8.5 8.5 0 1 0 10.8 10.8Z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 2.5v2.2M12 19.3v2.2M4.2 12H2M22 12h-2.2M6.3 6.3 4.8 4.8M19.2 19.2l-1.5-1.5M17.7 6.3l1.5-1.5M4.8 19.2l1.5-1.5" />
          </>
        )}
      </svg>
      <span>{dark ? strings.themeToLight : strings.themeToDark}</span>
    </button>
  )
}
