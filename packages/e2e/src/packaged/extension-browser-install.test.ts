import { beforeAll, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { buildBinary, PACKAGED_BINARY_PATH } from "./packaged-helpers";

beforeAll(buildBinary, 180_000);

test("installs the smoke browser without external JavaScript runtimes", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-browser-consumer-"));
  const callerManifest = JSON.stringify({ name: "browser-setup-consumer", private: true });
  writeFileSync(join(root, "package.json"), callerManifest);
  // A file, not a pipe: on Windows the timeout kills only pstdio, and its install children would
  // keep a pipe open until the test times out without showing which step stalled.
  const logPath = join(root, "install-browser.log");
  const log = openSync(logPath, "w");
  try {
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toUpperCase() !== "PATH"));
    const result = spawnSync(PACKAGED_BINARY_PATH, ["extensions", "install-browser"], {
      cwd: root,
      env: {
        ...env,
        PATH: "",
        PSTDIO_HOME: join(root, "home"),
      },
      stdio: ["ignore", log, log],
      timeout: 29_000,
    });
    closeSync(log);
    expect({ code: result.status, output: readFileSync(logPath, "utf8") }).toMatchObject({ code: 0 });
    expect(existsSync(join(root, "home", "runtime.json"))).toBe(false);
    const browser = await chromium.launch({ executablePath: chromium.executablePath() });
    try {
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
