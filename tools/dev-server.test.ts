import { describe, expect, it } from 'vitest'
import { knownCodes } from '../vite.config'

describe('the dev server’s municipality pages', () => {
  it('knows all 290 codes, read from the file the pantry actually has', () => {
    // It went on reading `data/indicators.json` after Plan 13 split that file into an index and
    // one file per indicator, so every `/sv/malmo-1280/` threw ENOENT under `yarn dev` while the
    // built site served it perfectly — the one environment nobody tests is the one that broke.
    const codes = knownCodes()
    expect(codes.size).toBe(290)
    expect(codes.has('1280')).toBe(true)
  })
})
