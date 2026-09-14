import { useEffect, useState } from 'react'

/**
 * A media query read in JavaScript as well as in CSS, for the cases where the difference is
 * behavioural rather than visual — which view is the default, whether the panel is a sheet.
 *
 * Returns false when `matchMedia` is missing rather than throwing: a page that renders the
 * desktop view is a worse page, not a broken one.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof matchMedia === 'function' && matchMedia(query).matches,
  )
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const list = matchMedia(query)
    const onChange = () => setMatches(list.matches)
    setMatches(list.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])
  return matches
}
