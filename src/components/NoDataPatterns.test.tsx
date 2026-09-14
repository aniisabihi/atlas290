import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { NO_VALUE_FILLS } from '../map/colour'
import { NoDataPatterns } from './NoDataPatterns'

describe('NoDataPatterns', () => {
  it('defines every pattern any fill can reference', () => {
    const { container } = render(<NoDataPatterns />)
    const ids = new Set(
      [...container.querySelectorAll('defs pattern')].map((p) => p.getAttribute('id')),
    )
    for (const { patternId } of Object.values(NO_VALUE_FILLS)) {
      expect(ids.has(patternId), `pattern ${patternId} is referenced but never defined`).toBe(true)
    }
  })

  it('defines each one exactly once, so no id is duplicated in the document', () => {
    const { container } = render(<NoDataPatterns />)
    const ids = [...container.querySelectorAll('pattern')].map((p) => p.getAttribute('id'))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('is hidden from assistive technology and takes up no space', () => {
    const { container } = render(<NoDataPatterns />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('width')).toBe('0')
  })
})
