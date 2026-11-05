import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/qa',
  timeout: 45000,
  use: {
    channel: 'chrome',
    baseURL: 'http://127.0.0.1:5174',
    screenshot: 'on',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chrome',
      use: { channel: 'chrome' },
    },
  ],
});
