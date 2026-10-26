import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { e2eExtensions } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { stopPendingTestProcesses } from "../scripts/pending-test-processes";
import { type Browser, chromium, expect, test } from "../scripts/playwright-test";
import { PROVISIONED_CHROMIUM } from "./packaged-chromium";
import { buildBinary } from "./packaged-helpers";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

test.afterEach(stopPendingTestProcesses);
test.beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
});

for (const destination of ["start", "extension", "navigate-away"] as const) {
  test(`opens core navigation before extension metadata (${destination})`, async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-extension-metadata-"));
    const loading = Promise.withResolvers<void>();
    const requested = Promise.withResolvers<void>();
    let child: ChildProcess | undefined;
    let browser: Browser | undefined;
    try {
      const runtime = await startPackagedServe(root, { PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("workbench-fixture") });
      child = runtime.child;
      const folder = join(root, "project");
      mkdirSync(folder);
      const created = await fetch(`${runtime.baseUrl}/v1/projects`, {
        method: "POST",
        headers: { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "Deferred extensions" }, folder)),
      });
      expect(created.status).toBe(201);
      const project = (await created.json()) as { id: string };
      browser = await chromium.launch(PROVISIONED_CHROMIUM);
      const page = await browser.newPage();
      await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
      await page.route("**/extensions/ui", async (route) => {
        requested.resolve();
        await loading.promise;
        await route.continue();
      });
      await signInBrowser(page, runtime.descriptor);
      const projectUrl = `${runtime.baseUrl}/projects/${project.id}`;
      const destinationUrl =
        destination === "start" ? projectUrl : `${projectUrl}/extensions/pstdio.workbench-fixture/lab`;
      await page.goto(destinationUrl);
      await requested.promise;
      await expect(page.getByRole("option", { name: "Sessions", exact: true })).toBeVisible();
      if (destination === "start") {
        await expect(page.getByTestId("start-page")).toBeVisible();
        await expect(page.getByRole("link", { name: "New conversation", exact: true })).toBeEnabled();
      } else {
        await expect(page).toHaveURL(destinationUrl);
      }
      await expect(page.getByRole("option", { name: "Lab mode", exact: true })).toHaveCount(0);
      if (destination === "navigate-away") await page.getByRole("option", { name: "Sessions", exact: true }).click();
      const registered = page.waitForEvent("console", {
        predicate: (message) =>
          message.text().includes('"event":"registration-ready"') && message.text().includes(project.id),
      });
      loading.resolve();
      await registered;
      if (destination === "extension") await expect(page.locator('iframe[title="Lab"]')).toBeVisible();
      if (destination === "start") await expect(page.getByTestId("start-page")).toBeVisible();
      if (destination === "navigate-away") await expect(page).toHaveURL(`${projectUrl}/sessions/compose`);
      // A page with its own navigation replaces the project rows. Return to Start
      // after proving restoration so the extension's root entry is visible again.
      if (destination !== "start") await page.goto(projectUrl);
      await expect(page.getByRole("option", { name: "Lab mode", exact: true })).toBeVisible();
      await page.getByRole("option", { name: "Lab mode", exact: true }).click();
      await expect(page.getByRole("tab", { name: "Artifacts", exact: true })).toBeVisible();
    } finally {
      loading.resolve();
      await browser?.close();
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  });
}
