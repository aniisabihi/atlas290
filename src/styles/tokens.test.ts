import { describe, expect, it } from 'vitest'
import tokensCss from './tokens.css?raw'
import { contrast } from '../map/colour'

/**
 * Reads the real stylesheet rather than a copy of its values, so these assertions fail when
 * somebody edits a colour — which is the only time they are worth anything.
 *
 * The palette has three states, not two: no choice and no system preference (light, the
 * standard); no choice and a dark system; and an explicit choice, which beats the system in
 * either direction. The last two carry identical values, and a test below makes sure they stay
 * identical — two copies of a palette is two palettes waiting to diverge.
 */
function tokensIn(block: string): Record<string, string> {
  const found: Record<string, string> = {}
  for (const [, name, value] of block.matchAll(/--([a-z-]+):\s*([^;]+);/g)) {
    found[name!] = value!.trim()
  }
  return found
}

function blockAfter(marker: string): string {
  const start = tokensCss.indexOf(marker)
  // Empty rather than thrown: a missing block should fail the assertion that needs it, with a
  // readable message, instead of crashing the file before any test runs.
  if (start === -1) return ''
  const open = tokensCss.indexOf('{', start)
  // Tokens are simple declarations, so the first closing brace ends the declaration block.
  return tokensCss.slice(open, tokensCss.indexOf('}', open))
}

const light = tokensIn(blockAfter('\n:root {'))
const darkSystem = tokensIn(blockAfter(":root:not([data-theme='light'])"))
const darkChosen = tokensIn(blockAfter(":root[data-theme='dark']"))

const THEMES = [
  ['light', light],
  ['dark', { ...light, ...darkSystem }],
] as const

describe('the token palette', () => {
  it('declares every token in the light block first', () => {
    // A colour defined only inside a media query does not exist for a visitor with no system
    // preference, so the page renders one theme's text on the other theme's ground.
    for (const name of [...Object.keys(darkSystem), ...Object.keys(darkChosen)]) {
      if (name === 'color-scheme') continue
      expect(
        light[name],
        `--${name} is set in a dark block but never in the light one`,
      ).toBeDefined()
    }
  })

  it('keeps the two dark blocks identical', () => {
    // One is for a dark system, one for an explicit choice. They must describe the same theme.
    expect(Object.keys(darkSystem).length).toBeGreaterThan(5)
    expect(darkChosen).toEqual(darkSystem)
  })

  it('guards the system dark block so an explicit light choice still wins', () => {
    // Without `:not([data-theme='light'])` a visitor on a dark system could never choose light —
    // the media query would keep overriding them.
    expect(tokensCss).toMatch(
      /prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme='light'\]\)/,
    )
  })

  it.each(THEMES)('has readable body text in %s', (_name, theme) => {
    expect(contrast(theme.text!, theme.bg!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(theme.text!, theme.surface!)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(THEMES)('has readable secondary text in %s', (_name, theme) => {
    // Muted text is still text: WCAG 1.4.3 applies to it exactly as it does to the rest, and it
    // is the colour captions, tick labels and the method notes are set in.
    expect(contrast(theme['text-muted']!, theme.bg!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(theme['text-muted']!, theme.surface!)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(THEMES)('has an accent that can carry its own text in %s', (_name, theme) => {
    expect(contrast(theme['accent-text']!, theme.accent!)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(THEMES)('has an accent readable as a link on both grounds in %s', (_name, theme) => {
    // The accent is used for link text and eyebrows, not only as a fill.
    expect(contrast(theme.accent!, theme.bg!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(theme.accent!, theme.surface!)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(THEMES)('has a border that is actually visible in %s', (_name, theme) => {
    // WCAG 2.2 SC 1.4.11: a boundary that carries meaning needs 3:1 against what it separates.
    expect(contrast(theme.border!, theme.bg!)).toBeGreaterThanOrEqual(1.3)
  })

  it.each(THEMES)('has a heavy rule that reads as a rule in %s', (_name, theme) => {
    expect(contrast(theme.rule!, theme.bg!)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(THEMES)('keeps the two comparison series apart in %s', (_name, theme) => {
    // They are also distinguished by dash pattern, but they must not be the same colour.
    expect(theme['series-a']).not.toBe(theme['series-b'])
    // 4.5, not the 3:1 a line would need: these colours also set the column headers naming each
    // municipality, and axe caught the orange at 4.15 against the page.
    for (const key of ['series-a', 'series-b'] as const) {
      expect(contrast(theme[key]!, theme.bg!), key).toBeGreaterThanOrEqual(4.5)
      expect(contrast(theme[key]!, theme.surface!), key).toBeGreaterThanOrEqual(4.5)
    }
  })

  it.each(THEMES)('has a focus ring whose two tones are far apart in %s', (_name, theme) => {
    expect(contrast(theme['focus-core']!, theme['focus-halo']!)).toBeGreaterThanOrEqual(7)
  })

  it('never puts the page ground on white, in either theme', () => {
    // The map plate is white and fixed. A white page behind it turns the map into a hole.
    expect(light.bg).not.toBe('#ffffff')
    expect(darkSystem.bg).not.toBe('#ffffff')
  })

  it('keeps the map on a white ground in both themes, because the ramp is calibrated for it', () => {
    expect(light['map-ground']).toBe('#ffffff')
    expect(darkSystem['map-ground']).toBeUndefined()
    expect(darkChosen['map-ground']).toBeUndefined()
  })

  it('keeps text on the plate readable in both themes', () => {
    // The plate is white whatever the theme, so its text cannot follow the theme either. A dark
    // theme's muted grey on white is about 2.2:1 — this is the bug that catches.
    expect(darkSystem['on-plate'], '--on-plate must not change with the theme').toBeUndefined()
    expect(darkChosen['on-plate']).toBeUndefined()
    expect(contrast(light['on-plate']!, light['map-ground']!)).toBeGreaterThanOrEqual(4.5)
  })

  it('gives the plate its own accent, which the theme cannot move', () => {
    // The table's selected-row mark and its header hover used the theme accent, which in the
    // dark theme is a pale blue — about 2.2:1 on the white plate. 3:1 is the floor for a
    // non-text mark (WCAG 1.4.11) and 4.5 for the hover text; this clears both.
    expect(darkSystem['on-plate-accent']).toBeUndefined()
    expect(darkChosen['on-plate-accent']).toBeUndefined()
    expect(contrast(light['on-plate-accent']!, light['map-ground']!)).toBeGreaterThanOrEqual(4.5)
  })

  it('names the three faces, each with a real fallback stack', () => {
    for (const name of ['font-display', 'font-sans', 'font-mono']) {
      expect(light[name], name).toBeDefined()
      // A single family with nothing behind it renders as the browser default if the file fails.
      expect(light[name]!.split(',').length, name).toBeGreaterThan(1)
    }
  })

  it('has one motion duration that reduced motion sets to zero', () => {
    expect(light.motion).toBe('250ms')
    expect(tokensCss).toMatch(/prefers-reduced-motion: reduce[\s\S]*--motion:\s*0ms/)
  })
})
