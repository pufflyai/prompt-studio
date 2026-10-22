import type { ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium, expect, firefox, test, webkit } from "@playwright/test";
import { writeEditingSessionExtension } from "../helpers/editing-session-extension";
import { folderProjectInput } from "../helpers/folder-project";
import { verifyEditingSession } from "../helpers/verify-editing-session";
import { stopPendingTestProcesses } from "../scripts/pending-test-processes";
import { PROVISIONED_CHROMIUM } from "./packaged-chromium";
import { buildBinary } from "./packaged-helpers";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

test.afterEach(stopPendingTestProcesses);
test.afterAll(stopPendingTestProcesses);
test.beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
});

for (const [type, launchOptions] of [
  [chromium, PROVISIONED_CHROMIUM],
  [firefox, {}],
  [webkit, {}],
] as const) {
  const available = existsSync(type.executablePath());
  const browserTest = available || process.env.E2E_REQUIRE_WEBVIEW_BROWSERS === "1" ? test : test.skip;
  browserTest(`packaged editing sessions preview, coalesce saves and cancel gestures in ${type.name()}`, async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "pstdio-packaged-editing-")));
    let child: ChildProcess | null = null;
    let browser: Browser | null = null;
    try {
      expect(available).toBe(true);
      const source = writeEditingSessionExtension(root);
      const started = await startPackagedServe(root, {
        PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({ defaultExtensions: [{ source, installName: "editing-fixture" }] }),
      });
      child = started.child;
      const folder = join(root, "project");
      mkdirSync(folder);
      const response = await fetch(`${started.baseUrl}/v1/projects`, {
        method: "POST",
        headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "Editing sessions" }, folder)),
      });
      expect(response.status).toBe(201);
      const project = (await response.json()) as { id: string };
      browser = await type.launch({ headless: true, ...launchOptions });
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.addInitScript(() => {
        if (window.top === window) localStorage.setItem("onboarding-complete", "true");
      });
      await signInBrowser(page, started.descriptor);
      await page.goto(`${started.baseUrl}/projects/${project.id}/extensions/test.editing-fixture/editing`);
      await verifyEditingSession(page);
    } finally {
      await browser?.close();
      if (child) await stopProcess(child);
      rmSync(root, { force: true, recursive: true });
    }
  });
}
