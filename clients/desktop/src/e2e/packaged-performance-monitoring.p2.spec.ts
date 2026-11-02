import { expect, type Page } from "@playwright/test";
import { parseExtensionWebviewPath } from "pstdio-api-contracts/extension-webview-path";
import { test } from "../testing/packaged-fixture";
import {
  createPackagedHome,
  disposePackagedApp,
  launchPackagedApp,
  type PackagedApp,
  runPackagedCli,
} from "./packaged-app-helpers";
import {
  launchProject,
  openLabPreview,
  type PerformanceSnapshot,
  performanceDetails,
  performanceMeter,
  readSnapshot,
  stopMonitoring,
} from "./packaged-performance-helpers";

// Renderer CPU budgets are benchmarks in packaged-renderer.p3.bench.ts.

test("Windows diagnostics work independently of PATH", async () => {
  test.skip(process.platform !== "win32", "Windows permission tools");
  const home = createPackagedHome();
  let app: PackagedApp | null = null;
  try {
    app = await launchPackagedApp(home, { PATH: home, PSTDIO_DEFAULT_EXTENSIONS: "[]" });
    await app.page.evaluate(async () => {
      const desktop = (
        window as unknown as {
          promptStudioDesktop: { setPerformanceMonitoring: (enabled: boolean) => Promise<unknown> };
        }
      ).promptStudioDesktop;
      await desktop.setPerformanceMonitoring(true);
    });
    await expect.poll(() => readSnapshot(app!.page)).not.toBeNull();
    expect((await runPackagedCli(home, ["performance"])).exitCode).toBe(0);
  } finally {
    await disposePackagedApp(app);
  }
});

// Every distinct number of popover rows for extension `key` seen while sampling for `ms`.
const rowCountsWhile = async (page: Page, key: string, ms: number) => {
  const details = page.frames().find((frame) => frame.url().includes("details"));
  if (!details) throw new Error("The performance details view is not open");
  return details.evaluate(
    async ({ key, ms }) => {
      const seen = new Set<number>();
      const end = performance.now() + ms;
      while (performance.now() < end) {
        seen.add(document.querySelectorAll(`[data-testid="performance-cpu-row"][data-key="${key}"]`).length);
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return [...seen].sort();
    },
    { key, ms },
  );
};

// Runs a 120 ms task as an ordinary page task, the way slow app code would.
const forceSlowFrame = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<{ startedAt: number; endedAt: number }>((resolve) =>
        setTimeout(() => {
          const startedAt = performance.timeOrigin + performance.now();
          const end = performance.now() + 120;
          while (performance.now() < end) {}
          resolve({ startedAt, endedAt: performance.timeOrigin + performance.now() });
        }),
      ),
  );

const overlapsTask = (frame: PerformanceSnapshot["frames"][number], task: { startedAt: number; endedAt: number }) => {
  const startedAt = Date.parse(frame.startedAt);
  return startedAt < task.endedAt && startedAt + frame.durationMs > task.startedAt;
};

test("keeps reporting slow frames after the workbench reloads", async () => {
  let app: PackagedApp | null = null;
  try {
    ({ app } = await launchProject("Reload", { monitoring: true }));
    const frames = async () => (await readSnapshot(app!.page))?.frames ?? [];
    await expect
      .poll(async () => (await readSnapshot(app!.page))?.capabilities.slowFrames)
      .toMatch(/^(long-animation-frame|longtask)$/);
    const firstTask = await forceSlowFrame(app.page);
    await expect.poll(async () => (await frames()).some((frame) => overlapsTask(frame, firstTask))).toBe(true);

    await app.page.addInitScript(() => {
      const observe = PerformanceObserver.prototype.observe;
      PerformanceObserver.prototype.observe = function (options) {
        observe.call(this, options);
        if (options?.type === "long-animation-frame" || options?.type === "longtask")
          (window as unknown as { slowFrameObserverReady: boolean }).slowFrameObserverReady = true;
      };
    });
    await app.page.reload();
    await expect(app.page.getByTestId("start-page")).toBeVisible();
    await expect.poll(async () => (await readSnapshot(app!.page)) !== null).toBe(true);
    await app.page.waitForFunction(
      () => (window as unknown as { slowFrameObserverReady?: boolean }).slowFrameObserverReady === true,
    );
    const secondTask = await forceSlowFrame(app.page);
    await expect.poll(async () => (await frames()).some((frame) => overlapsTask(frame, secondTask))).toBe(true);
  } finally {
    await disposePackagedApp(app);
  }
});

test("names the process that hosts an extension and ends its frames when paused", async () => {
  let app: PackagedApp | null = null;
  try {
    ({ app } = await launchProject("Extension processes", { monitoring: true }));
    const processes = async () => (await readSnapshot(app!.page))?.processes ?? [];
    const extensionProcesses = async () =>
      (await processes()).filter((process) => process.role === "extension-frames" && process.extensionFrames.length);
    const hostedIds = (process: PerformanceSnapshot["processes"][number]) =>
      new Set(process.extensionFrames.map((frame) => frame.installedExtensionId));

    await openLabPreview(app.page);
    const source = await app.page
      .frameLocator('iframe[title="Lab"]')
      .locator("html")
      .evaluate(() => location.pathname);
    const scope = parseExtensionWebviewPath(source)?.scope;
    expect(scope).toBeDefined();
    const fixtureId = scope!.installedExtensionId;
    await expect
      .poll(async () => (await extensionProcesses()).some((process) => hostedIds(process).has(fixtureId)))
      .toBe(true);
    const fixtureProcess = (await extensionProcesses()).find((process) => hostedIds(process).has(fixtureId))!;
    const workbench = (await processes()).find((process) => process.role === "workbench");
    expect(fixtureProcess.pid).not.toBe(workbench?.pid);

    await expect(app.page.locator('iframe[title="Lab"]')).toHaveCount(1);
    await performanceMeter(app.page).click();
    // Each extension has its own row, named from its webview ids, even in a shared process.
    const row = performanceDetails(app.page)
      .getByTestId("performance-cpu-row")
      .filter({ hasText: "workbench-fixture" });
    await expect(row).toBeVisible();
    const pause = row.getByRole("button", { name: "Pause workbench-fixture", exact: true });
    // Enter the live CPU list before clicking: pointer entry freezes its order,
    // which can otherwise move the target between Playwright's stability check and input.
    await pause.hover();
    // Pausing and resuming must never show the extension twice or drop its row.
    let rows = rowCountsWhile(app.page, fixtureId, 4_000);
    await pause.click();
    expect(await rows).toEqual([1]);
    await expect(app.page.locator('iframe[title="Lab"]')).toHaveCount(0);
    await expect.poll(async () => (await readSnapshot(app!.page))?.pausedExtensionIds).toEqual([fixtureId]);
    await expect.poll(async () => (await processes()).some((process) => hostedIds(process).has(fixtureId))).toBe(false);

    // A paused row keeps the name it had while its views ran.
    const resume = row.getByRole("button", { name: "Resume workbench-fixture", exact: true });
    await resume.hover();
    rows = rowCountsWhile(app.page, fixtureId, 4_000);
    await resume.click();
    expect(await rows).toEqual([1]);
    await expect(app.page.locator('iframe[title="Lab"]')).toHaveCount(1);
  } finally {
    await disposePackagedApp(app);
  }
});

test("shares the performance snapshot with people and agents until monitoring stops", async () => {
  let app: PackagedApp | null = null;
  try {
    ({ app } = await launchProject("Shared snapshot", { monitoring: true }));

    // A person and an agent read the same local snapshot through their own interface.
    // The first snapshot has no processes until monitoring takes its first sample.
    await expect
      .poll(async () => (await readSnapshot(app!.page))?.processes.map((process) => process.role))
      .toContain("workbench");
    const agent = await runPackagedCli(app.home, ["performance"]);
    expect(agent.exitCode).toBe(0);
    expect((JSON.parse(agent.stdout) as PerformanceSnapshot).processes.map((p) => p.role)).toContain("workbench");

    await stopMonitoring(app.page);
    const stopped = await runPackagedCli(app.home, ["performance"]);
    expect(stopped.exitCode).not.toBe(0);
    expect(stopped.stdout).toBe("");
  } finally {
    await disposePackagedApp(app);
  }
});
