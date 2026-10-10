import { expect, test } from "@playwright/test";
import { createPlannerTicket, getPlannerTicketStatuses } from "../helpers/planner-api";
import { createProjectViaApi, deleteAllProjects } from "../ui/helpers/session-follow-up";
import { uiOrigin } from "../ui-server";
import {
  PERF_START_ATTRIBUTE,
  preparePerfPage,
  readInteraction,
  reportSamples,
  resetInteraction,
} from "./perf-helpers";

test("derives ticket ancestry within the interaction budget", async ({ page, request }) => {
  await deleteAllProjects(request);
  const project = await createProjectViaApi(request, "Resource hierarchy performance");
  const statuses = await getPlannerTicketStatuses(request, uiOrigin, project.id);
  const statusId = (statuses.find((status) => status.isDefault) ?? statuses[0])?.id;
  const root = await createPlannerTicket(request, uiOrigin, project.id, {
    content: "Hierarchy performance root",
    statusId,
  });
  const parent = await createPlannerTicket(request, uiOrigin, project.id, {
    content: "Hierarchy performance parent",
    statusId,
    parentId: root.id,
  });
  const child = await createPlannerTicket(request, uiOrigin, project.id, {
    content: "Hierarchy performance child",
    statusId,
    parentId: parent.id,
  });

  await preparePerfPage(page, project.id);
  await page.goto(`/projects/${project.id}/`);
  await page.getByRole("option", { name: "Tickets", exact: true }).click();
  const rootCard = page.getByTestId("renderer-card").filter({ hasText: root.title }).first();
  await expect(rootCard).toBeVisible({ timeout: 30_000 });
  await rootCard.getByText(root.title, { exact: true }).click();

  const sidenav = page.locator('[data-workbench-region="sidenav"]');
  await sidenav.getByRole("option", { name: new RegExp(parent.shorthand) }).click();
  await sidenav.getByRole("option", { name: new RegExp(child.shorthand) }).click();

  const breadcrumb = page.getByRole("navigation", { name: "breadcrumb" });
  const back = page.getByRole("button", { name: "Navigate back" });
  const forward = page.getByRole("button", { name: "Navigate forward" });
  await expect(breadcrumb).toContainText(child.shorthand);
  await back.evaluate((element, startAttribute) => element.setAttribute(startAttribute, ""), PERF_START_ATTRIBUTE);

  const samples: number[] = [];
  for (let sample = 0; sample < 10; sample += 1) {
    await resetInteraction(page);
    await page.evaluate(() => {
      const nav = document.querySelector('[data-workbench-region="nav"]');
      const initialText = nav?.textContent;
      const observer = new MutationObserver(() => {
        if (nav?.textContent === initialText) return;
        observer.disconnect();
        window.__perfSettled = performance.now();
      });
      if (nav) observer.observe(nav, { attributes: true, childList: true, subtree: true });
    });

    await back.click();
    const result = await readInteraction(page);
    expect(result.longTasks).toEqual([]);
    samples.push(result.duration);

    await forward.click();
    await expect(breadcrumb).toContainText(child.shorthand);
  }

  expect(samples).toHaveLength(10);
  expect(reportSamples("resource-hierarchy", "derive-breadcrumbs", samples).max).toBeLessThanOrEqual(150);
});
