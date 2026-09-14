import { useCallback, useSyncExternalStore } from 'react'

/**
 * A media query read in JavaScript as well as in CSS, for the cases where the difference is
 * behavioural rather than visual — which view is the default, whether the panel is a sheet.
 *
 * `useSyncExternalStore` rather than state plus an effect: a media query list is exactly the
 * external source that hook exists for, and reading it this way means no setState during an
 * effect and no window where the rendered value disagrees with the real one.
 *
 * Returns false where `matchMedia` is missing rather than throwing. A page that renders the wide
 * layout is a worse page, not a broken one.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof matchMedia !== 'function') return () => {}
      const list = matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  const read = useCallback(
    () => typeof matchMedia === 'function' && matchMedia(query).matches,
    [query],
  )
  return useSyncExternalStore(subscribe, read, () => false)
}
