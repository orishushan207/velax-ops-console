import { config as loadEnv } from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

// בדיקות שמאמתות מול המסד צריכות את DATABASE_URL בתהליך של Playwright עצמו
loadEnv({ path: '.env' });

/**
 * בדיקות E2E.
 *
 * הן רצות מול המערכת האמיתית עם מסד הנתונים המקומי,
 * ומניחות שהורץ npm run db:setup.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3210',
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/admin.json' },
      dependencies: ['setup'],
    },
  ],
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3210/login',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
