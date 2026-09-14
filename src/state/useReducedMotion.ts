import { useEffect, useState } from 'react'

export const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/**
 * Whether the visitor has asked their system for less movement.
 *
 * Read in JavaScript as well as CSS because the difference is behavioural, not only visual: with
 * reduced motion the map's colours change instantly between years rather than easing, and that
 * is a class the component decides rather than a rule the stylesheet can express on its own.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia === 'function' && matchMedia(REDUCED_MOTION).matches,
  )
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const list = matchMedia(REDUCED_MOTION)
    const onChange = () => setReduced(list.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [])
  return reduced
}
