import { expect, type Page } from "@playwright/test";
import { test } from "../testing/packaged-fixture";
import { disposePackagedApp, type PackagedApp, runPackagedCli } from "./packaged-app-helpers";
import {
  launchProject,
  openLabPreview,
  type PerformanceSnapshot,
  readSnapshot,
  setMonitoring,
} from "./packaged-performance-helpers";

// Renderer CPU budgets are benchmarks in packaged-renderer.bench.ts.

// Every distinct number of popover rows named `name` seen while sampling for `ms`.
const rowCountsWhile = (page: Page, name: string, ms: number) =>
  page.evaluate(
    async ({ name, ms }) => {
      const seen = new Set<number>();
      const end = performance.now() + ms;
      while (performance.now() < end) {
        seen.add(document.querySelectorAll(`[data-testid="performance-cpu-row"][data-name="${name}"]`).length);
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return [...seen].sort();
    },
    { name, ms },
  );

// Runs a 120 ms task as an ordinary page task, the way slow app code would.
const forceSlowFrame = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        setTimeout(() => {
          const end = performance.now() + 120;
          while (performance.now() < end) {}
          resolve();
        }),
      ),
  );

test("keeps reporting slow frames after the workbench reloads", async () => {
  let app: PackagedApp | null = null;
  try {
    ({ app } = await launchProject("Reload"));
    await setMonitoring(app.page, true);
    const frames = async () => (await readSnapshot(app!.page))?.frames.length ?? 0;
    await forceSlowFrame(app.page);
    await expect.poll(frames).toBeGreaterThan(0);

    const before = await frames();
    await app.page.reload();
    await expect(app.page.getByTestId("start-page")).toBeVisible();
    await forceSlowFrame(app.page);
    await expect.poll(frames).toBeGreaterThan(before);
  } finally {
    await disposePackagedApp(app);
  }
});

test("names the process that hosts an extension and ends its frames when paused", async () => {
  let app: PackagedApp | null = null;
  try {
    ({ app } = await launchProject("Extension processes"));
    await setMonitoring(app.page, true);
    const processes = async () => (await readSnapshot(app!.page))?.processes ?? [];
    const extensionProcesses = async () =>
      (await processes()).filter((process) => process.role === "extension-frames" && process.extensionFrames.length);
    const hostedIds = (process: PerformanceSnapshot["processes"][number]) =>
      new Set(process.extensionFrames.map((frame) => frame.installedExtensionId));

    await openLabPreview(app.page);
    await expect.poll(async () => (await extensionProcesses()).length).toBeGreaterThan(0);
    const fixtureProcess = (await extensionProcesses())[0]!;
    const fixtureId = [...hostedIds(fixtureProcess)][0]!;
    const workbench = (await processes()).find((process) => process.role === "workbench");
    expect(fixtureProcess.pid).not.toBe(workbench?.pid);

    await expect(app.page.locator('iframe[title="Lab"]')).toHaveCount(1);
    await app.page.getByTestId("performance-status-item").click();
    const row = app.page.getByTestId("performance-cpu-row").filter({ hasText: "Workbench fixture" });
    // Pausing and resuming must never show the extension twice or drop its row.
    let rows = rowCountsWhile(app.page, "Workbench fixture", 4_000);
    await row.getByRole("button", { name: "Pause Workbench fixture", exact: true }).click();
    expect(await rows).toEqual([1]);
    await expect(app.page.locator('iframe[title="Lab"]')).toHaveCount(0);
    await expect.poll(async () => (await readSnapshot(app!.page))?.pausedExtensionIds).toEqual([fixtureId]);
    await expect.poll(async () => (await processes()).some((process) => hostedIds(process).has(fixtureId))).toBe(false);

    rows = rowCountsWhile(app.page, "Workbench fixture", 4_000);
    await row.getByRole("button", { name: "Resume Workbench fixture", exact: true }).click();
    expect(await rows).toEqual([1]);
    await expect(app.page.locator('iframe[title="Lab"]')).toHaveCount(1);
  } finally {
    await disposePackagedApp(app);
  }
});

test("shares the performance snapshot with people and agents until monitoring stops", async () => {
  let app: PackagedApp | null = null;
  try {
    ({ app } = await launchProject("Shared snapshot"));
    await setMonitoring(app.page, true);

    // A person and an agent read the same local snapshot through their own interface.
    // The first snapshot has no processes until monitoring takes its first sample.
    await expect
      .poll(async () => (await readSnapshot(app!.page))?.processes.map((process) => process.role))
      .toContain("workbench");
    const agent = await runPackagedCli(app.home, ["performance"]);
    expect(agent.exitCode).toBe(0);
    expect((JSON.parse(agent.stdout) as PerformanceSnapshot).processes.map((p) => p.role)).toContain("workbench");

    await setMonitoring(app.page, false);
    const stopped = await runPackagedCli(app.home, ["performance"]);
    expect(stopped.exitCode).not.toBe(0);
    expect(stopped.stdout).toBe("");
  } finally {
    await disposePackagedApp(app);
  }
});
