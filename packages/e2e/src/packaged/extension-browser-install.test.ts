import { beforeAll, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { buildBinary, PACKAGED_BINARY_PATH } from "./packaged-helpers";

beforeAll(buildBinary, 180_000);

test("installs the smoke browser without external JavaScript runtimes", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-browser-consumer-"));
  const browserCache = join(root, "browsers");
  const callerManifest = JSON.stringify({ name: "browser-setup-consumer", private: true });
  writeFileSync(join(root, "package.json"), callerManifest);
  try {
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toUpperCase() !== "PATH"));
    const result = spawnSync(PACKAGED_BINARY_PATH, ["extensions", "install-browser"], {
      cwd: root,
      env: {
        ...env,
        PATH: "",
        PSTDIO_HOME: join(root, "home"),
        BUN_INSTALL_CACHE_DIR: join(root, "bun-cache"),
        PLAYWRIGHT_BROWSERS_PATH: browserCache,
      },
      encoding: "utf8",
      timeout: 29_000,
    });
    expect({ code: result.status, stderr: result.stderr }).toMatchObject({ code: 0 });
    expect(existsSync(join(root, "home", "runtime.json"))).toBe(false);
    const browserPath = chromium.executablePath().match(/chromium-\d+[/\\].+$/)![0];
    const browser = await chromium.launch({ executablePath: join(browserCache, browserPath) });
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
