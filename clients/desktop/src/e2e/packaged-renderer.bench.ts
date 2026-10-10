import { expect } from "@playwright/test";
import type { BenchmarkMetric } from "../testing/benchmark-budget";
import { test } from "../testing/packaged-fixture";
import { recordBenchmark } from "./benchmark-record";
import { disposePackagedApp, type PackagedApp } from "./packaged-app-helpers";
import { launchProject, openLabPreview, readSnapshot, setMonitoring } from "./packaged-performance-helpers";
import {
  IDLE_WINDOW_MS,
  measureRenderers,
  openRendererSession,
  type RendererBudget,
  rendererMetrics,
  SETTLE_MS,
} from "./performance-budget";

// Apple Silicon baselines over five runs: idle work stays below 0.2% of wall time
// and the streaming replay uses 28-38% script and 51-68% task time. Idle budgets
// catch a constant render loop; streaming budgets leave room for slower runners.
const IDLE_BUDGET: RendererBudget = { scriptShare: 0.02, taskShare: 0.05 };
const STREAMING_BUDGET: RendererBudget = { scriptShare: 0.6, taskShare: 0.9 };
// Monitoring runs in Electron main, which renderer CDP metrics cannot see.
const MONITORING_MAIN_CPU_BUDGET = 10;

for (const monitoring of [false, true]) {
  const state = monitoring ? "on" : "off";
  test(`idle workbench stays quiet with monitoring ${state}`, async () => {
    let app: PackagedApp | null = null;
    try {
      ({ app } = await launchProject("Idle"));
      if (monitoring) await setMonitoring(app.page, true);
      const workbench = await openRendererSession(app.page);
      await app.page.waitForTimeout(SETTLE_MS);

      const measured = await measureRenderers(`idle-monitoring-${state}`, { workbench }, () =>
        app!.page.waitForTimeout(IDLE_WINDOW_MS),
      );
      const metrics: BenchmarkMetric[] = rendererMetrics(measured, IDLE_BUDGET);
      if (monitoring) {
        const snapshot = await readSnapshot(app.page);
        await test.info().attach("idle-monitoring-main-process.json", {
          contentType: "application/json",
          body: JSON.stringify(snapshot?.processes, null, 2),
        });
        const main = snapshot?.processes.find((process) => process.role === "main");
        metrics.push({
          name: "main-process-cpu",
          unit: "percent",
          value: main?.cpuPercent ?? Number.NaN,
          budget: MONITORING_MAIN_CPU_BUDGET,
        });
      }
      await recordBenchmark({
        name: `idle-workbench-monitoring-${state}`,
        scenario: `Open project start page with performance monitoring ${state}`,
        workload: "No user input",
        measuredProcess: "Workbench renderer main thread (CDP); Electron main CPU when monitoring is on",
        start: `${SETTLE_MS} ms after the start page is visible`,
        end: `${IDLE_WINDOW_MS} ms later`,
        metrics,
      });
    } finally {
      await disposePackagedApp(app);
    }
  });
}

test("idle extension preview stays quiet", async () => {
  let app: PackagedApp | null = null;
  try {
    ({ app } = await launchProject("Preview"));
    await openLabPreview(app.page);
    const lab = app.page.frames().find((frame) => frame.url().includes("/v1/extensions/webviews/"));
    expect(lab).toBeDefined();
    const renderers = { workbench: await openRendererSession(app.page), lab: await openRendererSession(app.page, lab) };
    await app.page.waitForTimeout(SETTLE_MS);

    const measured = await measureRenderers("idle-extension-preview", renderers, () =>
      app!.page.waitForTimeout(IDLE_WINDOW_MS),
    );
    await recordBenchmark({
      name: "idle-extension-preview",
      scenario: "Fixture Lab webview open beside the workbench",
      workload: "No user input",
      measuredProcess: "Workbench and Lab renderer main threads (CDP)",
      start: `${SETTLE_MS} ms after the Lab heading is visible`,
      end: `${IDLE_WINDOW_MS} ms later`,
      metrics: rendererMetrics(measured, IDLE_BUDGET),
    });
  } finally {
    await disposePackagedApp(app);
  }
});

test("long tool-heavy stream stays within budget", async () => {
  let app: PackagedApp | null = null;
  try {
    const launched = await launchProject("Streaming");
    app = launched.app;
    await setMonitoring(app.page, true);
    const workbench = await openRendererSession(app.page);
    const session = await app.page.evaluate(async (projectId) => {
      const response = await fetch("/v1/sessions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${localStorage.getItem("pstdio.browserSession")}`,
        },
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

    const status = async () => {
      const response = await fetch(`${app!.runtime.origin}/v1/sessions/${session.id}`, {
        headers: { authorization: `Bearer ${app!.runtime.token}` },
      });
      expect(response.ok).toBe(true);
      return ((await response.json()) as { status: string }).status;
    };
    const measured = await measureRenderers("streaming-replay", { workbench }, () =>
      expect.poll(status, { intervals: [250], timeout: 15_000 }).toBe("completed"),
    );
    await expect(app.page.getByText(/^Step 30\./).first()).toBeVisible();
    await recordBenchmark({
      name: "streaming-replay",
      scenario: "Open session receiving the fake agent's long replay with monitoring on",
      workload: "30 assistant turns, 8 text updates each at 25 ms intervals, one tool result per turn",
      measuredProcess: "Workbench renderer main thread (CDP)",
      start: "Step 1 is visible",
      end: "The API reports the session completed (250 ms polling)",
      metrics: rendererMetrics(measured, STREAMING_BUDGET),
    });
  } finally {
    await disposePackagedApp(app);
  }
});
