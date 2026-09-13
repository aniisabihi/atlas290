import { describe, expect, it } from 'vitest'
import { PantryData } from '../shared/pantry'
import type { MunicipalityTopology } from '../shared/geometry'
import rawTopology from '../public/pantry/geometry/municipalities.topo.json'
import rawData from '../public/pantry/data/indicators.json'
import { pathsFor, colourFor } from './RenderCheck'

// JSON imports (not node:fs) so this test file needs no Node types: src/ stays
// browser-safe end to end, matching ruling R3's import boundary.
const topology = rawTopology as unknown as MunicipalityTopology
const data = PantryData.parse(rawData)

describe('render check', () => {
  it('produces one SVG path per municipality with a colour from the fixed breaks', () => {
    const paths = pathsFor(topology)
    expect(paths).toHaveLength(290)
    expect(paths.every((p) => p.d.length > 10)).toBe(true)
    const indicator = data.indicators[0]!
    expect(colourFor(indicator, 1)).not.toBe(colourFor(indicator, 10_000_000))
    expect(colourFor(indicator, null)).toBe('#ddd')
  })
})
