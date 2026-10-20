import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium, expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
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
  const root = realpathSync(mkdtempSync(join(tmpdir(), "pstdio-empty-panels-")));
  let child: ChildProcess | null = null;
  let browser: Browser | null = null;
  try {
    const started = await startPackagedServe(root, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
    child = started.child;
    const folder = join(root, "project");
    mkdirSync(folder);
    const response = await fetch(`${started.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "empty-panels" }, folder)),
    });
    expect(response.status).toBe(201);
    const project = (await response.json()) as { id: string };
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await signInBrowser(page, started.descriptor);
    await page.goto(`${started.baseUrl}/projects/${project.id}/`);
    await expect(page.getByText("Project home", { exact: true })).toBeVisible();
    await verifyEmptyPanelAddition(page);
    await verifyPanelInsertionTargets(page);
  } finally {
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});
