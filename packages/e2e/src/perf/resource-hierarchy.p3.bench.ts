import { expect, test } from "@playwright/test";
import { workbenchBudgets } from "pstdio-benchmarks";
import { createPlannerTicket, getPlannerTicketStatuses } from "../helpers/planner-api";
import { createProjectViaApi, deleteAllProjects } from "../ui/helpers/session-follow-up";
import { uiOrigin } from "../ui-server";
import {
  budgetMisses,
  PERF_START_ATTRIBUTE,
  preparePerfPage,
  readInteraction,
  reportPageMemory,
  resetInteraction,
} from "./perf-helpers";

test("derives ticket ancestry within the interaction budget", async ({ page, request }) => {
  // Setup plus ten back and forward samples took up to 44.2 s on hosted ubuntu-24.04 and 42.5 s on a cold local run (2026-10-26).
  test.setTimeout(60_000);
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
      if (nav) observer.observe(nav, { attributes: true, childList: true, characterData: true, subtree: true });
    });

    await back.click();
    const result = await readInteraction(page);
    // Set on 2026-10-26 from four hosted ubuntu-24.04 runs (slowest long task 609 ms) plus about 20%.
    expect(
      budgetMisses(
        "resource-hierarchy",
        "long-task",
        [Math.max(0, ...result.longTasks)],
        workbenchBudgets.resourceHierarchyLongTask.value,
      ),
    ).toEqual([]);
    samples.push(result.duration);

    await forward.click();
    await expect(breadcrumb).toContainText(child.shorthand);
  }

  expect(samples).toHaveLength(10);
  // Set on 2026-10-26 from hosted ubuntu-24.04 runs (slowest 547 ms) plus about 20%.
  await reportPageMemory(page, "resource-hierarchy");
  expect(
    budgetMisses("resource-hierarchy", "derive-breadcrumbs", samples, workbenchBudgets.resourceHierarchy.value),
  ).toEqual([]);
});

let diagnosticProfile: Awaited<ReturnType<import("@playwright/test").BrowserContext["newCDPSession"]>> | undefined;
test.beforeEach(async ({ page }) => {
  diagnosticProfile = await page.context().newCDPSession(page);
  await diagnosticProfile.send("Profiler.enable");
  await diagnosticProfile.send("Profiler.start");
  page.on("pageerror", (error) => console.info("Diagnostic page error", error.message));
  page.on("requestfailed", (request) =>
    console.info("Diagnostic failed request", new URL(request.url()).pathname, request.failure()?.errorText),
  );
});
test.afterEach(async ({ page }, info) => {
  if (diagnosticProfile)
    await info.attach("release-cpu-profile.json", {
      contentType: "application/json",
      body: JSON.stringify(await diagnosticProfile.send("Profiler.stop").catch(() => null)),
    });
  if (info.status !== "passed")
    await info.attach("release-page-state.json", {
      contentType: "application/json",
      body: JSON.stringify(
        await page
          .evaluate(() => ({
            url: location.pathname,
            frames: [...document.querySelectorAll("iframe")].map((frame) => ({
              title: frame.title,
              src: frame.getAttribute("src"),
            })),
          }))
          .catch(() => null),
      ),
    });
});
