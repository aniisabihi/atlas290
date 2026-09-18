import { describe, expect, it } from 'vitest'
import rawIndex from '../public/pantry/data/index.json'
import { PantryIndex } from './pantry'
import { CODE_PATTERN, parseSegment, pathFor, segmentFor, slugify } from './slug'

// Only the municipalities are needed here, and the index carries all 290 of them — so this reads
// the one small file rather than reassembling the whole pantry from eleven (Plan 13).
const data = PantryIndex.parse(rawIndex)

describe('slugify', () => {
  it('spells Swedish letters the way Swedish spells them in ASCII', () => {
    // Not the German ae/oe: that is a different language's convention and reads as a
    // misspelling in Swedish.
    expect(slugify('Håbo')).toBe('habo')
    expect(slugify('Gävle')).toBe('gavle')
    expect(slugify('Malmö')).toBe('malmo')
    expect(slugify('Östersund')).toBe('ostersund')
  })

  it('joins words with a single hyphen and trims the ends', () => {
    expect(slugify('Upplands Väsby')).toBe('upplands-vasby')
    expect(slugify('Malung-Sälen')).toBe('malung-salen')
    expect(slugify('  Ale  ')).toBe('ale')
  })

  it('reduces a name it cannot spell to hyphens rather than throwing', () => {
    // The code is what resolves the page, so an unmappable name is a cosmetic problem.
    expect(slugify('日本')).toBe('')
  })
})

describe('segmentFor', () => {
  it('puts the code after the words', () => {
    expect(segmentFor('Stockholm', '0180')).toBe('stockholm-0180')
  })

  it('keeps Håbo and Habo apart, which is the whole reason the code is there', () => {
    const habo = data.municipalities.find((m) => m.name.sv === 'Habo')!
    const habo2 = data.municipalities.find((m) => m.name.sv === 'Håbo')!
    expect(slugify(habo.name.sv)).toBe(slugify(habo2.name.sv))
    expect(segmentFor(habo.name.sv, habo.code)).not.toBe(segmentFor(habo2.name.sv, habo2.code))
  })

  it('falls back to the bare code when a name slugifies to nothing', () => {
    expect(segmentFor('日本', '0180')).toBe('0180')
  })

  it('refuses a code that is not four digits, rather than minting a broken path', () => {
    expect(() => segmentFor('Stockholm', '180')).toThrow(/four digits/)
    expect(() => segmentFor('Stockholm', '')).toThrow(/four digits/)
  })
})

describe('parseSegment', () => {
  it('reads the code', () => {
    expect(parseSegment('stockholm-0180')).toBe('0180')
  })

  it('ignores the words entirely', () => {
    // So a municipality SCB renames keeps every link anybody has already shared, and a
    // hand-edited slug cannot quietly resolve to a different place than the one it names.
    expect(parseSegment('goteborg-1280')).toBe('1280')
    expect(parseSegment('malmo-1280')).toBe('1280')
    expect(parseSegment('anything-at-all-1280')).toBe('1280')
  })

  it('accepts a bare code as shorthand', () => {
    expect(parseSegment('1280')).toBe('1280')
  })

  it('reads nothing from a segment with no code on the end', () => {
    expect(parseSegment('malmo')).toBeNull()
    expect(parseSegment('')).toBeNull()
    expect(parseSegment('malmo-128')).toBeNull()
    expect(parseSegment('12805')).toBeNull()
  })

  it('takes the code at the end, not one in the middle', () => {
    expect(parseSegment('1280-malmo-0180')).toBe('0180')
  })
})

describe('against the committed pantry', () => {
  it('gives all 290 municipalities a unique path', () => {
    const segments = data.municipalities.map((m) => segmentFor(m.name.sv, m.code))
    expect(new Set(segments).size).toBe(290)
  })

  it('round-trips every one of them', () => {
    for (const m of data.municipalities) {
      expect(parseSegment(segmentFor(m.name.sv, m.code)), m.name.sv).toBe(m.code)
    }
  })

  it('produces only characters that need no escaping in a URL', () => {
    for (const m of data.municipalities) {
      const segment = segmentFor(m.name.sv, m.code)
      expect(segment, m.name.sv).toMatch(/^[a-z0-9-]+$/)
      expect(encodeURIComponent(segment), m.name.sv).toBe(segment)
    }
  })

  it('gives both languages the same path, because the names are the same', () => {
    // All 290 names are identical in Swedish and English, which is also why one preview card
    // serves both. Asserted rather than assumed: a future translated name would need a
    // decision about which language the slug speaks.
    for (const m of data.municipalities) {
      expect(m.name.en, m.code).toBe(m.name.sv)
    }
  })

  it('every code matches the pattern the segment builder demands', () => {
    for (const m of data.municipalities) expect(CODE_PATTERN.test(m.code)).toBe(true)
  })
})

describe('pathFor', () => {
  it('builds a rooted path with a trailing slash', () => {
    expect(pathFor('en', 'Malmö', '1280')).toBe('/en/malmo-1280/')
    expect(pathFor('sv', 'Malmö', '1280')).toBe('/sv/malmo-1280/')
  })
})
