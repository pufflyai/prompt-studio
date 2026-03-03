import { defineConfig, devices } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const dashboardPort = Number(process.env.E2E_DASHBOARD_PORT ?? "5174");

export default defineConfig({
  testDir: "./src/ui",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: `http://localhost:${dashboardPort}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `bun run --cwd ../../packages/pstdio pstdio -- --api-port ${apiPort} --dashboard-port ${dashboardPort} --no-open-browser`,
    port: dashboardPort,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
