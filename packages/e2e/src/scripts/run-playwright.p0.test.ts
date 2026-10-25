import { describe, expect, test } from "bun:test";
import { playwrightQuarantineSelection } from "pstdio-scripts/test-quarantine";
import { buildPlaywrightEnv } from "./run-playwright";

describe("buildPlaywrightEnv", () => {
  test("preserves the quarantine attempt identity through the UI launcher", () => {
    const env = buildPlaywrightEnv(
      { CI_QUARANTINE_ATTEMPT: "fresh-attempt", E2E_TEST_LANE: "quarantine" },
      { apiPort: 3201, dashboardPort: 5175 },
      "run-1",
    );
    const original = process.env.CI_QUARANTINE_ATTEMPT;
    try {
      process.env.CI_QUARANTINE_ATTEMPT = env.CI_QUARANTINE_ATTEMPT;
      const selection = playwrightQuarantineSelection("playwright-ui", "packages/e2e/src/ui", true);
      expect(selection.metadata?.quarantineAttempt).toBe("fresh-attempt");
      expect(env.E2E_TEST_LANE).toBe("quarantine");
    } finally {
      if (original === undefined) delete process.env.CI_QUARANTINE_ATTEMPT;
      else process.env.CI_QUARANTINE_ATTEMPT = original;
    }
  });

  test("removes inherited API routing before starting Playwright", () => {
    const env = {
      PATH: "/usr/bin",
      PSTDIO_API_PORT: "19841",
      PSTDIO_API_URL: "http://localhost:19841",
      PSTDIO_SESSION_ID: "developer-session",
      PSTDIO_RUNTIME_DESCRIPTOR: "/developer/runtime.json",
      E2E_AGENTS: "claude-code",
    };

    const result = buildPlaywrightEnv(env, { apiPort: 3201, dashboardPort: 5175 }, "run-1");

    expect(result).toMatchObject({
      E2E_API_PORT: "3201",
      E2E_DASHBOARD_PORT: "5175",
      E2E_RUN_ID: "run-1",
      PATH: "/usr/bin",
      E2E_AGENTS: "claude-code",
    });
    expect(result.PSTDIO_API_PORT).toBeUndefined();
    expect(result.PSTDIO_API_URL).toBeUndefined();
    expect(result.PSTDIO_SESSION_ID).toBeUndefined();
    expect(result.PSTDIO_RUNTIME_DESCRIPTOR).toBeUndefined();
  });
});

test("Playwright stops only P1 after a first failure", async () => {
  const { getPlaywrightCommand } = await import("./run-playwright");
  expect(getPlaywrightCommand(["selected.spec.ts"], "P1").args).toContain("--max-failures=1");
  for (const priority of ["P0", "P2", "P3"]) {
    const command = getPlaywrightCommand(["selected.spec.ts", "--max-failures=2", "-x"], priority);
    expect(command.args).toContain("selected.spec.ts");
    expect(command.args).toContain("--max-failures=0");
    expect(command.args).not.toContain("--max-failures=2");
    expect(command.args).not.toContain("-x");
  }
});
