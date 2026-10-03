import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: { baseURL: "http://127.0.0.1:8790", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"], defaultBrowserType: "chromium" } },
  ],
  webServer: {
    command: "npx wrangler dev --config workers/api/wrangler.jsonc --env staging --local --ip 127.0.0.1 --port 8790",
    url: "http://127.0.0.1:8790/kunstkiezer/api/health",
    reuseExistingServer: false,
    timeout: 60000,
    env: { XDG_CONFIG_HOME: "/tmp/kunstkiezer-wrangler-config", WRANGLER_LOG_PATH: "/tmp/kunstkiezer-e2e-wrangler.log", WRANGLER_SEND_METRICS: "false" },
  },
});
