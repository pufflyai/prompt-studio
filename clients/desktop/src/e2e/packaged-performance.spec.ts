import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";
import { test } from "../testing/packaged-fixture";
import {
  createPackagedHome,
  disposePackagedApp,
  launchPackagedApp,
  type PackagedApp,
  runPackagedCli,
} from "./packaged-app-helpers";
import { createPackagedProject, openPackagedProject } from "./packaged-project-helpers";
import {
  expectWithinBudget,
  IDLE_WINDOW_MS,
  measureRenderers,
  openRendererSession,
  type RendererBudget,
  SETTLE_MS,
} from "./performance-budget";

const fixturePath = dirname(fileURLToPath(import.meta.resolve("workbench-fixture/package.json")));

// Apple Silicon baselines over five runs: idle work stays below 0.2% of wall time
// and the streaming replay uses 28-38% script and 51-68% task time. Idle budgets
// catch a constant render loop; streaming budgets leave room for slower runners.
const IDLE_BUDGET: RendererBudget = { scriptShare: 0.02, taskShare: 0.05 };
const STREAMING_BUDGET: RendererBudget = { scriptShare: 0.6, taskShare: 0.9 };
// Monitoring runs in Electron main, which renderer CDP metrics cannot see.
const MONITORING_MAIN_CPU_BUDGET = 10;

type Snapshot = {
  processes: Array<{
    pid: number;
    role: string;
    cpuPercent: number;
    extensionFrames: Array<{ installedExtensionId: string }>;
  }>;
  frames: unknown[];
  pausedExtensionIds: string[];
};
type MonitoringBridge = { promptStudioDesktop: { getPerformanceSnapshot: () => Promise<Snapshot | null> } };

const launchProject = async (name: string) => {
  const home = createPackagedHome();
  const app = await launchPackagedApp(home, {
    PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({
      defaultExtensions: [{ source: fixturePath, installName: "workbench-fixture", skipInstall: true }],
    }),
  });
  const project = await createPackagedProject(app, name);
  await openPackagedProject(app.page, project);
  await expect(app.page.getByTestId("start-page")).toBeVisible();
  return { app, project };
};

const readSnapshot = (page: Page) =>
  page.evaluate(() => (window as unknown as MonitoringBridge).promptStudioDesktop.getPerformanceSnapshot());

// Uses the Settings switch, so the dashboard starts its slow-frame observer too.
const setMonitoring = async (page: Page, enabled: boolean) => {
  await page.getByRole("option", { name: "Settings", exact: true }).click();
  await page
    .getByRole("dialog")
    .filter({ hasText: "Developer tools" })
    .getByText("Performance", { exact: true })
    .click();
  const toggle = page.getByRole("checkbox", { name: "Enable performance monitoring", exact: true });
  await page.locator("label").filter({ has: toggle }).click();
  await expect(toggle).toBeChecked({ checked: enabled });
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await readSnapshot(page)) !== null).toBe(enabled);
};

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

for (const monitoring of [false, true]) {
  test(`keeps the idle workbench quiet with monitoring ${monitoring ? "on" : "off"}`, async () => {
    let app: PackagedApp | null = null;
    try {
      ({ app } = await launchProject("Idle"));
      if (monitoring) await setMonitoring(app.page, true);
      const workbench = await openRendererSession(app.page);
      await app.page.waitForTimeout(SETTLE_MS);

      const measured = await measureRenderers(`idle-monitoring-${monitoring ? "on" : "off"}`, { workbench }, () =>
        app!.page.waitForTimeout(IDLE_WINDOW_MS),
      );
      expectWithinBudget(measured.workbench!, IDLE_BUDGET);
      if (!monitoring) return;

      const snapshot = await readSnapshot(app.page);
      const main = snapshot?.processes.find((process) => process.role === "main");
      await test.info().attach("idle-monitoring-main-process.json", {
        contentType: "application/json",
        body: JSON.stringify(snapshot?.processes, null, 2),
      });
      expect(main?.cpuPercent).toBeLessThanOrEqual(MONITORING_MAIN_CPU_BUDGET);
    } finally {
      await disposePackagedApp(app);
    }
  });
}

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
    const hostedIds = (process: Snapshot["processes"][number]) =>
      new Set(process.extensionFrames.map((frame) => frame.installedExtensionId));

    await app.page.getByRole("option", { name: "Lab", exact: true }).click();
    await expect(
      app.page.frameLocator('iframe[title="Lab"]').getByRole("heading", { name: "Sandbox webview" }),
    ).toBeVisible();
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

test("keeps an idle extension preview quiet", async () => {
  let app: PackagedApp | null = null;
  try {
    ({ app } = await launchProject("Preview"));
    await app.page.getByRole("option", { name: "Lab", exact: true }).click();
    await expect(
      app.page.frameLocator('iframe[title="Lab"]').getByRole("heading", { name: "Sandbox webview" }),
    ).toBeVisible();
    const lab = app.page.frames().find((frame) => frame.url().includes("/v1/extensions/webviews/"));
    expect(lab).toBeDefined();
    const renderers = { workbench: await openRendererSession(app.page), lab: await openRendererSession(app.page, lab) };
    await app.page.waitForTimeout(SETTLE_MS);

    const measured = await measureRenderers("idle-extension-preview", renderers, () =>
      app!.page.waitForTimeout(IDLE_WINDOW_MS),
    );
    expectWithinBudget(measured.workbench!, IDLE_BUDGET);
    expectWithinBudget(measured.lab!, IDLE_BUDGET);
  } finally {
    await disposePackagedApp(app);
  }
});

test("streams a long tool-heavy conversation within budget and shares the snapshot with agents", async () => {
  let app: PackagedApp | null = null;
  try {
    const launched = await launchProject("Streaming");
    app = launched.app;
    await setMonitoring(app.page, true);
    const workbench = await openRendererSession(app.page);
    const session = await app.page.evaluate(async (projectId) => {
      const response = await fetch("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          title: "Long replay",
          prompt: "Replay __fake_long_stream__",
          agent: "pstdio.workbench-fixture.harness.fake",
        }),
      });
      return (await response.json()) as { id: string };
    }, launched.project.id);
    await app.page.getByRole("button", { name: "Long replay", exact: true }).click();
    await expect(app.page.getByText(/^Step 1\./).first()).toBeVisible();

    const status = () =>
      app!.page.evaluate(
        async (id) => ((await (await fetch(`/v1/sessions/${id}`)).json()) as { status: string }).status,
        session.id,
      );
    const measured = await measureRenderers("streaming-replay", { workbench }, () =>
      expect.poll(status, { intervals: [250], timeout: 15_000 }).toBe("completed"),
    );
    await expect(app.page.getByText(/^Step 30\./).first()).toBeVisible();
    expectWithinBudget(measured.workbench!, STREAMING_BUDGET);

    // A person and an agent read the same local snapshot through their own interface.
    const viewed = await readSnapshot(app.page);
    expect(viewed?.processes.map((process) => process.role)).toContain("workbench");
    const agent = await runPackagedCli(app.home, ["performance"]);
    expect(agent.exitCode).toBe(0);
    expect((JSON.parse(agent.stdout) as { processes: Array<{ role: string }> }).processes.map((p) => p.role)).toContain(
      "workbench",
    );

    await setMonitoring(app.page, false);
    const stopped = await runPackagedCli(app.home, ["performance"]);
    expect(stopped.exitCode).not.toBe(0);
    expect(stopped.stdout).toBe("");
  } finally {
    await disposePackagedApp(app);
  }
});
