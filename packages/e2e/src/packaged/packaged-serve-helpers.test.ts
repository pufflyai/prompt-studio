import { beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { buildBinary } from "./packaged-helpers";
import { signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

beforeAll(buildBinary);

test("browser sign-in completes authentication before the caller navigates", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-browser-sign-in-"));
  const runtime = await startPackagedServe(root);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      const readJson = Response.prototype.json;
      Response.prototype.json = async function () {
        const value = await readJson.call(this);
        // The response event arrives before the dashboard finishes consuming its body.
        if (new URL(this.url).pathname === "/runtime/browser-session")
          await new Promise((resolve) => setTimeout(resolve, 150));
        return value;
      };
    });
    await signInBrowser(page, runtime.descriptor);
    const isAuthenticated = () =>
      page.evaluate(async () => {
        const secret = localStorage.getItem("pstdio.browserSession");
        const response = await fetch("/runtime/ready", {
          headers: secret ? { authorization: `Bearer ${secret}` } : {},
        });
        return response.status;
      });
    expect(await isAuthenticated()).toBe(200);
    await page.reload();
    expect(await isAuthenticated()).toBe(200);
  } finally {
    await browser.close();
    await stopProcess(runtime.child);
    rmSync(root, { recursive: true, force: true });
  }
});
