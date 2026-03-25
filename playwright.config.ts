import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration — NEXUS Dashboard Angular
 *
 * Run:  npx playwright test
 * UI:   npx playwright test --ui
 * CI:   npx playwright test --reporter=github
 *
 * The tests expect the app to be running (ng serve or docker compose up).
 * baseURL defaults to http://localhost:4200 (dev) or http://localhost:8080 (docker).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  // In CI: serve the pre-built dist/ with `serve` (SPA mode).
  // Locally: start ng serve with hot-reload.
  webServer: {
    command: process.env.CI
      ? 'npx --yes serve@14 dist/app/browser --single --listen 4200'
      : 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
