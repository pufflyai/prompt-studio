import { desktopBudgets } from "pstdio-benchmarks";
import { test } from "../testing/packaged-fixture";
import { enableBenchmarkMonitoring } from "./benchmark-performance-evidence";
import { recordBenchmark } from "./benchmark-record";
import {
  attachStartupTimings,
  createPackagedHome,
  disposePackagedApp,
  launchPackagedApp,
  type PackagedApp,
} from "./packaged-app-helpers";
import { crashPackagedRuntime, waitForAutomaticRecovery } from "./packaged-runtime-recovery";
import { timeVisibleChange } from "./visible-element-timing";

const isIntelMac = process.platform === "darwin" && process.arch === "x64";
const limits = desktopBudgets();
const coldStartBudgetMs = limits.coldStartMs.value;
const startupWindowBudgetMs = limits.startupWindowMs.value;
const recoveryBudgetMs = limits.recoveryMs.value;

const startupWindowMetric = (value: number) => ({
  name: "startup-window",
  unit: "ms" as const,
  value,
  budget: startupWindowBudgetMs,
});

test("sidecar crash shows recovery within budget", async () => {
  const home = createPackagedHome();
  let app: PackagedApp | null = null;
  try {
    app = await launchPackagedApp(home);
    const initialPid = app.runtime.pid;
    const automaticRecovery = await timeVisibleChange(
      app.lifecyclePage,
      '[role="status"] :is(h1, h2, h3)',
      "Opening Prompt Studio",
      () => {
        crashPackagedRuntime(initialPid);
      },
    );
    await waitForAutomaticRecovery(app);
    const replacementPid = app.runtime.pid;
    const recovery = await timeVisibleChange(
      app.lifecyclePage,
      '[role="alert"] :is(h1, h2, h3)',
      "Prompt Studio needs attention",
      () => {
        crashPackagedRuntime(replacementPid);
      },
    );
    await recordBenchmark({
      name: "sidecar-crash-recovery",
      scenario: "Replacement runtime killed while the workbench is open after one automatic recovery",
      workload: "No projects",
      measuredProcess: "Desktop main process and lifecycle renderer",
      start: "Runtime process kill signal",
      end: "Visible recovery heading in the lifecycle window",
      metrics: [
        {
          name: "automatic-recovery-ui",
          unit: "ms",
          value: automaticRecovery.visibleAt - automaticRecovery.startedAt,
          budget: recoveryBudgetMs,
        },
        { name: "recovery-ui", unit: "ms", value: recovery.visibleAt - recovery.startedAt, budget: recoveryBudgetMs },
      ],
    });
  } finally {
    await disposePackagedApp(app);
  }
});

// Declared last, so it keeps the existing contracts. Intel CI runs only this benchmark, which makes it the
// first launch of the freshly signed app, as its budgets assume (ADR 0032). Elsewhere it follows the
// launches above, as the cold-start check always did; those budgets do not cover macOS first-launch checks.
test("cold start with an empty home shows the workbench within budget", { tag: "@essential" }, async () => {
  const home = createPackagedHome();
  enableBenchmarkMonitoring(home);
  let app: PackagedApp | null = null;
  try {
    app = await launchPackagedApp(home);
    await recordBenchmark({
      name: "cold-start",
      scenario: isIntelMac
        ? "First launch of the freshly built artifact with an empty home"
        : "Launch with an empty home after the earlier launch benchmarks",
      workload: "No projects; default extensions",
      measuredProcess: "Desktop main process and workbench renderer",
      start: "Desktop process spawn",
      end: "Visible workbench root (cold start); visible startup window (startup window)",
      metrics: [
        { name: "cold-start", unit: "ms", value: app.readyInMs, budget: coldStartBudgetMs },
        startupWindowMetric(await attachStartupTimings(app)),
      ],
      performance: { app, endedAt: app.startedAt + app.readyInMs },
    });
  } finally {
    await disposePackagedApp(app);
  }
});
