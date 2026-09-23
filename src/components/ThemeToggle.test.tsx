import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { ThemeToggle } from './ThemeToggle'

afterEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('ThemeToggle', () => {
  it('is named for what pressing it does, and does it', async () => {
    render(<ThemeToggle lang="en" />)
    await userEvent.click(screen.getByRole('button', { name: 'Switch to the dark theme' }))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(screen.getByRole('button', { name: 'Switch to the light theme' })).toBeTruthy()
  })

  it('is not also a pressed toggle, which would contradict its own name', async () => {
    // It carried aria-pressed until the editorial pass, so in the dark theme a screen reader
    // announced "Switch to the light theme, toggle button, pressed" — an action and a state that
    // disagree. A button that names its action needs no state.
    render(<ThemeToggle lang="sv" />)
    const button = screen.getByRole('button', { name: 'Byt till mörkt utseende' })
    expect(button.hasAttribute('aria-pressed')).toBe(false)
    await userEvent.click(button)
    expect(
      screen.getByRole('button', { name: 'Byt till ljust utseende' }).hasAttribute('aria-pressed'),
    ).toBe(false)
  })

  it('carries the visible word inside its accessible name', () => {
    // WCAG 2.5.3, Label in Name: a voice user says what they see.
    render(<ThemeToggle lang="sv" />)
    const button = screen.getByRole('button')
    expect(button.getAttribute('aria-label')!.toLowerCase()).toContain(
      button.textContent!.toLowerCase(),
    )
  })
})
