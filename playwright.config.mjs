import { defineConfig } from '@playwright/test';

// Browser tests run against a real server on port 4320 with no AI keys. ICARUS_TEST_FAULTS lets
// tests trigger a simulated coach failure; it must never be set in production.
export default defineConfig({
  testDir: 'tests/browser',
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:4320',
    headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROME_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH } : {},
  },
  webServer: {
    command: 'node dist/server/main.js',
    url: 'http://127.0.0.1:4320/api/health',
    reuseExistingServer: false,
    env: { PORT: '4320', ICARUS_TEST_FAULTS: '1', OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '', CLAUDE_CLI_PATH: '', CODEX_CLI_PATH: '' },
  },
});
