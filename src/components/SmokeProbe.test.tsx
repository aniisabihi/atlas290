import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SmokeProbe } from './SmokeProbe'

describe('the component test environment', () => {
  it('gives the site a DOM, which kitchen/src/no-dom.test.ts proves the kitchen does not get', () => {
    expect('document' in globalThis).toBe(true)
  })

  it('renders a component, finds it by its accessible name, and reacts to a real click', async () => {
    render(<SmokeProbe />)
    const button = screen.getByRole('button', { name: 'clicked 0 times' })
    await userEvent.click(button)
    expect(await screen.findByRole('button', { name: 'clicked 1 times' })).toBeTruthy()
  })
})
