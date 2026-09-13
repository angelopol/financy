import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5173',
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev:demo',
    // Vite starts almost instantly but the demo API seeds data and calls
    // app.listen() a bit later; polling /api/health (proxied by Vite) waits
    // for both instead of racing tests against a not-yet-listening API.
    url: 'http://localhost:5173/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 90000,
  },
});
