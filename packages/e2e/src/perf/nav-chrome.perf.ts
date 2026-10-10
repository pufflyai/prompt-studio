import { expect, test } from "@playwright/test";
import { createPlannerTicket, getPlannerTicketStatuses } from "../helpers/planner-api";
import { createProjectViaApi, deleteAllProjects } from "../ui/helpers/session-follow-up";
import { uiOrigin } from "../ui-server";
import {
  afterTwoFrames,
  collectRepeatSamples,
  PERF_START_ATTRIBUTE,
  preparePerfPage,
  readInteraction,
  reportSamples,
  resetInteraction,
} from "./perf-helpers";

test("settles the persistent Nav Chrome after navigating back within budget", async ({ page, request }, testInfo) => {
  await deleteAllProjects(request);
  const project = await createProjectViaApi(request, "Nav Chrome performance");
  const statuses = await getPlannerTicketStatuses(request, uiOrigin, project.id);
  const backlog = statuses.find((status) => status.name.toLowerCase() === "backlog");
  expect(backlog).toBeDefined();
  const ticket = await createPlannerTicket(request, uiOrigin, project.id, {
    content: "Measure Nav Chrome",
    statusId: backlog!.id,
  });

  await preparePerfPage(page, project.id);
  await page.goto(`/projects/${project.id}`);
  await page.getByRole("option", { name: "Tickets", exact: true }).click();
  const ticketCard = page.getByTestId("renderer-card").getByText("Measure Nav Chrome", { exact: true });
  await ticketCard.click();
  await expect(page.getByRole("link", { name: `${ticket.shorthand} Measure Nav Chrome` })).toBeVisible();

  const nav = page.locator('[data-workbench-region="nav"]');
  const navNode = await nav.elementHandle();
  const back = nav.getByRole("button", { name: "Navigate back" });
  const forward = nav.getByRole("button", { name: "Navigate forward" });
  expect(navNode).not.toBeNull();

  // Warm the resource replay path before collecting the throttled sample.
  await back.click();
  await expect(ticketCard).toBeVisible();
  await forward.click();
  await expect(page.getByRole("link", { name: `${ticket.shorthand} Measure Nav Chrome` })).toBeVisible();
  await afterTwoFrames(page);

  await resetInteraction(page);
  await back.evaluate((element, startAttribute) => {
    element.setAttribute(startAttribute, "");
    const nav = element.closest('[data-workbench-region="nav"]');
    const initialText = nav?.textContent;
    const observer = new MutationObserver(() => {
      if (nav?.textContent === initialText) return;
      observer.disconnect();
      window.__perfSettled = performance.now();
    });
    if (nav) observer.observe(nav, { attributes: true, childList: true, subtree: true });
  }, PERF_START_ATTRIBUTE);
  await back.click();
  const result = await readInteraction(page);
  expect(await navNode!.evaluate((element) => element.isConnected)).toBe(true);
  console.info(JSON.stringify({ metric: "nav-chrome", repeat: testInfo.repeatEachIndex, ...result }));

  const results = collectRepeatSamples(testInfo, "nav-chrome", [result.duration]);
  if (!results) return;
  expect(results).toHaveLength(testInfo.project.repeatEach);
  expect(reportSamples("nav-chrome", "navigate-back", results).max).toBeLessThanOrEqual(150);
});
