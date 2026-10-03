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

type Snapshot = { processes: Array<{ role: string; cpuPercent: number }>; frames: unknown[] };
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
