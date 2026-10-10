import { rmSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { createPlannerAttempt, createPlannerTicket } from "../helpers/planner-api";
import { createProjectViaApi, deleteAllProjects } from "../ui/helpers/session-follow-up";
import { getSidenavEntry } from "../ui/helpers/sidenav-navigation";
import { openWorkspace } from "../ui/helpers/workspace-files";
import { createGitRepo } from "../ui/helpers/workspace-session-attempt";
import { uiOrigin } from "../ui-server";
import {
  PERF_START_ATTRIBUTE,
  preparePerfPage,
  readInteraction,
  reportSamples,
  resetInteraction,
} from "./perf-helpers";

const workspaceRow = (page: Page, shorthand: string) => page.getByRole("row").filter({ hasText: shorthand }).first();

test("restores a resource layout within the interaction budget", async ({ page, request }) => {
  test.slow();
  await deleteAllProjects(request);
  const repoRoot = createGitRepo("pstdio-resource-layout-perf-", "resource layout restore perf");
  const project = await createProjectViaApi(request, "Resource layout performance", repoRoot);

  try {
    const ticketA = await createPlannerTicket(request, uiOrigin, project.id, { content: "Layout workspace A" });
    const ticketB = await createPlannerTicket(request, uiOrigin, project.id, { content: "Layout workspace B" });
    const attemptA = await createPlannerAttempt(request, uiOrigin, project.id, { ticketId: ticketA.id });
    const attemptB = await createPlannerAttempt(request, uiOrigin, project.id, { ticketId: ticketB.id });
    const shorthandA = attemptA.workspace.workspace_shorthand;
    const shorthandB = attemptB.workspace.workspace_shorthand;

    await preparePerfPage(page, project.id);
    await page.goto(`/projects/${project.id}/`);

    const workspacesNavigation = await getSidenavEntry(page, "Workspaces");
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
      await resetInteraction(page);
      await row.evaluate(
        (element, { startAttribute, targetShorthand }) => {
          element.setAttribute(startAttribute, "");
          const observer = new MutationObserver(() => {
            const breadcrumb = document.querySelector('[aria-label="breadcrumb"]');
            if (!breadcrumb?.textContent?.includes(targetShorthand)) return;
            observer.disconnect();
            window.__perfSettled = performance.now();
          });
          observer.observe(document.body, { attributes: true, childList: true, subtree: true });
        },
        { startAttribute: PERF_START_ATTRIBUTE, targetShorthand: shorthandA },
      );

      await row.getByRole("cell").filter({ hasText: shorthandA }).first().click();
      const result = await readInteraction(page);
      expect(result.longTasks).toEqual([]);
      samples.push(result.duration);

      await workspacesNavigation.click();
      await openWorkspace(page, shorthandB);
      await expect(page.getByRole("region", { name: "Secondary Panel" })).not.toBeVisible();
    }

    expect(samples).toHaveLength(10);
    expect(reportSamples("resource-layout-restore", "restore-resource-layout", samples).max).toBeLessThanOrEqual(150);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});
