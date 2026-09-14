import { useState } from 'react'

/**
 * The smallest possible React component with state. It exists only so that the component test
 * environment has something real to prove itself against: a test that renders nothing proves
 * nothing. Kept in the repository rather than deleted, because the day jsdom or Testing Library
 * breaks, this is the file that says so in one line instead of a component test failing for a
 * reason that looks like a bug in the component.
 */
export function SmokeProbe() {
  const [count, setCount] = useState(0)
  return (
    <button type="button" onClick={() => setCount((c) => c + 1)}>
      clicked {count} times
    </button>
  )
}
