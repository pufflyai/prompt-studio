import { type APIRequestContext, expect, type Page } from "@playwright/test";
import { findBudgetFailures, recordPageMemory, throttleChromiumCpu } from "pstdio-benchmarks";
import { recordMeasurement } from "pstdio-benchmarks/writer";
import { prepareDashboard } from "../ui/helpers/workspace-files";

declare global {
  interface Window {
    __longTasks?: Array<{ duration: number; startTime: number }>;
    __perfStart?: number;
    __perfSettled?: number;
  }
}

// Mark the element whose input event starts a sample with this attribute.
export const PERF_START_ATTRIBUTE = "data-perf-start";

export const summarizeSamples = (samples: number[]) => {
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return { samples, min: sorted[0], median, max: sorted[sorted.length - 1] };
};

const words = (name: string) => name.replaceAll("-", " ");
const metricLabel = (metric: string, interaction: string) =>
  `${words(metric).replace(/^./, (first) => first.toUpperCase())}, ${words(interaction)}`;

// A few samples cannot support a percentile, so reports list every sample and the gate checks the
// slowest one. It returns misses instead of asserting, so a test records all its series before it fails.
export const budgetMisses = (metric: string, interaction: string, samples: number[], budget: number) => {
  const summary = summarizeSamples(samples);
  console.info(JSON.stringify({ metric, interaction, ...summary }));
  for (const value of samples) {
    recordMeasurement({
      metric: `${metric}/${interaction}`,
      label: metricLabel(metric, interaction),
      unit: "ms",
      value,
      budget,
    });
  }
  return findBudgetFailures(samples.map((value) => ({ name: `${metric} ${interaction}`, unit: "ms", value, budget })));
};

export const reportPageMemory = (page: Page, metric: string) =>
  recordPageMemory(page, { metric: `${metric}/js-heap`, label: metricLabel(metric, "page heap") });

// Records long tasks and the input event on a marked element in the page clock.
const installInteractionClock = (page: Page) =>
  page.addInitScript((startAttribute) => {
    window.__longTasks = [];
    new PerformanceObserver((list) => {
      window.__longTasks?.push(
        ...list.getEntries().map((entry) => ({ duration: entry.duration, startTime: entry.startTime })),
      );
    }).observe({ type: "longtask", buffered: true });
    const recordStart = (event: Event) => {
      if (event.target instanceof Element && event.target.closest(`[${startAttribute}]`)) {
        window.__perfStart = performance.now();
      }
    };
    document.addEventListener("click", recordStart, true);
    document.addEventListener("keydown", recordStart, true);
  }, PERF_START_ATTRIBUTE);

export const resetInteraction = (page: Page) =>
  page.evaluate(() => {
    window.__longTasks = [];
    delete window.__perfStart;
    delete window.__perfSettled;
  });

// Stamps the first frame in which `selector` matches a visible element.
export const settleWhenVisible = (page: Page, selector: string) =>
  page.evaluate((target) => {
    const check = () => {
      if (window.__perfSettled !== undefined) return;
      if (document.querySelector(target)?.checkVisibility()) {
        window.__perfSettled = performance.now();
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }, selector);

// The page stamps both the input event and the settled state, so automation waits never add to
// a sample.
export const readInteraction = async (page: Page) => {
  await page.waitForFunction(() => window.__perfSettled !== undefined);
  return page.evaluate(() => {
    const start = window.__perfStart;
    const settled = window.__perfSettled;
    if (start === undefined || settled === undefined) throw new Error("Interaction timing was not captured");
    return {
      duration: settled - start,
      longTasks: (window.__longTasks ?? [])
        .filter((task) => task.startTime >= start && task.startTime < settled)
        .map((task) => task.duration),
    };
  });
};

export const afterTwoFrames = (page: Page) =>
  page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );

// The planner registers its views after the project starts, and a sample must not include that boot.
export const waitForTicketsView = (request: APIRequestContext, projectId: string) =>
  expect
    .poll(
      async () => {
        const response = await request.get(`/v1/projects/${projectId}/extensions/ui`);
        if (!response.ok()) return false;
        const metadata = (await response.json()) as { views?: Array<{ id: string; body?: { kind?: string } }> };
        return (
          metadata.views?.some(
            (view) => view.id === "pstdio.pstdio-planner.view.tickets" && view.body?.kind === "kanban",
          ) ?? false
        );
      },
      { timeout: 30_000 },
    )
    .toBe(true);

export const preparePerfPage = async (page: Page, projectId: string) => {
  await prepareDashboard(page, projectId);
  await installInteractionClock(page);
  await throttleChromiumCpu(page);
};
