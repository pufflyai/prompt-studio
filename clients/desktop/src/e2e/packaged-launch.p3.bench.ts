import { expect } from "@playwright/test";
import { desktopBudgets } from "pstdio-benchmarks";
import { test } from "../testing/packaged-fixture";
import { enableBenchmarkMonitoring } from "./benchmark-performance-evidence";
import { recordBenchmark } from "./benchmark-record";
import { allowPageClose } from "./lifecycle-actions";
import {
  attachStartupTimings,
  createPackagedHome,
  disposePackagedApp,
  launchPackagedApp,
  type PackagedApp,
  runPackagedCli,
  waitForDescriptor,
  waitForExit,
} from "./packaged-app-helpers";
import { createPackagedProject, openPackagedProject } from "./packaged-project-helpers";
import { crashPackagedRuntime, waitForAutomaticRecovery } from "./packaged-runtime-recovery";
import { waitForVisibleElement } from "./visible-element-timing";

const isIntelMac = process.platform === "darwin" && process.arch === "x64";
const limits = desktopBudgets();
const coldStartBudgetMs = limits.coldStartMs.value;
const startupWindowBudgetMs = limits.startupWindowMs.value;
const warmAttachBudgetMs = limits.warmAttachMs.value;
const recoveryBudgetMs = limits.recoveryMs.value;

const startupWindowMetric = (value: number) => ({
  name: "startup-window",
  unit: "ms" as const,
  value,
  budget: startupWindowBudgetMs,
});

type WorkbenchHandle = {
  __pstdioDashboardWorkbench: {
    commands: { executeCommand: (id: string) => Promise<unknown> };
    sidePanel: { setMode(mode: "attached"): void };
  };
};

const selectedProjectKey = "dashboard-wb2:selected-project:global";

// Uses the same workload as the warm relaunch check in packaged-app.p1.spec.ts: a project on the
// Sessions page, the non-default theme, and an attached Side Panel.
test("warm attach restores the workbench within budget", async () => {
  const home = createPackagedHome();
  enableBenchmarkMonitoring(home);
  let first: PackagedApp | null = null;
  let second: PackagedApp | null = null;
  try {
    const { projectId, theme } =
      await test.step("Prepare a persistent runtime with saved workbench state", async () => {
        // Warm attach needs an existing persistent runtime. Start that owner directly;
        // a desktop-to-CLI ownership handoff belongs to the functional lifecycle suite.
        expect(await runPackagedCli(home, ["serve"])).toMatchObject({ exitCode: 0 });
        await waitForDescriptor(home, (descriptor) => descriptor.ownerType === "persistent");
        first = await launchPackagedApp(home);
        const { page } = first;
        const project = await createPackagedProject(first, "Warm attach project");
        await openPackagedProject(page, project);
        await page.getByRole("option", { name: "Sessions", exact: true }).click();
        await expect(page.getByLabel("Main").getByRole("log")).toBeVisible();
        const workbenchState = () => page.evaluate(() => window.promptStudioDesktop.getWorkbenchState());
        const pageLocationKey = `dashboard-wb2:page-location:${project.id}`;
        await expect
          .poll(async () => {
            const { values } = await workbenchState();
            return [values[selectedProjectKey], JSON.parse(values[pageLocationKey] ?? "null")?.location?.page?.id];
          })
          .toEqual([project.id, "session-composer"]);
        const theme =
          (await page.locator("html").getAttribute("data-theme")) === "pstdio-dark" ? "pstdio-light" : "pstdio-dark";
        await page.evaluate(() =>
          (window as unknown as WorkbenchHandle).__pstdioDashboardWorkbench.commands.executeCommand(
            "workbench.action.changeTheme",
          ),
        );
        await page
          .getByRole("option", { name: theme === "pstdio-light" ? "Prompt Light" : "Prompt Dark", exact: true })
          .click();
        await expect.poll(workbenchState).toMatchObject({ values: { "theme-preference": theme } });
        return { projectId: project.id, theme };
      });
    await test.step("Attach the Side Panel and quit the first desktop window", async () => {
      const app = first!;
      await allowPageClose(app.page, () =>
        app.page.evaluate(() => {
          (window as unknown as WorkbenchHandle).__pstdioDashboardWorkbench.sidePanel.setMode("attached");
          void window.promptStudioDesktop.quitApp();
        }),
      );
      await waitForExit(app.child);
      await app.browser.close();
      first = null;
    });

    second = await launchPackagedApp(home);
    const operationEndedAt = second.startedAt + second.readyInMs;
    await recordBenchmark({
      name: "warm-attach",
      scenario: "Desktop relaunch against a running persistent runtime",
      workload: "One open project on the Sessions page, non-default theme, attached Side Panel",
      measuredProcess: "Desktop main process and workbench renderer",
      start: "Desktop process spawn",
      end: "Visible workbench root (warm attach); visible startup window (startup window)",
      metrics: [
        { name: "warm-attach", unit: "ms", value: second.readyInMs, budget: warmAttachBudgetMs },
        startupWindowMetric(await attachStartupTimings(second)),
      ],
      performance: { app: second, endedAt: operationEndedAt },
    });
    // The measured launch must have restored the prepared workload, not an empty workbench.
    expect(second.runtime.ownerType).toBe("persistent");
    expect(await second.page.evaluate(() => window.promptStudioDesktop.getWorkbenchState())).toMatchObject({
      values: { [selectedProjectKey]: projectId },
    });
    await expect(second.page.getByLabel("Main").getByRole("log")).toBeVisible();
    await expect(second.page.getByTestId("workbench-side-panel-attached")).toBeVisible();
    await expect(second.page.locator("html")).toHaveAttribute("data-theme", theme);
  } finally {
    await disposePackagedApp(first);
    await disposePackagedApp(second);
  }
});

test("sidecar crash shows recovery within budget", async () => {
  const home = createPackagedHome();
  let app: PackagedApp | null = null;
  try {
    app = await launchPackagedApp(home);
    const firstCrashAt = Date.now();
    crashPackagedRuntime(app.runtime.pid);
    const restartingAt = await waitForVisibleElement(
      app.lifecyclePage,
      '[role="status"] :is(h1, h2, h3)',
      "Opening Prompt Studio",
    );
    await waitForAutomaticRecovery(app);
    const crashedAt = Date.now();
    process.kill(app.runtime.pid, process.platform === "win32" ? undefined : "SIGKILL");
    const visibleAt = await waitForVisibleElement(
      app.lifecyclePage,
      '[role="alert"] :is(h1, h2, h3)',
      "Prompt Studio needs attention",
    );
    await recordBenchmark({
      name: "sidecar-crash-recovery",
      scenario: "Replacement runtime killed while the workbench is open after one automatic recovery",
      workload: "No projects",
      measuredProcess: "Desktop main process and lifecycle renderer",
      start: "Runtime process kill signal",
      end: "Visible recovery heading in the lifecycle window",
      metrics: [
        { name: "automatic-recovery-ui", unit: "ms", value: restartingAt - firstCrashAt, budget: recoveryBudgetMs },
        { name: "recovery-ui", unit: "ms", value: visibleAt - crashedAt, budget: recoveryBudgetMs },
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
