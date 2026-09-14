import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

/**
 * Testing Library only auto-cleans when vitest runs with globals enabled, which this repo does
 * not do. Without this, one test's DOM survives into the next and `getByRole` starts finding two
 * of everything — a failure that reads like a component bug and is not one.
 */
afterEach(cleanup)
