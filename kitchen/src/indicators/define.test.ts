import { describe, expect, it } from 'vitest'
import { PantryIndex, PantryIndicator } from '../../../shared/pantry'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_PANTRY_DIR } from '../publish'
import { buildDefined } from './define'
import { taxDefined } from './tax'

/**
 * Plan 14: an indicator built from its definition must equal the one the pantry already
 * publishes — every value and every status byte.
 *
 * Asserted against the committed file rather than a fixture, because that file is what the whole
 * plan promises not to change. A fixture would only prove the new code agrees with itself.
 */

const offline: typeof fetch = async (input) => {
  throw new Error(`these tests must be offline but tried to fetch ${String(input)}`)
}

const index = PantryIndex.parse(
  JSON.parse(readFileSync(join(DEFAULT_PANTRY_DIR, 'data/index.json'), 'utf8')) as unknown,
)

function published(id: string) {
  return PantryIndicator.parse(
    JSON.parse(
      readFileSync(join(DEFAULT_PANTRY_DIR, `data/indicators/${id}.json`), 'utf8'),
    ) as unknown,
  ).series
}

describe('an indicator built from its definition', () => {
  it('reproduces the published tax rate exactly, value for value and status for status', async () => {
    const series = await buildDefined(taxDefined(), {
      municipalities: index.municipalities,
      years: [],
      freeze: { deps: { fetchImpl: offline } },
      frozen: [],
      series: new Map(),
    })
    expect(series).toEqual(published('tax-rate'))
  })

  it('reports what it read, so the provenance manifest still names every frozen chunk', async () => {
    const frozen: Parameters<typeof buildDefined>[1]['frozen'] = []
    await buildDefined(taxDefined(), {
      municipalities: index.municipalities,
      years: [],
      freeze: { deps: { fetchImpl: offline } },
      frozen,
      series: new Map(),
    })
    expect(frozen.length).toBeGreaterThan(0)
  })
})
