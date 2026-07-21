import { appendFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { calculateStats, installLongTaskObserver, throttleChromiumCpu } from "./perf-helpers";

const apiPort = Number(process.env.E2E_API_PORT ?? "3300");
const apiBase = `http://localhost:${apiPort}`;
const runId = process.env.E2E_RUN_ID ?? `ports-${apiPort}-${process.env.E2E_DASHBOARD_PORT ?? "5175"}`;
const samplePath = join(tmpdir(), `pstdio-ps-168-${runId}.jsonl`);

type SidePanelAction = "close" | "reopen";

interface InteractionResult {
  action: SidePanelAction;
  duration: number;
  layoutTransitions: number;
  longTasks: number[];
}

declare global {
  interface Window {
    __ps168InteractionStarts?: Partial<Record<SidePanelAction, number>>;
    __ps168LayoutObserver?: ResizeObserver;
    __ps168LayoutWidths?: number[];
    __ps168LayoutSettled?: number;
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
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name: "PS-168 Performance" } });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const afterTwoFrames = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );

const preparePage = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
    window.__ps168InteractionStarts = {};
    const recordStart = (event: Event) => {
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-ps168-action]") : null;
      const action = element?.dataset.ps168Action as SidePanelAction | undefined;
      if (action) window.__ps168InteractionStarts![action] = performance.now();
    };
    document.addEventListener("click", recordStart, true);
  }, projectId);
  await installLongTaskObserver(page);
  await throttleChromiumCpu(page);
};

const observeLayout = async (page: import("@playwright/test").Page) => {
  await page.evaluate(() => {
    window.__ps168LayoutObserver?.disconnect();
    const main = document.querySelector<HTMLElement>('[data-workbench-region="main"]');
    if (!main) throw new Error("Main region is not mounted");

    let lastWidth = Math.round(main.getBoundingClientRect().width);
    window.__ps168LayoutWidths = [];
    delete window.__ps168LayoutSettled;
    window.__ps168LayoutObserver = new ResizeObserver(() => {
      const width = Math.round(main.getBoundingClientRect().width);
      if (width === lastWidth) return;
      lastWidth = width;
      window.__ps168LayoutWidths!.push(width);
      window.__ps168LayoutSettled ??= performance.now();
    });
    window.__ps168LayoutObserver.observe(main);
  });
  await afterTwoFrames(page);
  await page.evaluate(() => {
    window.__ps168LayoutWidths = [];
  });
};

const measure = async (
  page: import("@playwright/test").Page,
  action: SidePanelAction,
  interact: () => Promise<void>,
  ready: () => Promise<void>,
) => {
  await observeLayout(page);
  await page.evaluate((currentAction) => {
    window.__longTasks = [];
    delete window.__ps168InteractionStarts?.[currentAction];
  }, action);
  await interact();
  await ready();
  await afterTwoFrames(page);

  return page.evaluate((currentAction): InteractionResult => {
    window.__ps168LayoutObserver?.disconnect();
    const start = window.__ps168InteractionStarts?.[currentAction];
    if (start === undefined) throw new Error(`No input event captured for ${currentAction}`);
    const settled = window.__ps168LayoutSettled;
    if (settled === undefined) throw new Error(`No layout transition captured for ${currentAction}`);
    return {
      action: currentAction,
      duration: settled - start,
      layoutTransitions: window.__ps168LayoutWidths?.length ?? 0,
      longTasks: (window.__longTasks ?? [])
        .filter((entry) => entry.startTime >= start && entry.startTime < settled)
        .map((entry) => entry.duration),
    };
  }, action);
};

test("PS-168 closes and reopens the live Side Panel within budget", async ({ page, request }, testInfo) => {
  const expectedRepeatCount = testInfo.project.repeatEach;
  if (testInfo.repeatEachIndex === 0) rmSync(samplePath, { force: true });

  await deleteAllProjects(request);
  const project = await createProject(request);
  await preparePage(page, project.id);
  await page.goto(`/projects/${project.id}/tickets`);

  const nav = page.locator('[data-workbench-region="nav"]');
  await nav.getByRole("button", { name: "Show Side Panel" }).click();
  await nav.getByRole("button", { name: "Hide Side Panel" }).click();
  await nav.getByRole("button", { name: "Show Side Panel" }).click();
  await afterTwoFrames(page);
  const sideRegionNode = await page.getByRole("region", { name: "Session", exact: true }).elementHandle();
  expect(sideRegionNode).not.toBeNull();

  const hideSide = nav.getByRole("button", { name: "Hide Side Panel" });
  await hideSide.evaluate((element) => {
    element.dataset.ps168Action = "close";
  });
  const close = await measure(
    page,
    "close",
    () => hideSide.click(),
    () => expect(nav.getByRole("button", { name: "Show Side Panel" })).toBeVisible(),
  );

  const showSide = nav.getByRole("button", { name: "Show Side Panel" });
  await showSide.evaluate((element) => {
    element.dataset.ps168Action = "reopen";
  });
  const reopen = await measure(
    page,
    "reopen",
    () => showSide.click(),
    () => expect(page.getByTestId("workbench-session-attached-panel")).toBeVisible(),
  );

  const sideRegionConnected = await sideRegionNode!.evaluate((element) => element.isConnected);
  expect(sideRegionConnected).toBe(true);
  for (const result of [close, reopen]) {
    expect(result.layoutTransitions).toBe(1);
    expect(result.longTasks).toEqual([]);
  }

  const sample = { close, reopen, sideRegionConnected };
  appendFileSync(samplePath, `${JSON.stringify(sample)}\n`);
  console.info(JSON.stringify({ ticket: "PS-168", repeat: testInfo.repeatEachIndex, ...sample }));

  if (testInfo.repeatEachIndex === expectedRepeatCount - 1) {
    const results = readFileSync(samplePath, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as typeof sample);
    rmSync(samplePath, { force: true });
    expect(results).toHaveLength(expectedRepeatCount);
    for (const action of ["close", "reopen"] as const) {
      const samples = results.map((result) => result[action].duration);
      const stats = calculateStats(samples);
      console.info(JSON.stringify({ ticket: "PS-168", interaction: action, samples, stats }));
      expect(stats.p95).toBeLessThanOrEqual(150);
    }
  }
});
