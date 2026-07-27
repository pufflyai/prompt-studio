import { appendFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { calculateStats, installLongTaskObserver, throttleChromiumCpu } from "./perf-helpers";

const apiPort = Number(process.env.E2E_API_PORT ?? "3300");
const apiBase = `http://localhost:${apiPort}`;
const runId = process.env.E2E_RUN_ID ?? `ps-174-${Date.now()}-${process.pid}`;
const samplePath = join(tmpdir(), `pstdio-ps-174-${runId}.jsonl`);
const collections = ["Workspaces", "Sessions", "Tickets"] as const;

type Collection = (typeof collections)[number];

interface NavigationResult {
  collection: Collection;
  duration: number;
  longTasks: number[];
}

declare global {
  interface Window {
    __ps174NavigationStart?: number;
    __ps174NavigationSettled?: number;
    __ps174ReadyObserver?: MutationObserver;
  }
}

const createProject = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name: "PS-174 Performance" } });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const waitForTicketsExtension = async (request: import("@playwright/test").APIRequestContext, projectId: string) => {
  await expect
    .poll(
      async () => {
        const response = await request.get(`${apiBase}/v1/projects/${projectId}/extensions/ui`);
        if (!response.ok()) return false;
        const metadata = (await response.json()) as { kanbanRenderers?: Array<{ resourceKind?: string }> };
        return metadata.kanbanRenderers?.some((renderer) => renderer.resourceKind === "ticket") ?? false;
      },
      { timeout: 30_000 },
    )
    .toBe(true);
};

const collectionRow = (page: import("@playwright/test").Page, collection: Collection) =>
  page
    .locator('[data-workbench-region="sidenav"]')
    .getByRole("option", collection === "Workspaces" ? { name: /^Workspaces/ } : { name: collection, exact: true });

const observeNavigationReady = async (page: import("@playwright/test").Page, collection: Collection) => {
  await page.evaluate((expectedCollection) => {
    window.__ps174ReadyObserver?.disconnect();
    delete window.__ps174NavigationStart;
    delete window.__ps174NavigationSettled;
    window.__longTasks = [];

    const nav = document.querySelector<HTMLElement>('[data-workbench-region="nav"]');
    if (!nav) throw new Error("Nav Chrome is not mounted");

    window.__ps174ReadyObserver = new MutationObserver(() => {
      if (!nav.textContent?.includes(expectedCollection) || window.__ps174NavigationSettled !== undefined) return;
      window.__ps174ReadyObserver?.disconnect();
      window.__ps174NavigationSettled = performance.now();
    });
    window.__ps174ReadyObserver.observe(nav, { attributes: true, childList: true, subtree: true });
  }, collection);
};

const readNavigation = async (page: import("@playwright/test").Page, collection: Collection) => {
  await page.waitForFunction(() => window.__ps174NavigationSettled !== undefined);
  return page.evaluate((currentCollection): NavigationResult => {
    const start = window.__ps174NavigationStart;
    const settled = window.__ps174NavigationSettled;
    if (start === undefined || settled === undefined) throw new Error("Collection navigation timing was not captured");
    return {
      collection: currentCollection,
      duration: settled - start,
      longTasks: (window.__longTasks ?? [])
        .filter((entry) => entry.startTime >= start && entry.startTime < settled)
        .map((entry) => entry.duration),
    };
  }, collection);
};

test("PS-174 navigates global collections within the interaction budget", async ({ page, request }, testInfo) => {
  const expectedRepeatCount = testInfo.project.repeatEach;
  if (testInfo.repeatEachIndex === 0) rmSync(samplePath, { force: true });

  const project = await createProject(request);
  await waitForTicketsExtension(request, project.id);
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", projectId);
    document.addEventListener(
      "click",
      (event) => {
        if (event.target instanceof Element && event.target.closest("[data-ps174-collection]")) {
          window.__ps174NavigationStart = performance.now();
        }
      },
      true,
    );
  }, project.id);
  await installLongTaskObserver(page);
  await throttleChromiumCpu(page);
  await page.goto(`/projects/${project.id}/tickets`);

  for (const collection of collections) {
    const target = collectionRow(page, collection);
    await expect(target).toBeVisible({ timeout: 30_000 });
    await target.evaluate((element) => {
      element.dataset.ps174Collection = "";
    });
  }

  // Warm each registered presenter so the sample measures persistent-header navigation,
  // not first-use module hydration after extension bootstrap.
  for (const collection of collections) {
    await collectionRow(page, collection).click();
    await expect(
      page.getByRole("navigation", { name: "breadcrumb" }).getByText(collection, { exact: true }),
    ).toBeVisible();
  }
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );

  for (const collection of collections) {
    const target = collectionRow(page, collection);
    await observeNavigationReady(page, collection);
    await target.click();
    await expect(
      page.getByRole("navigation", { name: "breadcrumb" }).getByText(collection, { exact: true }),
    ).toBeVisible();
    const result = await readNavigation(page, collection);
    expect(result.longTasks).toEqual([]);
    appendFileSync(samplePath, `${JSON.stringify(result)}\n`);
    console.info(JSON.stringify({ ticket: "PS-174", repeat: testInfo.repeatEachIndex, ...result }));
  }

  if (testInfo.repeatEachIndex !== expectedRepeatCount - 1) return;

  const results = readFileSync(samplePath, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as NavigationResult);
  rmSync(samplePath, { force: true });
  expect(results).toHaveLength(expectedRepeatCount * collections.length);

  for (const collection of collections) {
    const samples = results.filter((result) => result.collection === collection).map((result) => result.duration);
    const stats = calculateStats(samples);
    console.info(JSON.stringify({ ticket: "PS-174", interaction: collection, samples, stats }));
    expect(stats.p95).toBeLessThanOrEqual(150);
  }
});
