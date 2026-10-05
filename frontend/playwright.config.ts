import { defineConfig } from '@playwright/test'

// Por defecto apunta a producción para no romper el flujo actual,
// pero en local/CI usar: PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173
// para no ensuciar datos de producción.
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL || 'https://motoerp-ckx7.vercel.app'

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
})
