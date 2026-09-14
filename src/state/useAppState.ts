import { useCallback, useEffect, useState } from 'react'
import { parseState, toUrl, type AppState, type PantryMeta } from './url'

/**
 * The URL is the state, so this hook is the only place that writes to history.
 *
 * Language is deliberately NOT updatable here: switching language is a navigation to a different
 * page (`/sv/` and `/en/` are separate documents with their own `lang` and title), so it is a
 * real link rather than a history entry this hook pushes.
 */
export type UpdateOptions = {
  /**
   * Replace the current history entry instead of adding one. Playback uses this: stepping
   * through 59 years would otherwise leave 58 entries behind it and make the back button
   * useless, when what a visitor wants back is wherever they were before they pressed play.
   */
  replace?: boolean
}

export type Update = (patch: Partial<Omit<AppState, 'lang'>>, options?: UpdateOptions) => void

export function useAppState(meta: PantryMeta): readonly [AppState, Update] {
  const [state, setState] = useState<AppState>(() =>
    parseState(window.location.pathname, window.location.search, meta),
  )

  useEffect(() => {
    const onPop = () => setState(parseState(window.location.pathname, window.location.search, meta))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [meta])

  const update = useCallback<Update>(
    (patch, options) => {
      setState((previous) => {
        const next = { ...previous, ...patch }
        const url = toUrl(next, meta)
        if (url !== window.location.pathname + window.location.search) {
          if (options?.replace) window.history.replaceState(null, '', url)
          else window.history.pushState(null, '', url)
        }
        return next
      })
    },
    [meta],
  )

  return [state, update] as const
}
