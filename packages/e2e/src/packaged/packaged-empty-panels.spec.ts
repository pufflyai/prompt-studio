import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium, expect, test } from "@playwright/test";
import { e2eExtensions } from "../default-extensions";
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
    const started = await test.step("Start the packaged runtime", () =>
      startPackagedServe(root, { PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("workbench-fixture") }));
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
    await test.step("Add tools while preserving the other empty panel", () => verifyEmptyPanelAddition(page));
    await test.step("Place panels and cancel from the grab point", () => verifyPanelInsertionTargets(page));
    await test.step("Close a session back to the shared New session page", async () => {
      const sessionsUrl = `${started.baseUrl}/projects/${project.id}/sessions`;
      await page.goto(sessionsUrl);
      const editor = page.locator('[data-testid="content-editable"][contenteditable="true"]:visible');
      await editor.fill("Packaged new-session draft");
      const created = await page.request.post(`${started.baseUrl}/v1/sessions`, {
        headers: runtimeAuthorization(started.descriptor),
        data: {
          project_id: project.id,
          title: "Packaged session",
          prompt: "Hello",
          agent: "pstdio.workbench-fixture.harness.fake",
        },
      });
      expect(created.ok()).toBe(true);
      await page.getByRole("option", { name: "Packaged session", exact: true }).click();
      await page.getByRole("button", { name: "Close Packaged session", exact: true }).click();
      await expect(page).toHaveURL(sessionsUrl);
      await expect(editor).toHaveText("Packaged new-session draft");
      await page.getByRole("button", { name: "Page actions", exact: true }).click();
      await page.getByRole("menuitem", { name: "New session", exact: true }).click();
      await expect(page).toHaveURL(sessionsUrl);
      await page.reload();
      await expect(editor).toHaveText("Packaged new-session draft");
      await page.getByRole("button", { name: "Close New session", exact: true }).click();
      await expect(editor).toHaveCount(0);
      await expect(page).toHaveURL(sessionsUrl);
      await page.keyboard.press("ControlOrMeta+Alt+s");
      await expect(page).toHaveURL(sessionsUrl);
      await expect(editor).toHaveText("Packaged new-session draft");
    });
  } finally {
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});
