import { describe, expect, it } from 'vitest'

/**
 * The kitchen is an offline Node program. It must never acquire a dependency on a browser
 * global, because the pipeline that actually runs in CI has no DOM and would fail at the worst
 * possible moment — halfway through a monthly data refresh.
 *
 * `vitest.config.ts` runs the kitchen and the site as two projects with different environments.
 * This test is what notices if that split is ever collapsed back into one: point the kitchen at
 * jsdom and it goes red here, immediately and unambiguously, rather than at some future date
 * when someone writes kitchen code against `window` and every test still passes.
 */
describe('the kitchen runs without a browser', () => {
  it.each(['document', 'window', 'localStorage'])('has no global %s', (name) => {
    expect(name in globalThis).toBe(false)
  })

  // `navigator` is deliberately absent from that list: Node has defined a global navigator
  // since version 21, so its mere presence proves nothing either way. What distinguishes the
  // two is the user agent — Node reports "Node.js/22", jsdom reports a string containing
  // "jsdom" — so that is what gets asserted.
  it('has only the navigator that Node itself provides, never the one from jsdom', () => {
    expect(globalThis.navigator.userAgent).toContain('Node.js')
  })
})
