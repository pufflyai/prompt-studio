import { appendFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { createPlannerTicket, getPlannerTicketStatuses } from "../helpers/planner-api";
import { calculateStats, installLongTaskObserver, throttleChromiumCpu } from "./perf-helpers";

const apiPort = Number(process.env.E2E_API_PORT ?? "3300");
const apiBase = `http://localhost:${apiPort}`;
const runId = process.env.E2E_RUN_ID ?? `ports-${apiPort}-${process.env.E2E_DASHBOARD_PORT ?? "5175"}`;
const samplePath = join(tmpdir(), `pstdio-ps-167-${runId}.jsonl`);

declare global {
  interface Window {
    __ps167NavigationStart?: number;
    __ps167NavigationSettled?: number;
  }
}

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.get(`${apiBase}/v1/projects`);
  expect(response.ok()).toBe(true);
  for (const project of (await response.json()) as Array<{ id: string }>) {
    expect((await request.delete(`${apiBase}/v1/projects/${project.id}`)).ok()).toBe(true);
  }
};

const createProject = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name: "PS-167 Performance" } });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

test.describe("PS-167 Nav Chrome navigation", () => {
  test("settles the persistent Nav Chrome within the interaction budget", async ({ page, request }, testInfo) => {
    const expectedRepeatCount = testInfo.project.repeatEach;
    if (testInfo.repeatEachIndex === 0) rmSync(samplePath, { force: true });

    await deleteAllProjects(request);
    const project = await createProject(request);
    const statuses = await getPlannerTicketStatuses(request, apiBase, project.id);
    const backlog = statuses.find((status) => status.name.toLowerCase() === "backlog");
    expect(backlog).toBeDefined();
    const ticket = await createPlannerTicket(request, apiBase, project.id, {
      content: "Measure Nav Chrome",
      statusId: backlog!.id,
    });

    await page.addInitScript((projectId: string) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
      localStorage.setItem("dashboard-wb:selected-project:global", projectId);
      document.addEventListener(
        "click",
        (event) => {
          if (event.target instanceof Element && event.target.closest("[data-ps167-navigate]")) {
            window.__ps167NavigationStart = performance.now();
          }
        },
        true,
      );
    }, project.id);
    await installLongTaskObserver(page);
    await throttleChromiumCpu(page);
    await page.goto(`/projects/${project.id}`);
    await page.getByRole("option", { name: "Tickets", exact: true }).click();
    await page.getByText("Measure Nav Chrome", { exact: true }).click();
    await expect(page.getByRole("link", { name: `${ticket.shorthand} Measure Nav Chrome` })).toBeVisible();

    const nav = page.locator('[data-workbench-region="nav"]');
    const navNode = await nav.elementHandle();
    const back = nav.getByRole("button", { name: "Navigate back" });
    const forward = nav.getByRole("button", { name: "Navigate forward" });
    expect(navNode).not.toBeNull();

    // Warm the resource replay path before collecting the throttled sample.
    await back.click();
    await expect(page.getByText("Measure Nav Chrome", { exact: true })).toBeVisible();
    await forward.click();
    await expect(page.getByRole("link", { name: `${ticket.shorthand} Measure Nav Chrome` })).toBeVisible();
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );

    await back.evaluate((element) => {
      element.dataset.ps167Navigate = "";
      window.__longTasks = [];
      delete window.__ps167NavigationStart;
      delete window.__ps167NavigationSettled;
      const nav = element.closest('[data-workbench-region="nav"]');
      const initialText = nav?.textContent;
      const observer = new MutationObserver(() => {
        if (nav?.textContent === initialText) return;
        observer.disconnect();
        window.__ps167NavigationSettled = performance.now();
      });
      if (nav) observer.observe(nav, { attributes: true, childList: true, subtree: true });
    });
    await back.click();
    await page.waitForFunction(() => window.__ps167NavigationSettled !== undefined);

    const result = await page.evaluate(() => ({
      duration: (window.__ps167NavigationSettled ?? performance.now()) - (window.__ps167NavigationStart ?? 0),
      longTasks: (window.__longTasks ?? []).map((entry) => entry.duration),
    }));
    expect(await navNode!.evaluate((element) => element.isConnected)).toBe(true);
    appendFileSync(samplePath, `${JSON.stringify(result)}\n`);
    console.info(JSON.stringify({ ticket: "PS-167", repeat: testInfo.repeatEachIndex, ...result }));

    if (testInfo.repeatEachIndex === expectedRepeatCount - 1) {
      const results = readFileSync(samplePath, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as { duration: number; longTasks: number[] });
      rmSync(samplePath, { force: true });
      const samples = results.map((sample) => sample.duration);
      const stats = calculateStats(samples);
      console.info(JSON.stringify({ ticket: "PS-167", interaction: "navigate-back", samples, stats }));
      expect(results).toHaveLength(expectedRepeatCount);
      expect(stats.p95).toBeLessThanOrEqual(150);
    }
  });
});
