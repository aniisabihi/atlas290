import { useMediaQuery } from './useMediaQuery'

export const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/**
 * Whether the visitor has asked their system for less movement.
 *
 * Read in JavaScript as well as CSS because the difference is behavioural, not only visual: with
 * reduced motion the map's colours change instantly between years rather than easing.
 */
export function useReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION)
}
