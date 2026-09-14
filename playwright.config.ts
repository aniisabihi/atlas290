import { defineConfig, devices } from '@playwright/test'

/**
 * Browser tests against the BUILT site, not the dev server.
 *
 * `yarn preview` serves exactly what `dist` contains, which is what a visitor gets. The dev
 * server transforms modules on the fly and serves an unminified graph; passing there and failing
 * in production is the classic way a browser suite earns distrust.
 *
 * Three engines, because the questions this suite exists to answer are the ones only a real
 * browser can: Plans 3 and 4 both had to admit that keyboard behaviour was checked in WebKit
 * alone, and that Safari does not Tab to non-form elements without full keyboard access.
 */
export default defineConfig({
  testDir: './e2e',
  // Nothing here depends on anything else here; parallel is safe and much faster.
  fullyParallel: true,
  // A test marked `.only` that reaches CI silently disables its neighbours.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'yarn build && yarn preview --port 4173 --strictPort',
    url: 'http://localhost:4173/en/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
