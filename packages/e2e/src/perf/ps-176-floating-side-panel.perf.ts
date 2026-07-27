import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { appendFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { startStorybook, storyUrl } from "../ui/mermaid-renderer-storybook";
import { calculateStats, installLongTaskObserver, throttleChromiumCpu } from "./perf-helpers";

const storyId = "pstdio-workbench-onboarding--floating-side-panel";
const runId = process.env.E2E_RUN_ID ?? `ps-176-${Date.now()}-${process.pid}`;
const samplePath = join(tmpdir(), `pstdio-ps-176-${runId}.jsonl`);

type SidePanelAction = "reattach" | "float" | "close" | "reopen";

interface InteractionResult {
  action: SidePanelAction;
  duration: number;
  placementMoves: number;
  providerRuns: number;
  longTasks: number[];
}

declare global {
  interface Window {
    __ps176ActionStarts?: Partial<Record<SidePanelAction, number>>;
    __ps176PlacementMoves?: number;
    __ps176PlacementObserver?: MutationObserver;
    __ps176Settled?: number;
  }
}

const afterTwoFrames = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );

const observePlacement = async (page: import("@playwright/test").Page) => {
  await page.evaluate(() => {
    window.__ps176PlacementObserver?.disconnect();
    delete window.__ps176Settled;
    window.__ps176PlacementMoves = 0;
    const host = document.querySelector<HTMLElement>("[data-workbench-side-panel-host]");
    if (!host?.parentElement) throw new Error("The live Side Panel host is not mounted");
    let parent = host.parentElement;
    window.__ps176PlacementObserver = new MutationObserver(() => {
      if (!host.parentElement || host.parentElement === parent) return;
      parent = host.parentElement;
      window.__ps176PlacementMoves! += 1;
      window.__ps176Settled ??= performance.now();
    });
    window.__ps176PlacementObserver.observe(document.body, { childList: true, subtree: true });
  });
};

const measure = async (
  page: import("@playwright/test").Page,
  action: SidePanelAction,
  trigger: import("@playwright/test").Locator,
  ready: () => Promise<void>,
) => {
  const content = page.getByTestId("floating-side-panel-session-content");
  const providerRuns = Number(await content.getAttribute("data-renderer-runs"));
  await trigger.evaluate((element, currentAction) => {
    element.dataset.ps176Action = currentAction;
    window.__longTasks = [];
    delete window.__ps176ActionStarts?.[currentAction];
  }, action);
  await observePlacement(page);
  await trigger.click();
  await ready();
  await page.waitForFunction(() => window.__ps176Settled !== undefined);
  await afterTwoFrames(page);

  return page.evaluate(
    ({ currentAction, previousProviderRuns }): InteractionResult => {
      window.__ps176PlacementObserver?.disconnect();
      const start = window.__ps176ActionStarts?.[currentAction];
      const settled = window.__ps176Settled;
      const renderer = document.querySelector<HTMLElement>('[data-testid="floating-side-panel-session-content"]');
      if (start === undefined || settled === undefined || !renderer) {
        throw new Error(`No ${currentAction} timing or renderer evidence was captured`);
      }
      const nextProviderRuns = Number(renderer.dataset.rendererRuns);
      return {
        action: currentAction,
        duration: settled - start,
        placementMoves: window.__ps176PlacementMoves ?? 0,
        providerRuns: nextProviderRuns - previousProviderRuns,
        longTasks: (window.__longTasks ?? [])
          .filter((entry) => entry.startTime >= start && entry.startTime < settled)
          .map((entry) => entry.duration),
      };
    },
    { currentAction: action, previousProviderRuns: providerRuns },
  );
};

test.describe("PS-176 floating Side Panel performance", () => {
  test.slow();

  let baseUrl: string;
  let storybook: ChildProcessWithoutNullStreams;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(storyId, "pstdio-workbench"));
  });

  test.afterAll(() => {
    storybook?.kill();
  });

  test("moves the live Side Panel within the shared interaction budget", async ({ page }, testInfo) => {
    const expectedRepeatCount = testInfo.project.repeatEach;
    if (testInfo.repeatEachIndex === 0) rmSync(samplePath, { force: true });

    await page.addInitScript(() => {
      window.__ps176ActionStarts = {};
      document.addEventListener(
        "click",
        (event) => {
          const action =
            event.target instanceof Element
              ? (event.target.closest<HTMLElement>("[data-ps176-action]")?.dataset.ps176Action as
                  | SidePanelAction
                  | undefined)
              : undefined;
          if (action) window.__ps176ActionStarts![action] = performance.now();
        },
        true,
      );
    });
    await installLongTaskObserver(page);
    await throttleChromiumCpu(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(storyUrl(baseUrl, storyId));

    const floating = page.getByTestId("workbench-side-panel-floating");
    await expect(floating).toBeVisible({ timeout: 30_000 });
    await floating.getByRole("tab", { name: /Session A/ }).click();
    await expect(page.getByTestId("floating-side-panel-session-content")).toBeVisible();

    const reattach = await measure(
      page,
      "reattach",
      floating.getByRole("button", { name: "Reattach Side Panel" }),
      () => expect(page.getByTestId("workbench-side-panel-attached")).toBeVisible(),
    );
    const attached = page.getByTestId("workbench-side-panel-attached");
    const float = await measure(page, "float", attached.getByRole("button", { name: "Float Side Panel" }), () =>
      expect(floating).toBeVisible(),
    );
    const close = await measure(page, "close", floating.getByRole("button", { name: "Close Side Panel" }), () =>
      expect(page.getByRole("button", { name: "Open Side Panel" })).toBeVisible(),
    );
    const reopen = await measure(page, "reopen", page.getByRole("button", { name: "Open Side Panel" }), () =>
      expect(floating).toBeVisible(),
    );

    for (const result of [reattach, float, close, reopen]) {
      expect(result.placementMoves).toBe(1);
      expect(result.providerRuns).toBe(0);
      expect(result.longTasks).toEqual([]);
    }

    const sample = { reattach, float, close, reopen };
    appendFileSync(samplePath, `${JSON.stringify(sample)}\n`);
    console.info(JSON.stringify({ ticket: "PS-176", repeat: testInfo.repeatEachIndex, ...sample }));

    if (testInfo.repeatEachIndex !== expectedRepeatCount - 1) return;

    const results = readFileSync(samplePath, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as typeof sample);
    rmSync(samplePath, { force: true });
    expect(results).toHaveLength(expectedRepeatCount);
    for (const action of ["reattach", "float", "close", "reopen"] as const) {
      const samples = results.map((result) => result[action].duration);
      const stats = calculateStats(samples);
      console.info(JSON.stringify({ ticket: "PS-176", interaction: action, samples, stats }));
      expect(stats.p95).toBeLessThanOrEqual(150);
    }
  });
});
