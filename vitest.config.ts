import { defineConfig } from 'vitest/config'

/**
 * Two projects, not one environment for everything.
 *
 * The kitchen is a Node program and its tests must keep running in a plain Node environment: a
 * jsdom global leaking into them would let a kitchen module quietly start depending on a browser
 * API that does not exist when the pipeline actually runs. The site's tests need a DOM.
 *
 * Splitting them keeps both honest, and keeps the kitchen's 300-odd tests fast — jsdom costs
 * real time to construct per file and the kitchen has no use for it.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'kitchen',
          environment: 'node',
          include: ['shared/**/*.test.ts', 'kitchen/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'site',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['./src/test-setup.ts'],
          // Vitest stubs CSS imports to an empty string unless told otherwise, which makes
          // even a `?raw` import of a stylesheet come back blank. src/styles/tokens.test.ts
          // asserts real contrast ratios out of the real stylesheet, so it needs the file.
          css: true,
        },
      },
    ],
  },
})
