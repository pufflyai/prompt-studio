import { expect, test } from "@playwright/test";
import { createPlannerTicket, getPlannerTicketStatuses } from "../helpers/planner-api";
import { calculateStats, installLongTaskObserver, throttleChromiumCpu } from "./perf-helpers";

const apiPort = Number(process.env.E2E_API_PORT ?? "3300");
const apiBase = `http://localhost:${apiPort}`;

declare global {
  interface Window {
    __ps173NavigationStart?: number;
    __ps173NavigationSettled?: number;
  }
}

const createProject = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: { name: "PS-173 Performance" },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

test("PS-173 derives ticket ancestry within the interaction budget", async ({ page, request }) => {
  const project = await createProject(request);
  const statuses = await getPlannerTicketStatuses(request, apiBase, project.id);
  const statusId = (statuses.find((status) => status.isDefault) ?? statuses[0])?.id;
  const root = await createPlannerTicket(request, apiBase, project.id, {
    content: "PS-173 performance root",
    statusId,
  });
  const parent = await createPlannerTicket(request, apiBase, project.id, {
    content: "PS-173 performance parent",
    statusId,
    parentId: root.id,
  });
  const child = await createPlannerTicket(request, apiBase, project.id, {
    content: "PS-173 performance child",
    statusId,
    parentId: parent.id,
  });

  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", projectId);
    document.addEventListener(
      "click",
      (event) => {
        if (event.target instanceof Element && event.target.closest("[data-ps173-navigate]")) {
          window.__ps173NavigationStart = performance.now();
        }
      },
      true,
    );
  }, project.id);
  await installLongTaskObserver(page);
  await throttleChromiumCpu(page);
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
  await back.evaluate((element) => {
    element.dataset.ps173Navigate = "";
  });

  const samples: number[] = [];
  for (let sample = 0; sample < 10; sample += 1) {
    await page.evaluate(() => {
      window.__longTasks = [];
      delete window.__ps173NavigationStart;
      delete window.__ps173NavigationSettled;
      const nav = document.querySelector('[data-workbench-region="nav"]');
      const initialText = nav?.textContent;
      const observer = new MutationObserver(() => {
        if (nav?.textContent === initialText) return;
        observer.disconnect();
        window.__ps173NavigationSettled = performance.now();
      });
      if (nav) observer.observe(nav, { attributes: true, childList: true, subtree: true });
    });

    await back.click();
    await page.waitForFunction(() => window.__ps173NavigationSettled !== undefined);
    const result = await page.evaluate(() => {
      const start = window.__ps173NavigationStart;
      const settled = window.__ps173NavigationSettled;
      if (start === undefined || settled === undefined) throw new Error("PS-173 navigation timing was not captured");
      return {
        duration: settled - start,
        longTasks: (window.__longTasks ?? [])
          .filter((task) => task.startTime >= start && task.startTime < settled)
          .map((task) => task.duration),
      };
    });
    expect(result.longTasks).toEqual([]);
    samples.push(result.duration);

    await forward.click();
    await expect(breadcrumb).toContainText(child.shorthand);
  }

  const stats = calculateStats(samples);
  console.info(JSON.stringify({ ticket: "PS-173", interaction: "derive-breadcrumbs", samples, stats }));
  expect(samples).toHaveLength(10);
  expect(stats.p95).toBeLessThanOrEqual(150);
});
