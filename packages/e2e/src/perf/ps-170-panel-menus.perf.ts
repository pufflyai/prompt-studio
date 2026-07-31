import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { appendFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { startStorybook, storyUrl } from "../ui/mermaid-renderer-storybook";
import { calculateStats, installLongTaskObserver, throttleChromiumCpu } from "./perf-helpers";

const storyId = "pstdio-workbench-onboarding--side-panels";
const runId = process.env.E2E_RUN_ID ?? `ps-170-${Date.now()}-${process.pid}`;
const samplePath = join(tmpdir(), `pstdio-ps-170-${runId}.jsonl`);

type PanelMenuAction = "close" | "reattach";

interface InteractionResult {
  action: PanelMenuAction;
  duration: number;
  stateTransitions: number;
  longTasks: number[];
}

declare global {
  interface Window {
    __ps170ActionStarts?: Partial<Record<PanelMenuAction, number>>;
    __ps170Settled?: number;
    __ps170StateTransitions?: number;
    __ps170StateObserver?: MutationObserver;
  }
}

const afterTwoFrames = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );

const observeMenuState = async (page: import("@playwright/test").Page, visible: boolean) => {
  await page.evaluate((expectedVisible) => {
    window.__ps170StateObserver?.disconnect();
    delete window.__ps170Settled;
    window.__ps170StateTransitions = 0;
    const menu = document.querySelector<HTMLElement>('[data-workbench-panel-menu="main-left"]');
    const panel = menu?.parentElement;
    if (!panel) throw new Error("Main left menu panel is not mounted");
    window.__ps170StateObserver = new MutationObserver(() => {
      const isVisible = getComputedStyle(panel).display !== "none";
      if (isVisible !== expectedVisible || window.__ps170Settled !== undefined) return;
      window.__ps170StateTransitions! += 1;
      window.__ps170Settled = performance.now();
    });
    window.__ps170StateObserver.observe(panel, { attributes: true, attributeFilter: ["style"] });
  }, visible);
};

const readInteraction = async (page: import("@playwright/test").Page, action: PanelMenuAction) => {
  await page.waitForFunction(() => window.__ps170Settled !== undefined);
  await afterTwoFrames(page);
  return page.evaluate((currentAction): InteractionResult => {
    window.__ps170StateObserver?.disconnect();
    const start = window.__ps170ActionStarts?.[currentAction];
    const settled = window.__ps170Settled;
    if (start === undefined || settled === undefined) throw new Error(`No ${currentAction} timing was captured`);
    return {
      action: currentAction,
      duration: settled - start,
      stateTransitions: window.__ps170StateTransitions ?? 0,
      longTasks: (window.__longTasks ?? [])
        .filter((entry) => entry.startTime >= start && entry.startTime < settled)
        .map((entry) => entry.duration),
    };
  }, action);
};

test.describe("PS-170 Panel menu performance", () => {
  test.slow();

  let baseUrl: string;
  let storybook: ChildProcessWithoutNullStreams | undefined;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(storyId, "pstdio-workbench"));
  });

  test.afterAll(() => {
    storybook?.kill();
  });

  test("closes and reattaches a menu within the interaction budget", async ({ page }, testInfo) => {
    const expectedRepeatCount = testInfo.project.repeatEach;
    if (testInfo.repeatEachIndex === 0) rmSync(samplePath, { force: true });

    await page.addInitScript(() => {
      window.__ps170ActionStarts = {};
      document.addEventListener(
        "keydown",
        (event) => {
          const action =
            event.target instanceof Element
              ? (event.target.closest<HTMLElement>("[data-ps170-action]")?.dataset.ps170Action as
                  | PanelMenuAction
                  | undefined)
              : undefined;
          if (action) window.__ps170ActionStarts![action] = performance.now();
        },
        true,
      );
      document.addEventListener(
        "click",
        (event) => {
          const action =
            event.target instanceof Element
              ? (event.target.closest<HTMLElement>("[data-ps170-action]")?.dataset.ps170Action as
                  | PanelMenuAction
                  | undefined)
              : undefined;
          if (action) window.__ps170ActionStarts![action] = performance.now();
        },
        true,
      );
    });
    await installLongTaskObserver(page);
    await throttleChromiumCpu(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(storyUrl(baseUrl, storyId));

    const menu = page.locator('[data-workbench-panel-menu="main-left"]');
    await expect(menu).toBeVisible({ timeout: 30_000 });
    const contentNode = await page.locator('[data-workbench-region="main"]').first().elementHandle();
    expect(contentNode).not.toBeNull();

    const separator = page.getByRole("separator", { name: "Resize Main left menu" });
    await separator.evaluate((element) => {
      element.dataset.ps170Action = "close";
      window.__longTasks = [];
    });
    await observeMenuState(page, false);
    await separator.press("Home");
    await expect(menu).not.toBeVisible();
    const close = await readInteraction(page, "close");

    const trigger = page.getByRole("button", { name: "Open Main left menu" });
    await trigger.click();
    const controls = page.locator('[data-workbench-panel-menu-controls="main-left-menu"]');
    const attach = controls.getByRole("button", { name: "Attach Main left menu" });
    await attach.evaluate((element) => {
      element.dataset.ps170Action = "reattach";
      window.__longTasks = [];
    });
    await observeMenuState(page, true);
    await attach.click();
    await expect(menu).toBeVisible();
    const reattach = await readInteraction(page, "reattach");

    expect(await contentNode!.evaluate((element) => element.isConnected)).toBe(true);
    for (const result of [close, reattach]) {
      expect(result.stateTransitions).toBe(1);
      expect(result.longTasks).toEqual([]);
    }

    const sample = { close, reattach };
    appendFileSync(samplePath, `${JSON.stringify(sample)}\n`);
    console.info(JSON.stringify({ ticket: "PS-170", repeat: testInfo.repeatEachIndex, ...sample }));

    if (testInfo.repeatEachIndex === expectedRepeatCount - 1) {
      const results = readFileSync(samplePath, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as typeof sample);
      rmSync(samplePath, { force: true });
      expect(results).toHaveLength(expectedRepeatCount);
      for (const action of ["close", "reattach"] as const) {
        const samples = results.map((result) => result[action].duration);
        const stats = calculateStats(samples);
        console.info(JSON.stringify({ ticket: "PS-170", interaction: action, samples, stats }));
        expect(stats.p95).toBeLessThanOrEqual(150);
      }
    }
  });
});
