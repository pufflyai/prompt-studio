import { rmSync } from "node:fs";
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { createPlannerAttempt, createPlannerTicket } from "../helpers/planner-api";
import { createGitRepo, registerRepoViaApi } from "../ui/helpers/workspace-session-attempt";
import { calculateStats, installLongTaskObserver, throttleChromiumCpu } from "./perf-helpers";

const apiPort = Number(process.env.E2E_API_PORT ?? "3300");
const apiBase = `http://localhost:${apiPort}`;

declare global {
  interface Window {
    __ps171NavigationStart?: number;
    __ps171NavigationSettled?: number;
  }
}

const createProject = async (request: APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: { name: "PS-171 Performance" },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const prepareDashboard = async (page: Page, projectId: string, repoId: string) => {
  await page.addInitScript(
    ({ selectedProjectId, selectedRepoId }) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
      localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
      localStorage.setItem(
        `pstdio-project-settings/projects/${selectedProjectId}/values`,
        JSON.stringify({
          state: {
            lastSelectedAgent: "pstdio.extension-lab.fake",
            lastSelectedModels: [],
            lastSelectedRepo: selectedRepoId,
            lastSelectedBranches: [],
            sessionModalState: "closed",
            selectedSessionId: null,
          },
          version: 0,
        }),
      );
      document.addEventListener(
        "click",
        (event) => {
          if (event.target instanceof Element && event.target.closest("[data-ps171-navigate]")) {
            window.__ps171NavigationStart = performance.now();
          }
        },
        true,
      );
    },
    { selectedProjectId: projectId, selectedRepoId: repoId },
  );
};

const workspaceRow = (page: Page, shorthand: string) => page.getByRole("option").filter({ hasText: shorthand }).first();

const openWorkspace = async (page: Page, shorthand: string) => {
  const row = workspaceRow(page, shorthand);
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.getByRole("paragraph").filter({ hasText: shorthand }).click();
};

test("PS-171 restores a resource layout within the interaction budget", async ({ page, request }) => {
  test.slow();
  const project = await createProject(request);
  const repoRoot = createGitRepo("pstdio-ps-171-perf-", "resource layout restore perf");
  const repo = await registerRepoViaApi(request, apiBase, project.id, "ps-171-perf-repo", repoRoot);

  try {
    const ticketA = await createPlannerTicket(request, apiBase, project.id, {
      content: "PS-171 performance workspace A",
    });
    const ticketB = await createPlannerTicket(request, apiBase, project.id, {
      content: "PS-171 performance workspace B",
    });
    const attemptA = await createPlannerAttempt(request, apiBase, project.id, {
      ticketId: ticketA.id,
      repoId: repo.id,
      mode: "worktree",
    });
    const attemptB = await createPlannerAttempt(request, apiBase, project.id, {
      ticketId: ticketB.id,
      repoId: repo.id,
      mode: "worktree",
    });
    const shorthandA = attemptA.workspace.workspace_shorthand;
    const shorthandB = attemptB.workspace.workspace_shorthand;

    await prepareDashboard(page, project.id, repo.id);
    await installLongTaskObserver(page);
    await throttleChromiumCpu(page);
    await page.goto(`/projects/${project.id}/`);

    const sidenav = page.locator('[data-workbench-region="sidenav"]');
    const workspacesNavigation = sidenav.getByRole("option", { name: /^Workspaces(?:\s|$)/ }).first();
    await workspacesNavigation.click();
    await openWorkspace(page, shorthandA);
    await page.getByRole("button", { name: "Show Secondary Panel" }).click();
    await expect(page.getByRole("region", { name: "Secondary Panel" })).toBeVisible();
    await workspacesNavigation.click();
    await openWorkspace(page, shorthandB);
    await expect(page.getByRole("region", { name: "Secondary Panel" })).not.toBeVisible();

    const samples: number[] = [];
    for (let sample = 0; sample < 10; sample += 1) {
      await workspacesNavigation.click();
      const row = workspaceRow(page, shorthandA);
      await expect(row).toBeVisible();
      await row.evaluate((element) => {
        element.dataset.ps171Navigate = "";
      });
      await page.evaluate((targetShorthand) => {
        window.__longTasks = [];
        delete window.__ps171NavigationStart;
        delete window.__ps171NavigationSettled;
        let settling = false;
        const observer = new MutationObserver(() => {
          const breadcrumb = document.querySelector('[aria-label="breadcrumb"]');
          if (settling || !breadcrumb?.textContent?.includes(targetShorthand)) {
            return;
          }
          settling = true;
          observer.disconnect();
          window.__ps171NavigationSettled = performance.now();
        });
        observer.observe(document.body, {
          attributes: true,
          childList: true,
          subtree: true,
        });
      }, shorthandA);

      await row.getByRole("paragraph").filter({ hasText: shorthandA }).click();
      await page.waitForFunction(() => window.__ps171NavigationSettled !== undefined);
      const result = await page.evaluate(() => {
        const start = window.__ps171NavigationStart;
        const settled = window.__ps171NavigationSettled;
        if (start === undefined || settled === undefined) throw new Error("PS-171 navigation timing was not captured");
        return {
          duration: settled - start,
          longTasks: (window.__longTasks ?? [])
            .filter((task) => task.startTime >= start && task.startTime < settled)
            .map((task) => task.duration),
        };
      });
      expect(result.longTasks).toEqual([]);
      samples.push(result.duration);

      await workspacesNavigation.click();
      await openWorkspace(page, shorthandB);
      await expect(page.getByRole("region", { name: "Secondary Panel" })).not.toBeVisible();
    }

    const stats = calculateStats(samples);
    console.info(
      JSON.stringify({
        ticket: "PS-171",
        interaction: "restore-resource-layout",
        samples,
        stats,
      }),
    );
    expect(samples).toHaveLength(10);
    expect(stats.p95).toBeLessThanOrEqual(150);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});
