import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['shared/**/*.test.ts', 'kitchen/**/*.test.ts', 'src/**/*.test.{ts,tsx}'],
  },
})
