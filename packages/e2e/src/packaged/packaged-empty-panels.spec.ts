import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium, expect, test } from "@playwright/test";
import { e2eExtensions } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import {
  expectNoDefaultHomePlaceholder,
  observeHomeLoading,
  verifyFastHeaderNavigation,
  verifyPageHeaderChoices,
} from "../helpers/home-loading";
import { stopPendingTestProcesses } from "../scripts/pending-test-processes";
import { verifyEmptyPanelAddition } from "./packaged-empty-panel-addition";
import { buildBinary } from "./packaged-helpers";
import { verifyPanelInsertionTargets } from "./packaged-panel-insertion";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

test.afterEach(stopPendingTestProcesses);
test.afterAll(stopPendingTestProcesses);
test.beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
});

test("adding a tool keeps the other empty panel open", async () => {
  const startedAt = Date.now();
  const phase = (name: string) => console.log(`Packaged empty panels: ${name} (${Date.now() - startedAt}ms)`);
  const root = realpathSync(mkdtempSync(join(tmpdir(), "pstdio-empty-panels-")));
  let child: ChildProcess | null = null;
  let browser: Browser | null = null;
  try {
    const started = await test.step("Start the packaged runtime", () =>
      startPackagedServe(root, { PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("pstdio-artifacts") }));
    child = started.child;
    phase("runtime ready; create project");
    const folder = join(root, "project");
    mkdirSync(folder);
    const response = await fetch(`${started.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "empty-panels" }, folder)),
    });
    expect(response.status).toBe(201);
    const project = (await response.json()) as { id: string };
    phase("project created; launch browser");
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    phase("browser ready; sign in");
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await signInBrowser(page, started.descriptor);
    phase("signed in; open project");
    await observeHomeLoading(page);
    await page.goto(`${started.baseUrl}/projects/${project.id}/`);
    await expect(page.getByText("Project home", { exact: true })).toBeVisible();
    await expectNoDefaultHomePlaceholder(page);
    await verifyPageHeaderChoices(page);
    await verifyFastHeaderNavigation(page);
    const mainEdge = page.getByLabel("Main header edge", { exact: true });
    await expect(mainEdge).toBeVisible();
    await mainEdge.focus();
    await mainEdge.press("Shift+F10");
    await page.getByRole("menuitem", { name: "Show header", exact: true }).click();
    const mainHeader = page.getByLabel("Main panel header", { exact: true });
    await expect(mainHeader).toBeVisible();
    await expect(mainHeader.getByRole("tab")).toHaveCount(0);
    await mainHeader.focus();
    await mainHeader.press("Shift+F10");
    await page.getByRole("menuitem", { name: "Hide header", exact: true }).click();
    await expect(mainEdge).toBeVisible();
    phase("project ready; check panel additions");
    await test.step("Add tools while preserving the other empty panel", () => verifyEmptyPanelAddition(page));
    phase("panel additions checked");
    await page.getByRole("option", { name: "Artifacts", exact: true }).click();
    await page
      .locator('[data-workbench-panel="main"]')
      .getByRole("tab", { name: "Artifacts", exact: true })
      .getByRole("button", { name: "Close Artifacts", exact: true })
      .click();
    await mainHeader.focus();
    await mainHeader.press("Shift+F10");
    await page.getByRole("menuitem", { name: "Hide header", exact: true }).click();
    await test.step("Place panels and cancel from the grab point", () => verifyPanelInsertionTargets(page));
  } finally {
    phase("cleanup");
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});
