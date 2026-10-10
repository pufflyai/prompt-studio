import { expect, type Locator, type Page, test } from "@playwright/test";
import { createProjectViaApi, deleteAllProjects } from "../ui/helpers/session-follow-up";
import {
  afterTwoFrames,
  collectRepeatSamples,
  PERF_START_ATTRIBUTE,
  preparePerfPage,
  readInteraction,
  reportSamples,
  resetInteraction,
} from "./perf-helpers";

declare global {
  interface Window {
    __layoutObserver?: ResizeObserver;
    __layoutWidths?: number[];
  }
}

// Stamps the first width change of the main region, which is the layout transition the user sees.
const observeLayout = async (page: Page) => {
  await page.evaluate(() => {
    window.__layoutObserver?.disconnect();
    const main = document.querySelector<HTMLElement>('[data-workbench-region="main"]');
    if (!main) throw new Error("Main region is not mounted");

    let lastWidth = Math.round(main.getBoundingClientRect().width);
    window.__layoutWidths = [];
    window.__layoutObserver = new ResizeObserver(() => {
      const width = Math.round(main.getBoundingClientRect().width);
      if (width === lastWidth) return;
      lastWidth = width;
      window.__layoutWidths!.push(width);
      window.__perfSettled ??= performance.now();
    });
    window.__layoutObserver.observe(main);
  });
  await afterTwoFrames(page);
  await page.evaluate(() => {
    window.__layoutWidths = [];
  });
};

const measure = async (page: Page, trigger: Locator, ready: () => Promise<void>) => {
  await resetInteraction(page);
  await observeLayout(page);
  await trigger.evaluate((element, startAttribute) => element.setAttribute(startAttribute, ""), PERF_START_ATTRIBUTE);
  await trigger.click();
  await ready();
  await afterTwoFrames(page);
  const result = await readInteraction(page);
  const layoutTransitions = await page.evaluate(() => {
    window.__layoutObserver?.disconnect();
    return window.__layoutWidths?.length ?? 0;
  });
  return { ...result, layoutTransitions };
};

test("closes and reopens the live Side Panel within budget", async ({ page, request }, testInfo) => {
  await deleteAllProjects(request);
  const project = await createProjectViaApi(request, "Side Panel performance");
  await preparePerfPage(page, project.id);
  await page.goto(`/projects/${project.id}/tickets`);

  const nav = page.locator('[data-workbench-region="nav"]');
  await nav.getByRole("button", { name: "Show Side Panel" }).click();
  await nav.getByRole("button", { name: "Hide Side Panel" }).click();
  await nav.getByRole("button", { name: "Show Side Panel" }).click();
  await afterTwoFrames(page);
  const sideRegionNode = await page.getByRole("region", { name: "Side Panel", exact: true }).elementHandle();
  expect(sideRegionNode).not.toBeNull();

  const close = await measure(page, nav.getByRole("button", { name: "Hide Side Panel" }), () =>
    expect(nav.getByRole("button", { name: "Show Side Panel" })).toBeVisible(),
  );
  const reopen = await measure(page, nav.getByRole("button", { name: "Show Side Panel" }), () =>
    expect(page.getByTestId("workbench-side-panel-attached")).toBeVisible(),
  );

  expect(await sideRegionNode!.evaluate((element) => element.isConnected)).toBe(true);
  for (const result of [close, reopen]) {
    expect(result.layoutTransitions).toBe(1);
    expect(result.longTasks).toEqual([]);
  }

  const results = collectRepeatSamples(testInfo, "side-panel", [{ close: close.duration, reopen: reopen.duration }]);
  if (!results) return;
  expect(results).toHaveLength(testInfo.project.repeatEach);
  for (const action of ["close", "reopen"] as const) {
    const summary = reportSamples(
      "side-panel",
      action,
      results.map((result) => result[action]),
    );
    expect(summary.max).toBeLessThanOrEqual(150);
  }
});
