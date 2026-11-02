import { writeFileSync } from "node:fs";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { workbenchBudgets } from "pstdio-benchmarks";
import { createProjectViaApi, deleteAllProjects } from "../ui/helpers/session-follow-up";
import {
  afterTwoFrames,
  budgetMisses,
  PERF_START_ATTRIBUTE,
  preparePerfPage,
  readInteraction,
  reportPageMemory,
  resetInteraction,
} from "./perf-helpers";

declare global {
  interface Window {
    __layoutObserver?: ResizeObserver;
    __layoutStateObserver?: MutationObserver;
    __collapseStateTransitions?: number;
  }
}

// Stamps the first width change of the main region, which is the layout transition the user sees.
const observeLayout = async (page: Page) => {
  await page.evaluate(() => {
    window.__layoutObserver?.disconnect();
    window.__layoutStateObserver?.disconnect();
    const main = document.querySelector<HTMLElement>('[data-workbench-region="main"]');
    if (!main) throw new Error("Main region is not mounted");
    const side = document.querySelector('[data-testid="workbench-side-panel-attached"]')?.closest("[data-collapsed]");
    if (!side) throw new Error("Side split panel is not mounted");

    let lastWidth = Math.round(main.getBoundingClientRect().width);
    window.__collapseStateTransitions = 0;
    // CSS motion changes width on every frame. Count requested panel transitions,
    // while the ResizeObserver still times the first visible response.
    window.__layoutStateObserver = new MutationObserver((records) => {
      window.__collapseStateTransitions! += records.length;
    });
    window.__layoutStateObserver.observe(side, { attributes: true, attributeFilter: ["data-collapsed"] });
    window.__layoutObserver = new ResizeObserver(() => {
      const width = Math.round(main.getBoundingClientRect().width);
      if (width === lastWidth) return;
      lastWidth = width;
      if (window.__perfStart !== undefined) window.__perfSettled ??= performance.now();
    });
    window.__layoutObserver.observe(main);
  });
  await afterTwoFrames(page);
  await page.evaluate(() => {
    window.__collapseStateTransitions = 0;
  });
};

const measure = async (page: Page, trigger: Locator, ready: () => Promise<void>) => {
  await page.getByTestId("workbench-side-panel-attached").evaluate(async (panel) => {
    const split = panel.closest("[data-collapsed]")!.parentElement!;
    await Promise.all(split.getAnimations().map((animation) => animation.finished));
  });
  await resetInteraction(page);
  await observeLayout(page);
  await trigger.evaluate((element, startAttribute) => element.setAttribute(startAttribute, ""), PERF_START_ATTRIBUTE);
  await trigger.click();
  await ready();
  await afterTwoFrames(page);
  const result = await readInteraction(page);
  const collapseStateTransitions = await page.evaluate(() => {
    window.__layoutObserver?.disconnect();
    window.__layoutStateObserver?.disconnect();
    return window.__collapseStateTransitions ?? 0;
  });
  return { ...result, collapseStateTransitions };
};

test("closes and reopens the live Side Panel within budget", async ({ page, request }) => {
  await deleteAllProjects(request);
  const project = await createProjectViaApi(request, "Side Panel performance");
  await preparePerfPage(page, project.id);
  await page.goto(`/projects/${project.id}/tickets`);

  const nav = page.getByRole("group", { name: "Panel controls" });
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
  const samplePath = test.info().outputPath("side-panel-samples.json");
  writeFileSync(samplePath, JSON.stringify({ close, reopen }, null, 2));
  await test.info().attach("side-panel-samples", { contentType: "application/json", path: samplePath });

  expect(await sideRegionNode!.evaluate((element) => element.isConnected)).toBe(true);
  for (const result of [close, reopen]) {
    expect(result.collapseStateTransitions).toBe(1);
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(result.longTasks).toEqual([]);
  }

  await reportPageMemory(page, "side-panel");

  const results = [{ close: close.duration, reopen: reopen.duration }];
  expect(results).toHaveLength(1);
  const misses = (["close", "reopen"] as const).flatMap((action) =>
    budgetMisses(
      "side-panel",
      action,
      results.map((result) => result[action]),
      // Set on 2026-10-26 from four hosted ubuntu-24.04 runs (slowest 267 ms) plus about 20%.
      workbenchBudgets.sidePanel.value,
    ),
  );
  expect(misses).toEqual([]);
});
