import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { playwrightQuarantineSelection } from "pstdio-scripts/test-quarantine";
import { buildPlaywrightEnv, runPlaywright } from "./run-playwright";

describe("buildPlaywrightEnv", () => {
  test("preserves the quarantine attempt identity through the UI launcher", () => {
    const env: NodeJS.ProcessEnv = buildPlaywrightEnv(
      { CI_QUARANTINE_ATTEMPT: "fresh-attempt", E2E_TEST_LANE: "quarantine" },
      { apiPort: 3201, dashboardPort: 5175 },
      "run-1",
    );
    const original = process.env.CI_QUARANTINE_ATTEMPT;
    try {
      process.env.CI_QUARANTINE_ATTEMPT = env.CI_QUARANTINE_ATTEMPT;
      const selection = playwrightQuarantineSelection("playwright-ui", "packages/e2e/src/ui", true);
      expect(selection).toHaveProperty("metadata.quarantineAttempt", "fresh-attempt");
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

    const result: NodeJS.ProcessEnv = buildPlaywrightEnv(env, { apiPort: 3201, dashboardPort: 5175 }, "run-1");

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

// Writes into the server home and Bun cache it is given, then reports them, like a Playwright run.
const fakeRun = (exitCode: number) => ({
  cmd: process.execPath,
  args: [
    "-e",
    `const { mkdirSync, writeFileSync } = require("node:fs");
    for (const dir of [process.env.E2E_HOME, process.env.E2E_BUN_CACHE_DIR]) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(dir + "/used", "1");
    }
    console.log(JSON.stringify([process.env.E2E_HOME, process.env.E2E_BUN_CACHE_DIR]));
    process.exit(${exitCode});`,
  ],
});

test("removes the run's server home and Bun cache when Playwright exits", async () => {
  const run = await runPlaywright(fakeRun(3), { PATH: process.env.PATH }, { stdio: "pipe" });
  const [home, cache] = JSON.parse(run.output) as [string, string];
  expect(run.exitCode).toBe(3);
  expect(existsSync(home)).toBe(false);
  expect(existsSync(cache)).toBe(false);
});

test("keeps a Bun cache the caller provides", async () => {
  const cache = mkdtempSync(join(tmpdir(), "caller-bun-cache-"));
  try {
    const run = await runPlaywright(
      fakeRun(0),
      { PATH: process.env.PATH, E2E_BUN_CACHE_DIR: cache },
      { stdio: "pipe" },
    );
    const [home] = JSON.parse(run.output) as [string, string];
    expect(existsSync(join(cache, "used"))).toBe(true);
    expect(existsSync(home)).toBe(false);
  } finally {
    rmSync(cache, { recursive: true, force: true });
  }
});

test("finishes fixture preparation before launching the browser tests", async () => {
  const run = await runPlaywright(
    { cmd: process.execPath, args: ["-e", "console.log(process.env.E2E_FIXTURE_READY)"] },
    { PATH: process.env.PATH },
    {
      stdio: "pipe",
      prepare: async (env) => {
        await Bun.sleep(1);
        env.E2E_FIXTURE_READY = "ready";
      },
    },
  );
  expect(run.exitCode).toBe(0);
  expect(run.output.trim()).toBe("ready");
});

test("cleans up when fixture preparation is interrupted", async () => {
  const launcher = Bun.spawn(
    [
      process.execPath,
      "-e",
      `const { runPlaywright } = await import(${JSON.stringify(new URL("./run-playwright.ts", import.meta.url).href)});
      const run = await runPlaywright(
        { cmd: process.execPath, args: ["-e", "process.exit(5)"] },
        { PATH: process.env.PATH },
        { stdio: "pipe", prepare: async (env, signal) => {
          console.log(env.E2E_HOME);
          await new Promise((resolve, reject) => signal.addEventListener("abort", reject, { once: true }));
        } },
      );
      process.exit(run.exitCode);`,
    ],
    { stdout: "pipe" },
  );
  const { value } = await launcher.stdout.getReader().read();
  const home = new TextDecoder().decode(value).trim();
  launcher.kill("SIGTERM");
  const exitCode = await launcher.exited;
  if (process.platform !== "win32") expect(exitCode).toBe(143);
  expect(existsSync(dirname(home))).toBe(false);
});

test("removes the run's folders when the launcher is stopped", async () => {
  const launcher = Bun.spawn(
    [
      process.execPath,
      "-e",
      `const { runPlaywright } = await import(${JSON.stringify(new URL("./run-playwright.ts", import.meta.url).href)});
      const run = await runPlaywright(
        {
          cmd: process.execPath,
          args: ["-e", "console.log(process.pid + ' ' + process.env.E2E_HOME); setInterval(() => {}, 1000)"],
        },
        { PATH: process.env.PATH },
      );
      process.exit(run.exitCode);`,
    ],
    { stdout: "pipe" },
  );
  const { value } = await launcher.stdout.getReader().read();
  const [pid, home] = new TextDecoder().decode(value).trim().split(" ") as [string, string];
  try {
    expect(existsSync(dirname(home))).toBe(true);
    launcher.kill("SIGTERM");
    const exitCode = await launcher.exited;
    if (process.platform !== "win32") expect(exitCode).toBe(143);
    expect(existsSync(dirname(home))).toBe(false);
  } finally {
    try {
      process.kill(Number(pid), "SIGKILL");
    } catch {}
    rmSync(dirname(home), { recursive: true, force: true });
  }
});

// POSIX signal termination reports a signal instead of a numeric child exit code.
describe.skipIf(process.platform === "win32")("POSIX child termination", () => {
  test.each([
    ["SIGINT", 130],
    ["SIGTERM", 143],
  ] as const)("preserves %s status while cleaning its owned folders", async (signal, exitCode) => {
    const run = await runPlaywright(
      {
        cmd: process.execPath,
        args: ["-e", `console.log(process.env.E2E_HOME); process.kill(process.pid, ${JSON.stringify(signal)})`],
      },
      { PATH: process.env.PATH },
      { stdio: "pipe" },
    );
    expect(run.exitCode).toBe(exitCode);
    expect(existsSync(dirname(run.output.trim()))).toBe(false);
  });
});
