import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { startStorybook, storyUrl } from "../ui/mermaid-renderer-storybook";
import { calculateStats, installLongTaskObserver, throttleChromiumCpu } from "./perf-helpers";

const storyId = "pstdio-workbench-examples--workbench-modes";

declare global {
  interface Window {
    __ps175ModeStart?: number;
    __ps175ModeSettled?: number;
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

test("PS-175 switches and restores mode frames within the interaction budget", async ({ page }) => {
  await installLongTaskObserver(page);
  await throttleChromiumCpu(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    document.addEventListener(
      "click",
      (event) => {
        if (event.target instanceof Element && event.target.closest("[data-ps175-switch]")) {
          window.__ps175ModeStart = performance.now();
        }
      },
      true,
    );
  });
  await page.goto(storyUrl(storybookBaseUrl, storyId));
  await expect(page.getByRole("main").getByText("PS-266 Workbench examples", { exact: true })).toBeVisible({
    timeout: 20_000,
  });

  const sequence = [
    { mode: "Workspace", id: "workspace", marker: "Workspace mode" },
    { mode: "Settings", id: "settings", marker: "Workspace preferences" },
    { mode: "Project", id: "project", marker: "Stand up the workbench-modes story" },
  ] as const;

  // First-use rendering belongs to Storybook/module hydration. Warm each mode
  // before measuring the persistent frame-switch protocol.
  for (const target of sequence) {
    await page.getByRole("button", { name: `Switch to ${target.mode} mode` }).click();
    await expect(page.getByText(target.marker, { exact: false }).last()).toBeVisible();
  }
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );

  const samples: number[] = [];

  for (let sample = 0; sample < 10; sample += 1) {
    const target = sequence[sample % sequence.length]!;
    const button = page.getByRole("button", { name: `Switch to ${target.mode} mode` });
    await button.evaluate((element) => {
      element.dataset.ps175Switch = "";
    });
    await page.evaluate((modeId) => {
      window.__longTasks = [];
      delete window.__ps175ModeStart;
      delete window.__ps175ModeSettled;
      const observer = new MutationObserver(() => {
        if (!document.querySelector(`[data-ps175-mode="${modeId}"]`)) return;
        observer.disconnect();
        window.__ps175ModeSettled = performance.now();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }, target.id);

    await button.click();
    await page.waitForFunction(() => window.__ps175ModeSettled !== undefined);
    const result = await page.evaluate(() => {
      const start = window.__ps175ModeStart;
      const settled = window.__ps175ModeSettled;
      if (start === undefined || settled === undefined) throw new Error("PS-175 mode timing was not captured");
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
  console.info(JSON.stringify({ ticket: "PS-175", interaction: "switch-mode-frame", samples, stats }));
  expect(samples).toHaveLength(10);
  expect(stats.p95).toBeLessThanOrEqual(150);
});
