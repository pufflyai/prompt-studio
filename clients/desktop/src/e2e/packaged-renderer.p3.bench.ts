import { expect } from "@playwright/test";
import type { BenchmarkMetric } from "pstdio-benchmarks";
import { rendererBudgets } from "pstdio-benchmarks";
import { recordMeasurement } from "pstdio-benchmarks/writer";
import { test } from "../testing/packaged-fixture";
import { recordBenchmark } from "./benchmark-record";
import { disposePackagedApp, type PackagedApp } from "./packaged-app-helpers";
import { launchProject, openLabPreview, readSnapshot } from "./packaged-performance-helpers";
import {
  IDLE_WINDOW_MS,
  measureRenderers,
  openRendererSession,
  type RendererBudget,
  rendererMetrics,
  SETTLE_MS,
} from "./performance-budget";

// Idle budgets catch a constant render loop. The 2026-10-10 release rehearsals measured the
// streaming replay at up to 69% script and 99% task time; the approved budgets sit about 20%
// above that. A task share above 1 no longer limits anything, so script time is the guard.
const IDLE_BUDGET: RendererBudget = {
  scriptShare: rendererBudgets.idleScript.value,
  taskShare: rendererBudgets.idleTask.value,
};
const STREAMING_BUDGET: RendererBudget = {
  scriptShare: rendererBudgets.streamingScript.value,
  taskShare: rendererBudgets.streamingTask.value,
};
// Monitoring runs in Electron main, which renderer CDP metrics cannot see.
const MONITORING_MAIN_CPU_BUDGET = rendererBudgets.monitoringMainCpu.value;

for (const monitoring of [false, true]) {
  const state = monitoring ? "on" : "off";
  test(`idle workbench stays quiet with monitoring ${state}`, async () => {
    let app: PackagedApp | null = null;
    try {
      ({ app } = await launchProject("Idle", { monitoring }));
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
        const workingSetKiB = (snapshot?.processes ?? []).reduce(
          (sum, process) => sum + process.memoryKiB.workingSet,
          0,
        );
        recordMeasurement({
          metric: "idle-workbench/app-memory",
          label: "Idle workbench, memory of all app processes",
          unit: "bytes",
          value: workingSetKiB * 1024,
        });
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
    const launched = await launchProject("Streaming", { monitoring: true });
    app = launched.app;
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
          agent: "pstdio.workbench-fixture.harness.fake",
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as { id: string };
    }, launched.project.id);
    await app.page.getByRole("button", { name: "Long replay", exact: true }).click();
    await expect(app.page.getByLabel("Main").getByText("No messages yet", { exact: true })).toBeVisible();
    const workbench = await openRendererSession(app.page);

    const status = async () => {
      const response = await fetch(`${app!.runtime.origin}/v1/sessions/${session.id}`, {
        headers: { authorization: `Bearer ${app!.runtime.token}` },
      });
      expect(response.ok).toBe(true);
      return ((await response.json()) as { status: string }).status;
    };
    // Start only after the session is open. Auto-follow can hide Step 1 before a
    // locator sees it, so measure the entire replay rather than racing that row.
    const measured = await measureRenderers("streaming-replay", { workbench }, async () => {
      const response = await fetch(`${app!.runtime.origin}/v1/sessions/${session.id}/follow-up`, {
        method: "POST",
        headers: { authorization: `Bearer ${app!.runtime.token}`, "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Replay __fake_long_stream__" }),
      });
      expect(response.ok).toBe(true);
      await expect.poll(status, { intervals: [250], timeout: 15_000 }).toBe("completed");
      await expect(app!.page.getByText(/^Step 30\./).first()).toBeVisible();
    });
    await recordBenchmark({
      name: "streaming-replay",
      scenario: "Open session receiving the fake agent's long replay with monitoring on",
      workload: "30 assistant turns, 8 text updates each at 25 ms intervals, one tool result per turn",
      measuredProcess: "Workbench renderer main thread (CDP)",
      start: "The replay prompt is submitted with its session already visible",
      end: "The API reports completion (250 ms polling) and Step 30 is visible",
      metrics: rendererMetrics(measured, STREAMING_BUDGET),
    });
  } finally {
    await disposePackagedApp(app);
  }
});
