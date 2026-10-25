import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";
import { stopPendingTestProcesses } from "../scripts/pending-test-processes";
import { type Browser, chromium, expect, test } from "../scripts/playwright-test";
import { buildBinary, runPackaged } from "./packaged-helpers";
import { plannerCommands } from "./packaged-planner-runtime-fixture";
import { preparePlannerSource } from "./packaged-planner-source";
import { expectPlannerWindow } from "./packaged-planner-window-smoke";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

test.afterEach(stopPendingTestProcesses);
test.afterAll(stopPendingTestProcesses);
test.beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
});

test("Planner keeps long dependency chains usable with a bounded card window", async () => {
  const home = mkdtempSync(join(tmpdir(), "pstdio-packaged-planner-window-"));
  let child: ChildProcess | undefined;
  let browser: Browser | undefined;
  try {
    const started = await startPackagedServe(home, { PSTDIO_EXTENSION_WEBVIEW_BUILDS: "1" });
    child = started.child;
    const folder = join(home, "project");
    mkdirSync(folder);
    const response = await fetch(`${started.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Planner window" }, folder)),
    });
    expect(response.status).toBe(201);
    const project = await response.json();
    // Planner uses SDK and UI APIs that may not be on npm yet, so install it with the workspace builds.
    const plannerSource = await preparePlannerSource(join(home, "fixtures", "current-planner"));
    runPackaged(`extensions add ${plannerSource} --name pstdio-planner`, folder, {
      HOME: home,
      PSTDIO_HOME: home,
    });
    const execute = plannerCommands({
      baseUrl: started.baseUrl,
      headers: runtimeAuthorization(started.descriptor),
      projectId: project.id,
    });
    const track = await execute("timeline.track.create", { name: "Product" });
    browser = await chromium.launch({ headless: true });
    const page = await (await browser.newContext()).newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      if (window.top === window) localStorage.setItem("onboarding-complete", "true");
    });
    await signInBrowser(page, started.descriptor);
    await page.goto(`${started.baseUrl}/projects/${project.id}/extensions/pstdio.pstdio-planner/ticket-timeline`);
    const timeline = page.locator('[data-workbench-region="main"]').frameLocator("iframe");
    await expect(timeline.locator("[data-timeline-viewport]")).toBeVisible();
    await expectPlannerWindow(timeline, execute, track.id);
    expect(errors).toEqual([]);
  } finally {
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(home, { recursive: true, force: true });
  }
});
