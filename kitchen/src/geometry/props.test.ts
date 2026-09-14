import { describe, expect, it } from 'vitest'
import { municipalityProps } from './props'

describe('municipalityProps', () => {
  it('returns code and name from a valid geometry', () => {
    const g = { properties: { code: '0180', name: 'Stockholm' } }
    expect(municipalityProps(g, 0)).toEqual({ code: '0180', name: 'Stockholm' })
  })

  it('throws naming the index when properties is missing', () => {
    const g = { properties: undefined }
    expect(() => municipalityProps(g, 7)).toThrow(/index 7/)
    expect(() => municipalityProps(g, 7)).toThrow(/no properties/)
  })

  it('throws naming the index when code is not a four-digit string', () => {
    const g = { properties: { code: '180', name: 'Stockholm' } }
    expect(() => municipalityProps(g, 3)).toThrow(/index 3/)
    expect(() => municipalityProps(g, 3)).toThrow(/invalid code/)
  })

  it('throws naming the index when code is missing entirely', () => {
    const g = { properties: { name: 'Stockholm' } }
    expect(() => municipalityProps(g, 12)).toThrow(/index 12/)
  })

  it('throws naming the code when name is empty', () => {
    const g = { properties: { code: '0180', name: '' } }
    expect(() => municipalityProps(g, 5)).toThrow(/0180/)
    expect(() => municipalityProps(g, 5)).toThrow(/invalid name/)
  })
})
