import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { e2eExtensions } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { stopPendingTestProcesses } from "../scripts/pending-test-processes";
import { type Browser, chromium, expect, test } from "../scripts/playwright-test";
import { PROVISIONED_CHROMIUM } from "./packaged-chromium";
import { buildBinary } from "./packaged-helpers";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

test.use({ trace: "retain-on-failure" });
test.afterEach(stopPendingTestProcesses);
test.beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
});

test("a table row opens its artifact while statistics assets are delayed", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "packaged-statistics-")));
  let child: ChildProcess | undefined;
  let browser: Browser | undefined;
  let release = () => {};
  try {
    const runtime = await startPackagedServe(root, { PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("workbench-fixture") });
    child = runtime.child;
    const folder = join(root, "project");
    mkdirSync(folder);
    const response = await fetch(`${runtime.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Statistics" }, folder)),
    });
    expect(response.status).toBe(201);
    const project = (await response.json()) as { id: string };
    browser = await chromium.launch(PROVISIONED_CHROMIUM);
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const loading = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/data-table-stat*.js", async (route) => {
      await loading;
      await route.continue();
    });
    await page.addInitScript(() => {
      if (window.top === window) localStorage.setItem("onboarding-complete", "true");
    });
    await signInBrowser(page, runtime.descriptor);
    await page.goto(`${runtime.baseUrl}/projects/${project.id}`);
    await page.getByRole("option", { name: "Lab mode", exact: true }).click();
    await page.getByRole("tab", { name: "Artifacts", exact: true }).click();
    await expect(page.getByText("No artifacts found", { exact: true })).toBeVisible();
    const createMenu = page.locator('[data-workbench-panel-menu="main-right"]');
    const [createdResponse] = await Promise.all([
      page.waitForResponse(
        (result) =>
          new URL(result.url()).pathname.endsWith(
            "/pstdio.workbench-fixture.view.artifact-create.controls.onValueChange/execute",
          ) && result.request().method() === "POST",
      ),
      createMenu.getByRole("button", { name: "Random artifact", exact: true }).click(),
    ]);
    const created = (await createdResponse.json()) as { outcome: { value: { title: string } } };
    const cell = page.getByRole("cell", { name: created.outcome.value.title, exact: true });
    await expect(cell).toBeVisible();
    await expect(page.locator(".data-table-stats-row")).toBeVisible();
    const before = (await cell.boundingBox())!;
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
    await page.mouse.down();
    release();
    expect(await cell.boundingBox()).toEqual(before);
    await page.mouse.up();
    await expect(
      page.frameLocator('iframe[title="Artifact"]').getByRole("heading", { name: created.outcome.value.title }),
    ).toBeVisible();
  } finally {
    release();
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});
