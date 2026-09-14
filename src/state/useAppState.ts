import { useCallback, useEffect, useState } from 'react'
import { parseState, toUrl, type AppState, type PantryMeta } from './url'

/**
 * The URL is the state, so this hook is the only place that writes to history.
 *
 * Language is deliberately NOT updatable here: switching language is a navigation to a different
 * page (`/sv/` and `/en/` are separate documents with their own `lang` and title), so it is a
 * real link rather than a history entry this hook pushes.
 */
export function useAppState(
  meta: PantryMeta,
): readonly [AppState, (patch: Partial<Omit<AppState, 'lang'>>) => void] {
  const [state, setState] = useState<AppState>(() =>
    parseState(window.location.pathname, window.location.search, meta),
  )

  useEffect(() => {
    const onPop = () => setState(parseState(window.location.pathname, window.location.search, meta))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [meta])

  const update = useCallback(
    (patch: Partial<Omit<AppState, 'lang'>>) => {
      setState((previous) => {
        const next = { ...previous, ...patch }
        const url = toUrl(next, meta)
        if (url !== window.location.pathname + window.location.search) {
          window.history.pushState(null, '', url)
        }
        return next
      })
    },
    [meta],
  )

  return [state, update] as const
}
