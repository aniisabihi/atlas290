import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PantryData, PantryIndex, PantryIndicator } from '../../shared/pantry'
import published from '../../public/pantry/data/indicators.json'
import { readPantryParts, writePantryParts } from './publish'

/**
 * Plan 13 Task 2: the kitchen writes the parts.
 *
 * Tested against the REAL published pantry rather than a fixture, because the property that
 * matters is about that file and no other: taken apart into the files the kitchen will now
 * write, and read back, it must be the pantry it always was.
 */

const pantry = PantryData.parse(published)

function inTempPantry<T>(run: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'sde-parts-test-'))
  try {
    return run(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('writePantryParts', () => {
  it('writes one index and one file per indicator, named by id', () => {
    inTempPantry((dir) => {
      writePantryParts(dir, pantry)

      const written = readdirSync(join(dir, 'data/indicators')).sort()
      expect(written).toEqual(pantry.indicators.map((i) => `${i.id}.json`).sort())

      const index = PantryIndex.parse(
        JSON.parse(readFileSync(join(dir, 'data/index.json'), 'utf8')),
      )
      expect(index.indicators.map((i) => i.id)).toEqual(pantry.indicators.map((i) => i.id))
    })
  })

  it('writes files that read back as the pantry they came from', () => {
    inTempPantry((dir) => {
      writePantryParts(dir, pantry)
      expect(readPantryParts(dir)).toEqual(pantry)
    })
  })

  it('writes the same bytes every time, which is what CI checks', () => {
    inTempPantry((dir) => {
      writePantryParts(dir, pantry)
      const first = readdirSync(join(dir, 'data/indicators'))
        .sort()
        .map((f) => readFileSync(join(dir, 'data/indicators', f), 'utf8'))
      const firstIndex = readFileSync(join(dir, 'data/index.json'), 'utf8')

      writePantryParts(dir, pantry)
      const second = readdirSync(join(dir, 'data/indicators'))
        .sort()
        .map((f) => readFileSync(join(dir, 'data/indicators', f), 'utf8'))

      expect(second).toEqual(first)
      expect(readFileSync(join(dir, 'data/index.json'), 'utf8')).toEqual(firstIndex)
    })
  })

  it('keeps every part parseable on its own, so one bad file fails by name', () => {
    inTempPantry((dir) => {
      writePantryParts(dir, pantry)
      for (const indicator of pantry.indicators) {
        const part = PantryIndicator.parse(
          JSON.parse(readFileSync(join(dir, `data/indicators/${indicator.id}.json`), 'utf8')),
        )
        expect(part.indicator.id).toBe(indicator.id)
        expect(part.series.indicator).toBe(indicator.id)
      }
    })
  })
})

describe('readPantryParts', () => {
  it('reads the published pantry back into one object', () => {
    inTempPantry((dir) => {
      writePantryParts(dir, pantry)
      const round = readPantryParts(dir)
      expect(round.indicators.map((i) => i.id)).toEqual(pantry.indicators.map((i) => i.id))
      expect(round.series.map((s) => s.indicator)).toEqual(pantry.series.map((s) => s.indicator))
    })
  })

  it('fails by name when an indicator listed in the index has no file', () => {
    inTempPantry((dir) => {
      writePantryParts(dir, pantry)
      const first = pantry.indicators[0]!
      rmSync(join(dir, `data/indicators/${first.id}.json`))
      expect(() => readPantryParts(dir)).toThrow(new RegExp(first.id))
    })
  })
})
