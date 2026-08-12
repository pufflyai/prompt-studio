import { describe, expect, test } from "bun:test";
import { buildPlaywrightEnv } from "./run-playwright";

describe("buildPlaywrightEnv", () => {
  test("removes inherited API routing before starting Playwright", () => {
    const env = {
      PATH: "/usr/bin",
      PSTDIO_API_PORT: "19841",
      PSTDIO_API_URL: "http://localhost:19841",
    };

    const result = buildPlaywrightEnv(env, { apiPort: 3201, dashboardPort: 5175 }, "run-1");

    expect(result).toMatchObject({
      E2E_API_PORT: "3201",
      E2E_DASHBOARD_PORT: "5175",
      E2E_RUN_ID: "run-1",
      PATH: "/usr/bin",
    });
    expect(result.PSTDIO_API_PORT).toBeUndefined();
    expect(result.PSTDIO_API_URL).toBeUndefined();
  });
});
