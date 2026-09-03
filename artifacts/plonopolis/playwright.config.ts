import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseUrl ?? "http://127.0.0.1:22294";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["line"]] : "list",
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "pnpm --filter @workspace/plonopolis run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        env: {
          PORT: "22294",
          BASE_PATH: "/",
        },
      },
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});