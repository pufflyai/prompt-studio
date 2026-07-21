import { appendFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { calculateStats, installLongTaskObserver, throttleChromiumCpu } from "./perf-helpers";

const apiPort = Number(process.env.E2E_API_PORT ?? "3300");
const apiBase = `http://localhost:${apiPort}`;
const runId = process.env.E2E_RUN_ID ?? `ports-${apiPort}-${process.env.E2E_DASHBOARD_PORT ?? "5175"}`;
const samplePath = join(tmpdir(), `pstdio-ps-169-${runId}.jsonl`);

declare global {
  interface Window {
    __ps169OpenStart?: number;
    __ps169OpenSettled?: number;
    __ps169InitialTabs?: number;
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
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name: "PS-169 Performance" } });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

test("PS-169 opens one Panel tab within the interaction budget", async ({ page, request }, testInfo) => {
  const expectedRepeatCount = testInfo.project.repeatEach;
  if (testInfo.repeatEachIndex === 0) rmSync(samplePath, { force: true });

  await deleteAllProjects(request);
  const project = await createProject(request);
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", projectId);
    document.addEventListener(
      "click",
      (event) => {
        if (event.target instanceof Element && event.target.closest("[data-ps169-open]")) {
          window.__ps169OpenStart = performance.now();
        }
      },
      true,
    );
  }, project.id);
  await installLongTaskObserver(page);
  await throttleChromiumCpu(page);
  await page.goto(`/projects/${project.id}/tickets`);

  const addSecondary = page
    .locator('[data-workbench-panel-header="secondary"]')
    .getByRole("button", { name: "Add panel" });
  await addSecondary.click();
  const terminalItem = page.getByRole("menu", { name: "Add panel" }).getByRole("menuitem", {
    name: "Terminal",
  });
  await terminalItem.evaluate((element) => {
    element.dataset.ps169Open = "";
    window.__longTasks = [];
    delete window.__ps169OpenStart;
    delete window.__ps169OpenSettled;
    const tablist = document.querySelector<HTMLElement>('[data-workbench-panel-header="secondary"] [role="tablist"]');
    if (!tablist) throw new Error("Secondary Panel tab list is not mounted");
    window.__ps169InitialTabs = tablist.querySelectorAll('[role="tab"]').length;
    const observer = new MutationObserver(() => {
      const tabCount = tablist.querySelectorAll('[role="tab"]').length;
      if (tabCount <= (window.__ps169InitialTabs ?? 0)) return;
      observer.disconnect();
      window.__ps169OpenSettled = performance.now();
    });
    observer.observe(tablist, { attributes: true, childList: true, subtree: true });
  });

  await terminalItem.click();
  const terminalTab = page
    .locator('[data-workbench-panel-header="secondary"]')
    .getByRole("tab", { name: /Terminal 1/ });
  await expect(terminalTab).toHaveAttribute("aria-selected", "true");
  await page.waitForFunction(() => window.__ps169OpenSettled !== undefined);

  const result = await page.evaluate(() => {
    const start = window.__ps169OpenStart;
    const settled = window.__ps169OpenSettled;
    if (start === undefined || settled === undefined) throw new Error("Panel open timing was not captured");
    const tablist = document.querySelector<HTMLElement>('[data-workbench-panel-header="secondary"] [role="tablist"]');
    const finalTabs = tablist?.querySelectorAll('[role="tab"]').length ?? 0;
    return {
      duration: settled - start,
      openOperations: finalTabs - (window.__ps169InitialTabs ?? 0),
      longTasks: (window.__longTasks ?? [])
        .filter((entry) => entry.startTime >= start && entry.startTime < settled)
        .map((entry) => entry.duration),
    };
  });
  expect(result.openOperations).toBe(1);
  expect(result.longTasks).toEqual([]);

  appendFileSync(samplePath, `${JSON.stringify(result)}\n`);
  console.info(JSON.stringify({ ticket: "PS-169", repeat: testInfo.repeatEachIndex, ...result }));

  if (testInfo.repeatEachIndex === expectedRepeatCount - 1) {
    const results = readFileSync(samplePath, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as typeof result);
    rmSync(samplePath, { force: true });
    const samples = results.map((sample) => sample.duration);
    const stats = calculateStats(samples);
    console.info(JSON.stringify({ ticket: "PS-169", interaction: "open-panel", samples, stats }));
    expect(results).toHaveLength(expectedRepeatCount);
    expect(stats.p95).toBeLessThanOrEqual(150);
  }
});
