import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium, expect } from "@playwright/test";
import { e2eExtensions } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { verifyNotesPageIsolation } from "../helpers/notes-page-isolation";
import { stopPendingTestProcesses } from "../scripts/pending-test-processes";
import { test } from "../scripts/playwright-test";
import { buildBinary } from "./packaged-helpers";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

test.afterEach(stopPendingTestProcesses);
test.afterAll(stopPendingTestProcesses);
test.beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
});

test("Notes offers note creation and restores its Main tabs separately from Artifacts", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "pstdio-notes-page-")));
  let child: ChildProcess | null = null;
  let browser: Browser | null = null;
  try {
    const started = await startPackagedServe(root, {
      PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("pstdio-artifacts", "pstdio-notes", "pstdio-planner"),
    });
    child = started.child;
    const folder = join(root, "project");
    mkdirSync(folder);
    const response = await fetch(`${started.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Notes page" }, folder)),
    });
    expect(response.status).toBe(201);
    const project = (await response.json()) as { id: string };
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.addInitScript(() => {
      if (window.top === window) localStorage.setItem("onboarding-complete", "true");
    });
    await signInBrowser(page, started.descriptor);
    await page.goto(`${started.baseUrl}/projects/${project.id}/`);
    // Critical creation path: palette creation must reach the editor without a parameter dialog.
    await expect(page.getByRole("button", { name: "Help", exact: true })).toBeVisible();
    await page.mouse.move(0, 0);
    await page.keyboard.press("Alt+Shift+K");
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await palette.getByRole("textbox").fill(">New note");
    await palette.getByRole("option", { name: /New note/ }).click();
    const main = page.locator('[data-workbench-panel="main"]');
    await expect(main.getByRole("tab", { name: "New note", exact: true })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await main.getByRole("button", { name: "Close New note", exact: true }).click();
    await verifyNotesPageIsolation(page);
  } finally {
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});
