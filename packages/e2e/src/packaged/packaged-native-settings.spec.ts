import type { ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium, expect, firefox, test, webkit } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { stopPendingTestProcesses } from "../scripts/pending-test-processes";
import { PROVISIONED_CHROMIUM } from "./packaged-chromium";
import { buildBinary } from "./packaged-helpers";
import { verifyPackagedNativeSettings } from "./packaged-native-settings";
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
  browserTest(
    `packaged native settings save rapid edits, preserve drafts, and use one scrollbar in ${type.name()}`,
    async () => {
      const root = realpathSync(mkdtempSync(join(tmpdir(), "pstdio-packaged-native-settings-")));
      let child: ChildProcess | null = null;
      let browser: Browser | null = null;
      try {
        expect(available).toBe(true);
        const started = await startPackagedServe(root, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
        child = started.child;
        const folder = join(root, "project");
        mkdirSync(folder);
        const headers = runtimeAuthorization(started.descriptor);
        const response = await fetch(`${started.baseUrl}/v1/projects`, {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify(folderProjectInput({ name: "native-settings" }, folder)),
        });
        expect(response.status).toBe(201);
        const project = (await response.json()) as { id: string };
        browser = await type.launch({ headless: true, ...launchOptions });
        const page = await browser.newPage();
        await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
        await signInBrowser(page, started.descriptor);
        await page.goto(`${started.baseUrl}/projects/${project.id}/sessions`);
        await page.getByText("Settings", { exact: true }).last().click();
        await verifyPackagedNativeSettings(page, { baseUrl: started.baseUrl, projectId: project.id, root, headers });
      } finally {
        await browser?.close();
        if (child) await stopProcess(child);
        rmSync(root, { force: true, recursive: true });
      }
    },
  );
}
