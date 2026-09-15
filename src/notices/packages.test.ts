import { describe, expect, it } from 'vitest'
import packageJson from '../../package.json'
import { SHIPPED_PACKAGES } from './packages'

/**
 * A notices page maintained by hand drifts the first time somebody adds a dependency, and the
 * drift is invisible — the page still looks complete. This makes it a failing test instead.
 *
 * ISC and MIT both require their copyright notice to travel with a distribution, so the list is a
 * licence obligation rather than a courtesy.
 */
describe('the notices list against the real manifest', () => {
  const listed = new Set(SHIPPED_PACKAGES.map((p) => p.name))
  const declared = Object.keys(packageJson.dependencies)

  it.each(declared)('%s is listed on the notices page', (name) => {
    expect(listed.has(name), `${name} is a runtime dependency but is not on the notices page`).toBe(
      true,
    )
  })

  it('lists nothing twice', () => {
    expect(listed.size).toBe(SHIPPED_PACKAGES.length)
  })

  it('gives every package a licence', () => {
    for (const { name, licence } of SHIPPED_PACKAGES) {
      expect(licence.length, `${name} has no licence`).toBeGreaterThan(0)
    }
  })

  it('lists the transitive packages too, not only the direct ones', () => {
    // react pulls in scheduler, topojson-client pulls in commander, and d3-geo pulls in d3-array.
    // All of them reach a visitor's browser, and all of them carry a licence.
    for (const transitive of ['scheduler', 'commander', 'd3-array', 'internmap']) {
      expect(listed.has(transitive), `${transitive} ships but is not listed`).toBe(true)
    }
  })

  it('does not list a package that was removed from the manifest', () => {
    // d3-scale was a runtime dependency that nothing imported, and d3-force is the kitchen's.
    // Neither reaches a browser, so neither belongs here.
    expect(listed.has('d3-scale')).toBe(false)
    expect(listed.has('d3-force')).toBe(false)
  })
})
