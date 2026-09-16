import { describe, expect, it } from 'vitest'
import appCss from './app.css?raw'

/**
 * Three rules the stylesheet has to keep, read from the real file.
 *
 * Each one is here because it was broken, and because no other test could have caught it: jsdom
 * applies no CSS at all, so a component test sees a disclosure with its marker removed exactly
 * as it sees one with a marker. What can be asserted is the stylesheet's own text, which is
 * where all three defects actually lived.
 */

type Rule = { selector: string; body: string }

/** Every rule in the sheet, selector and declarations, in source order. */
const RULES: Rule[] = [
  ...appCss.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g),
].map(([, selector, body]) => ({ selector: selector!.trim(), body: body! }))

/**
 * Rules whose selector names `needle` as a whole token.
 *
 * A substring match would make `.map` find `.map-frame` and `.map-tooltip` too, so a test meant
 * to prove the map is given the stage height would pass on any rule that merely starts with the
 * same letters — which is the way a stylesheet test quietly stops testing anything.
 */
function rulesFor(needle: string): Rule[] {
  const token = new RegExp(`${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`)
  return RULES.filter((r) => token.test(r.selector))
}

/** Just the declarations, for the cases where the selector has already been pinned down. */
function rulesMatching(needle: string): string[] {
  return rulesFor(needle).map((r) => r.body)
}

describe('the disclosures', () => {
  /*
   * A <summary> paints the native triangle only while it is `display: list-item`. Both of this
   * site's fold-outs are flex rows so the heading sits beside the mark rather than under it —
   * and taking the flex without putting the mark back is what left "Om det här måttet" looking
   * like a label nobody could tell was clickable.
   *
   * The same selector has to do both, not merely some selector each. Checking them separately
   * is how this test would go on passing while a new disclosure took the flex and left the mark
   * behind — which is exactly the defect it exists for.
   */
  it('draw their own marker, on every selector that takes the native one away', () => {
    const markerless = rulesFor('summary').filter(
      (r) =>
        !r.selector.includes('::') &&
        (r.body.includes('display: flex') || r.body.includes('list-style: none')),
    )
    expect(markerless.length).toBeGreaterThan(0)

    const drawn = RULES.filter((r) => r.selector.includes('summary::before'))
    expect(drawn.some((r) => r.body.includes('content:'))).toBe(true)

    for (const rule of markerless) {
      const subject = rule.selector.replace(/\s*summary\b.*$/, '').trim()
      const mark = drawn.find((r) => r.selector.startsWith(subject))
      expect(
        mark,
        `${rule.selector} hides the native marker but nothing draws one for "${subject}"`,
      ).toBeDefined()
    }
  })

  it('turn the marker rather than swapping it, and stop turning under reduced motion', () => {
    const open = rulesMatching('[open] summary::before')
    expect(open.some((body) => body.includes('rotate'))).toBe(true)
    // `--motion` is the one duration the reduced-motion block sets to zero, so a transition
    // written in any other unit would keep moving for a visitor who asked it not to.
    expect(rulesMatching('summary::before').some((b) => b.includes('var(--motion)'))).toBe(true)
  })

  it('say they can be clicked, and answer a pointer', () => {
    expect(rulesMatching('summary').some((b) => b.includes('cursor: pointer'))).toBe(true)
    expect(rulesMatching('summary:hover').length).toBeGreaterThan(0)
  })
})

describe('the stage', () => {
  /*
   * The table is the map's twin and takes the map's box. Laid out in the page instead, its 290
   * rows made the document thirteen thousand pixels tall, so a view became a scroll.
   */
  it('is one height, and both the map and its table twin are given it', () => {
    expect(rulesMatching(':root').some((b) => b.includes('--stage:'))).toBe(true)
    expect(rulesMatching('.map').some((b) => b.includes('height: var(--stage)'))).toBe(true)
    const box = rulesMatching('.view-column .table-scroll')
    expect(box.some((b) => b.includes('max-height: var(--stage)'))).toBe(true)
    expect(box.some((b) => b.includes('overflow-y: auto'))).toBe(true)
  })

  it('keeps the table header in view, because the sort controls live in it', () => {
    const head = rulesMatching('.view-column .data-table thead th')
    expect(head.some((b) => b.includes('position: sticky'))).toBe(true)
    // Opaque, or the rows scroll through the labels they are supposed to be under.
    expect(head.some((b) => b.includes('background: var(--surface)'))).toBe(true)
  })
})

describe('the search field', () => {
  /*
   * The compare box is the same control as the bar's. Scoping the field's shape to `.bar` is
   * what made it render as a browser default beside a profile set in Newsreader.
   */
  it('keeps its shape wherever it is placed, not only in the bar', () => {
    const shaped = appCss.slice(appCss.indexOf('.bar :where(select, input, button)'))
    const selector = shaped.slice(0, shaped.indexOf('{'))
    expect(selector).toContain('.search')
  })
})
