import { expect } from "@playwright/test";
import { test } from "../testing/packaged-fixture";
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
import { waitForVisibleElement } from "./visible-element-timing";

// Hosted Intel Mac runners start the packaged app two to three times slower than Apple Silicon,
// and the first launch of a freshly signed app waits for macOS launch checks.
const isIntelMac = process.platform === "darwin" && process.arch === "x64";
const coldStartBudgetMs = isIntelMac ? 20_000 : 8_000;
const macStartupWindowBudgetMs = isIntelMac ? 10_000 : 1_500;
const startupWindowBudgetMs = process.platform === "darwin" ? macStartupWindowBudgetMs : 1_000;
const warmAttachBudgetMs = 3_000;
const recoveryBudgetMs = 500;

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

// Uses the same workload as the warm relaunch check in packaged-app.spec.ts: a project on the
// Sessions page, the non-default theme, and an attached Side Panel.
test("warm attach restores the workbench within budget", async () => {
  const home = createPackagedHome();
  let first: PackagedApp | null = null;
  let second: PackagedApp | null = null;
  try {
    const { projectId, theme } =
      await test.step("Prepare a persistent runtime with saved workbench state", async () => {
        first = await launchPackagedApp(home);
        const { page } = first;
        const project = await createPackagedProject(first, "Warm attach project");
        await openPackagedProject(page, project);
        await page.getByRole("option", { name: "Sessions", exact: true }).click();
        await expect(page.getByLabel("Main").getByText("No messages yet", { exact: true })).toBeVisible();
        const workbenchState = () => page.evaluate(() => window.promptStudioDesktop.getWorkbenchState());
        const pageLocationKey = `dashboard-wb2:page-location:${project.id}`;
        await expect
          .poll(async () => {
            const { values } = await workbenchState();
            return [values[selectedProjectKey], JSON.parse(values[pageLocationKey] ?? "null")?.location?.page?.id];
          })
          .toEqual([project.id, "sessions"]);
        const theme =
          (await page.locator("html").getAttribute("data-theme")) === "pstdio-dark" ? "pstdio-light" : "pstdio-dark";
        await page.evaluate(() =>
          (window as unknown as WorkbenchHandle).__pstdioDashboardWorkbench.commands.executeCommand(
            "workbench.action.changeTheme",
          ),
        );
        await page.getByRole("option", { name: theme }).click();
        await expect.poll(workbenchState).toMatchObject({ values: { "theme-preference": theme } });
        expect(await runPackagedCli(home, ["serve"])).toMatchObject({ exitCode: 0 });
        await waitForDescriptor(home, (descriptor) => descriptor.ownerType === "persistent");
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
    });
    // The measured launch must have restored the prepared workload, not an empty workbench.
    expect(second.runtime.ownerType).toBe("persistent");
    expect(await second.page.evaluate(() => window.promptStudioDesktop.getWorkbenchState())).toMatchObject({
      values: { [selectedProjectKey]: projectId },
    });
    await expect(second.page.getByLabel("Main").getByText("No messages yet", { exact: true })).toBeVisible();
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
    const crashedAt = Date.now();
    process.kill(app.runtime.pid, process.platform === "win32" ? undefined : "SIGKILL");
    const visibleAt = await waitForVisibleElement(
      app.lifecyclePage,
      '[role="alert"] :is(h1, h2, h3)',
      "Prompt Studio needs attention",
    );
    await recordBenchmark({
      name: "sidecar-crash-recovery",
      scenario: "Runtime process killed while the workbench is open",
      workload: "No projects",
      measuredProcess: "Desktop main process and lifecycle renderer",
      start: "Runtime process kill signal",
      end: "Visible recovery heading in the lifecycle window",
      metrics: [{ name: "recovery-ui", unit: "ms", value: visibleAt - crashedAt, budget: recoveryBudgetMs }],
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
    });
  } finally {
    await disposePackagedApp(app);
  }
});
