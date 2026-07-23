import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { startStorybook, storyUrl } from "../ui/mermaid-renderer-storybook";
import { calculateStats, installLongTaskObserver, throttleChromiumCpu } from "./perf-helpers";

const storyId = "pstdio-workbench-onboarding--responsive-panel-menus";

declare global {
  interface Window {
    __ps178ResizeStart?: number;
    __ps178ResizeSettled?: number;
    __ps178ShouldCollapse?: boolean;
  }
}

let storybook: ChildProcessWithoutNullStreams | undefined;
let storybookBaseUrl = "";

test.beforeAll(async () => {
  const started = await startStorybook(storyId, "pstdio-workbench");
  storybook = started.storybook;
  storybookBaseUrl = started.baseUrl;
});

test.afterAll(() => {
  storybook?.kill();
});

const resizeMainPanelTo = async (page: import("@playwright/test").Page, targetWidth: number) => {
  const mainPanel = page.locator('[data-workbench-panel="main"]');
  const currentWidth = await mainPanel.evaluate((element) => element.clientWidth);
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Expected a viewport");
  await page.setViewportSize({
    width: viewport.width + targetWidth - currentWidth,
    height: viewport.height,
  });
};

test("PS-178 collapses and restores responsive menus within the interaction budget", async ({ page }) => {
  await installLongTaskObserver(page);
  await throttleChromiumCpu(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    window.addEventListener(
      "resize",
      () => {
        if (window.__ps178ShouldCollapse === undefined) return;
        window.__ps178ResizeStart = performance.now();
      },
      true,
    );
  });
  await page.goto(storyUrl(storybookBaseUrl, storyId));
  await expect(page.locator('[data-workbench-panel="main"]')).toBeVisible({ timeout: 20_000 });
  await resizeMainPanelTo(page, 481);
  await expect(page.getByRole("button", { name: "Open Main left menu" })).toHaveCount(0);
  await resizeMainPanelTo(page, 480);
  await expect(page.getByRole("button", { name: "Open Main left menu" })).toBeVisible();
  await resizeMainPanelTo(page, 481);
  await expect(page.getByRole("button", { name: "Open Main left menu" })).toHaveCount(0);
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );

  const samples: number[] = [];

  for (let sample = 0; sample < 10; sample += 1) {
    const shouldCollapse = sample % 2 === 0;
    await page.evaluate((collapse) => {
      window.__longTasks = [];
      window.__ps178ShouldCollapse = collapse;
      delete window.__ps178ResizeStart;
      delete window.__ps178ResizeSettled;
      const observer = new MutationObserver(() => {
        const trigger = document.querySelector('[aria-label="Open Main left menu"]');
        if (Boolean(trigger) !== collapse) return;
        observer.disconnect();
        requestAnimationFrame(() => {
          window.__ps178ResizeSettled = performance.now();
        });
      });
      observer.observe(document.body, { attributes: true, childList: true, subtree: true });
    }, shouldCollapse);

    await resizeMainPanelTo(page, shouldCollapse ? 480 : 481);
    await page.waitForFunction(() => window.__ps178ResizeSettled !== undefined);
    const result = await page.evaluate(() => {
      const start = window.__ps178ResizeStart;
      const settled = window.__ps178ResizeSettled;
      if (start === undefined || settled === undefined) throw new Error("PS-178 resize timing was not captured");
      return {
        duration: settled - start,
        longTasks: (window.__longTasks ?? [])
          .filter((task) => task.startTime >= start && task.startTime < settled)
          .map((task) => task.duration),
      };
    });
    expect(result.longTasks).toEqual([]);
    samples.push(result.duration);
  }

  const stats = calculateStats(samples);
  console.info(JSON.stringify({ ticket: "PS-178", interaction: "responsive-menu-collapse", samples, stats }));
  expect(samples).toHaveLength(10);
  expect(stats.p95).toBeLessThanOrEqual(150);
});
