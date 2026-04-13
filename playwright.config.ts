import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    baseURL: 'http://localhost:5173',
  },
  reporter: [['list'], ['json', { outputFile: 'artifacts/test-results.json' }]],
})
