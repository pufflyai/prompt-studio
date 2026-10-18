import { beforeAll, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { logTestPhase } from "../scripts/log-test-phase";
import { runTestCommand } from "../scripts/run-test-command";
import { writeSmokeExtension } from "./extension-smoke-fixtures";
import { PROVISIONED_CHROMIUM } from "./packaged-chromium";
import { buildBinary, PACKAGED_BINARY_PATH } from "./packaged-helpers";

beforeAll(buildBinary, 180_000);

test("installs the smoke browser without external JavaScript runtimes", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-browser-consumer-"));
  const callerManifest = JSON.stringify({ name: "browser-setup-consumer", private: true });
  writeFileSync(join(root, "package.json"), callerManifest);
  try {
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toUpperCase() !== "PATH"));
    logTestPhase("install packaged Chromium without JavaScript runtimes");
    const result = await runTestCommand(PACKAGED_BINARY_PATH, ["extensions", "install-browser"], {
      cwd: root,
      env: {
        ...env,
        PATH: "",
        PSTDIO_HOME: join(root, "home"),
      },
    });
    expect({ code: result.status, output: result.stderr }).toMatchObject({ code: 0 });
    expect(existsSync(join(root, "home", "runtime.json"))).toBe(false);
    logTestPhase("launch installed Chromium");
    const browser = await chromium.launch(PROVISIONED_CHROMIUM);
    try {
      logTestPhase("open browser validation page");
      const page = await browser.newPage();
      expect(await page.evaluate(() => 6 * 7)).toBe(42);
    } finally {
      await browser.close();
    }
    expect(readFileSync(join(root, "package.json"), "utf8")).toBe(callerManifest);
    expect(existsSync(join(root, "bun.lock"))).toBe(false);
    expect(existsSync(join(root, "node_modules"))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);

test("a missing Playwright install is a setup error with browser setup instructions", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-browser-missing-"));
  try {
    const source = writeSmokeExtension(root);
    logTestPhase("run extension smoke with missing Playwright");
    const run = await runTestCommand(
      PACKAGED_BINARY_PATH,
      ["extensions", "test", source, "--json"],
      {
        cwd: root,
        env: { ...process.env, PSTDIO_HOME: join(root, "home") },
      },
      3,
    );
    expect(run.status).toBe(3);
    expect(JSON.parse(run.stdout).checks).toContainEqual(
      expect.objectContaining({
        id: "setup",
        phase: "setup",
        status: "failed",
        message: expect.stringContaining("pst extensions install-browser"),
      }),
    );
    expect(existsSync(join(root, "home", "runtime.json"))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the installed Playwright cache runs a packaged extension page outside the checkout", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-browser-page-"));
  try {
    const env = { ...process.env, PSTDIO_HOME: join(root, "home") };
    logTestPhase("install browser into consumer cache");
    const installed = await runTestCommand(PACKAGED_BINARY_PATH, ["extensions", "install-browser"], {
      cwd: root,
      env,
    });
    expect({ code: installed.status, output: installed.stderr }).toMatchObject({ code: 0 });
    const source = writeSmokeExtension(root);
    logTestPhase("run extension page smoke with installed cache");
    const run = await runTestCommand(PACKAGED_BINARY_PATH, ["extensions", "test", source, "--json"], {
      cwd: root,
      env,
    });
    const result = JSON.parse(run.stdout);
    expect({ code: run.status, result }).toMatchObject({ code: 0, result: { exitCode: 0 } });
    expect(result.coverage.visited).toContain("test.smoke.page.overview");
    expect(result.browser.name).toBe("chromium");
    expect(existsSync(join(root, "home", "runtime.json"))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);
