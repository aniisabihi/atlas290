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
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        /*
         * Firefox does not enforce `Cross-Origin-Opener-Policy` here, and that is a deliberate
         * workaround for a defect in Playwright's Firefox driver, not a relaxation of the site's
         * policy. `dist/_headers` still carries `COOP: same-origin`, the preview server still
         * serves it, `e2e/headers.spec.ts` still asserts it arrives, and Chromium and WebKit
         * still enforce it.
         *
         * What goes wrong: a page begins life at `about:blank`, which carries no COOP. The first
         * navigation to a document that does swaps the browsing-context group, and Firefox's
         * driver intermittently loses that navigation — `page.goto` never resolves even though
         * the document is complete, its `load` event has fired and nothing is still in flight.
         * It is a hang, not slowness: measured at 90 s against a median of 27 ms, so no timeout
         * can rescue it.
         *
         * Measured against a bare Node server serving the same document, 50 fresh pages per
         * process, three processes each: no headers 0/150, the CSP alone 0/150, the other four
         * headers 0/150, COOP alone 29/150. Only the first navigation of a page is affected —
         * once the page is inside the policy's group there is no second swap — which is why the
         * suite lost a DIFFERENT test every run: every test opens a page and navigates once.
         * WebKit and Chromium: 0/150 with the same header. See
         * docs/decisions/0017-the-flake-was-a-security-header.md.
         */
        launchOptions: {
          firefoxUserPrefs: { 'browser.tabs.remote.useCrossOriginOpenerPolicy': false },
        },
      },
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'yarn build && yarn preview --port 4173 --strictPort',
    url: 'http://localhost:4173/en/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
