import { describe, expect, it } from 'vitest'
import tokensCss from './tokens.css?raw'
import { contrast } from '../map/colour'

/**
 * Reads the real stylesheet rather than a copy of its values, so these assertions fail when
 * somebody edits a colour — which is the only time they are worth anything.
 */
function tokensIn(block: string): Record<string, string> {
  const found: Record<string, string> = {}
  for (const [, name, value] of block.matchAll(/--([a-z-]+):\s*([^;]+);/g)) {
    found[name!] = value!.trim()
  }
  return found
}

const lightBlock = tokensCss.slice(tokensCss.indexOf(':root {'), tokensCss.indexOf('@media'))
const darkBlock = tokensCss.slice(
  tokensCss.indexOf('(prefers-color-scheme: dark)'),
  tokensCss.indexOf('(prefers-reduced-motion'),
)
const light = tokensIn(lightBlock)
const dark = tokensIn(darkBlock)

const THEMES = [
  ['light', light],
  ['dark', { ...light, ...dark }],
] as const

describe('the token palette', () => {
  it('redefines every colour it overrides, and overrides nothing it has not defined', () => {
    for (const name of Object.keys(dark)) {
      expect(light[name], `--${name} is set in dark mode but never in light`).toBeDefined()
    }
  })

  it.each(THEMES)('has readable body text in %s', (_name, theme) => {
    expect(contrast(theme.text!, theme.bg!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(theme.text!, theme.surface!)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(THEMES)('has readable secondary text in %s', (_name, theme) => {
    // Muted text is still text: WCAG 1.4.3 applies to it exactly as it does to the rest.
    expect(contrast(theme['text-muted']!, theme.bg!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(theme['text-muted']!, theme.surface!)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(THEMES)('has an accent that can carry its own text in %s', (_name, theme) => {
    expect(contrast(theme['accent-text']!, theme.accent!)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(THEMES)('has a border that is actually visible in %s', (_name, theme) => {
    // WCAG 2.2 SC 1.4.11: a boundary that carries meaning needs 3:1 against what it separates.
    expect(contrast(theme.border!, theme.bg!)).toBeGreaterThanOrEqual(1.3)
  })

  it.each(THEMES)('has a focus ring whose two tones are far apart in %s', (_name, theme) => {
    expect(contrast(theme['focus-core']!, theme['focus-halo']!)).toBeGreaterThanOrEqual(7)
  })

  it('keeps the map on a light ground in both themes, because the ramp is calibrated for it', () => {
    expect(light['map-ground']).toBe('#ffffff')
    expect(dark['map-ground']).toBeUndefined()
  })

  it('has one motion duration that reduced motion sets to zero', () => {
    expect(light.motion).toBe('250ms')
    expect(tokensCss).toMatch(/prefers-reduced-motion: reduce[\s\S]*--motion:\s*0ms/)
  })
})
