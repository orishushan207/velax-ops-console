import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // בדיקות אינטגרציה נוגעות במסד אמיתי ולכן רצות בסדרה
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    server: {
      deps: {
        // pg הוא CommonJS ואינו עובר טרנספורמציה נכון ב־Vitest
        external: ['pg', 'pg-pool', 'pg-native'],
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
