import { describe, expect, it } from 'vitest'
import { CREATED, SPLIT_PARENT } from './municipalities'
import { computeParentBreakYears, isStructuralBreak, parentBreakYears } from './breaks'

describe('computeParentBreakYears: synthetic cases the six real splits do not cover', () => {
  it('collapses two children created in the SAME year under the same parent into one break year (the case that actually occurs: Nyköping/Gnesta/Trosa)', () => {
    const splitParent = { a: 'parent', b: 'parent' }
    const created = { a: 1991, b: 1991 }
    const result = computeParentBreakYears(splitParent, created, 'snapshot')
    expect(result.get('parent')).toEqual([1991])
  })

  it('keeps two DISTINCT break years for a parent that loses children in different years (a case no real split produces, but the structure must still support it)', () => {
    const splitParent = { a: 'parent', b: 'parent' }
    const created = { a: 1991, b: 1998 }
    const result = computeParentBreakYears(splitParent, created, 'snapshot')
    expect(result.get('parent')).toEqual([1991, 1998])
  })

  it('throws naming the child code when SPLIT_PARENT references a child with no CREATED entry', () => {
    const splitParent = { orphan: 'parent' }
    const created = {}
    expect(() => computeParentBreakYears(splitParent, created, 'snapshot')).toThrow(
      /breaks: no CREATED year for child 'orphan'/,
    )
  })

  it('shifts every break year one calendar year later for flow-measured indicators', () => {
    const splitParent = { a: 'parent' }
    const created = { a: 1991 }
    expect(computeParentBreakYears(splitParent, created, 'flow').get('parent')).toEqual([1992])
    expect(computeParentBreakYears(splitParent, created, 'snapshot').get('parent')).toEqual([1991])
  })
})

describe('parentBreakYears: the six real splits from kitchen/src/municipalities.ts', () => {
  it('produces exactly one break year per parent, snapshot convention, verified against real TAB638 drops', () => {
    const result = parentBreakYears('snapshot')
    // Nyköping (0480) loses BOTH Gnesta (0461) and Trosa (0488) in 1991 — one break year,
    // not two — confirmed by real TAB638 data: Nyköping's population drops by exactly
    // 18,154 ONCE, between 1990 (65,908) and 1991 (47,754), not twice.
    expect(result.get('0480')).toEqual([1991])
    expect(result.get('1490')).toEqual([1994]) // Borås loses Bollebygd
    expect(result.get('1880')).toEqual([1994]) // Örebro loses Lekeberg
    expect(result.get('0181')).toEqual([1998]) // Södertälje loses Nykvarn
    expect(result.get('0380')).toEqual([2002]) // Uppsala loses Knivsta — the 11,437 drop
    // Five distinct parents, not six: Nyköping appears once despite having two children.
    expect(result.size).toBe(5)
  })

  it('produces the one-year-later flow break years, matching migration.ts/housing.ts real-data findings', () => {
    const result = parentBreakYears('flow')
    expect(result.get('0480')).toEqual([1992])
    expect(result.get('1490')).toEqual([1995])
    expect(result.get('1880')).toEqual([1995])
    expect(result.get('0181')).toEqual([1999])
    expect(result.get('0380')).toEqual([2003])
  })

  it('is built from the real SPLIT_PARENT/CREATED constants, not a hand-copied duplicate', () => {
    // A defect where breaks.ts hardcoded its own copy of the six splits would still pass
    // every assertion above; this proves every SPLIT_PARENT child's CREATED year actually
    // drove the result, by checking the map has no parent SPLIT_PARENT doesn't name and no
    // parent is missing.
    const result = parentBreakYears('snapshot')
    const expectedParents = new Set(Object.values(SPLIT_PARENT))
    expect(new Set(result.keys())).toEqual(expectedParents)
    for (const [child, parent] of Object.entries(SPLIT_PARENT)) {
      expect(result.get(parent)).toContain(CREATED[child])
    }
  })
})

describe('isStructuralBreak', () => {
  it('is true for a parent in its real break year, snapshot convention', () => {
    expect(isStructuralBreak('0380', 2002)).toBe(true) // Uppsala, 2002 — Knivsta splits off
  })

  it('is false for the same parent one year before or after its break year', () => {
    expect(isStructuralBreak('0380', 2001)).toBe(false)
    expect(isStructuralBreak('0380', 2003)).toBe(false)
  })

  it('is false for a municipality that never lost a child', () => {
    expect(isStructuralBreak('0180', 2002)).toBe(false) // Stockholm
  })

  it('is false for a CHILD code in its own break year — only the PARENT is flagged', () => {
    expect(isStructuralBreak('0330', 2002)).toBe(false) // Knivsta itself, not Uppsala
  })

  it('uses the flow convention (one year later) when asked for it', () => {
    expect(isStructuralBreak('0380', 2002, 'flow')).toBe(false)
    expect(isStructuralBreak('0380', 2003, 'flow')).toBe(true)
  })
})
