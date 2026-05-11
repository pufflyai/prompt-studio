import { expect, type Page, test } from "@playwright/test";
import type { ChatMountMetric } from "./chat-mount-metrics";

type PerfStats = {
  min: number;
  median: number;
  p75: number;
  p95: number;
  max: number;
};

type ProfilerSample = {
  scenario: string;
  phase: string;
  actualDuration: number;
  baseDuration: number;
  commitTime: number;
};

declare global {
  interface Window {
    __chatPanelPerf?: ProfilerSample[];
    __chatPanelMountMetrics?: ChatMountMetric[];
    __longTasks?: Array<{ duration: number }>;
  }
}

const STORY_IDS = {
  largeConversation: "chat-ui-chat-panel-performance--large-conversation",
  sessionSwitching: "chat-ui-chat-panel-performance--session-switching",
  streamingScenario: "chat-ui-chat-panel-performance--streaming-scenario",
} as const;

const BUDGETS = {
  largeConversationReadyMs: Number(process.env.UI_PERF_LARGE_CONVERSATION_READY_MS ?? "20000"),
  sessionSwitchMs: Number(process.env.UI_PERF_SESSION_SWITCH_MS ?? "10000"),
  streamingCompleteMs: Number(process.env.UI_PERF_STREAMING_COMPLETE_MS ?? "30000"),
  totalLongTaskMs: Number(process.env.UI_PERF_TOTAL_LONG_TASK_MS ?? "20000"),
};
const shouldAssertBudgets = process.env.UI_PERF_ASSERT_BUDGETS === "1";

const calculateStats = (samples: number[]): PerfStats => {
  const sorted = [...samples].sort((a, b) => a - b);
  const percentile = (value: number) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1)] ?? 0;

  return {
    min: sorted[0] ?? 0,
    median: percentile(0.5),
    p75: percentile(0.75),
    p95: percentile(0.95),
    max: sorted.at(-1) ?? 0,
  };
};

const installLongTaskObserver = async (page: Page) => {
  await page.addInitScript(() => {
    window.__longTasks = [];
    new PerformanceObserver((list) => {
      window.__longTasks?.push(...list.getEntries().map((entry) => ({ duration: entry.duration })));
    }).observe({ type: "longtask", buffered: true });
  });
};

const throttleChromiumCpu = async (page: Page) => {
  const rate = Number(process.env.CPU_THROTTLE ?? "4");
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate });
};

const waitForMark = async (page: Page, markName: string, startMarkName?: string) => {
  await page.waitForFunction((name) => performance.getEntriesByName(name).length > 0, markName);
  return page.evaluate(
    ({ readyName, startName }) => {
      const ready = performance.getEntriesByName(readyName).at(-1)?.startTime ?? 0;
      if (!startName) return ready;

      const start = performance.getEntriesByName(startName).at(-1)?.startTime ?? 0;
      return ready - start;
    },
    { readyName: markName, startName: startMarkName },
  );
};

const waitForMountMetric = async (page: Page, scenario: string, label?: string) => {
  await page.waitForFunction(
    ({ scenarioName, metricLabel }) =>
      window.__chatPanelMountMetrics?.some(
        (metric) => metric.scenario === scenarioName && (!metricLabel || metric.label === metricLabel),
      ),
    { scenarioName: scenario, metricLabel: label },
  );

  return page.evaluate(
    ({ scenarioName, metricLabel }) =>
      window.__chatPanelMountMetrics
        ?.filter((metric) => metric.scenario === scenarioName && (!metricLabel || metric.label === metricLabel))
        .at(-1) ?? null,
    { scenarioName: scenario, metricLabel: label },
  );
};

const getTotalLongTaskDuration = (page: Page) =>
  page.evaluate(() => window.__longTasks?.reduce((total, task) => total + task.duration, 0) ?? 0);

const getProfilerStats = async (page: Page, scenario: string) => {
  const samples = await page.evaluate(
    (scenarioName) => window.__chatPanelPerf?.filter((sample) => sample.scenario === scenarioName) ?? [],
    scenario,
  );

  return {
    commits: samples.length,
    actualDuration: calculateStats(samples.map((sample) => sample.actualDuration)),
    baseDuration: calculateStats(samples.map((sample) => sample.baseDuration)),
  };
};

const expectWithinBudget = (value: number, budget: number) => {
  if (shouldAssertBudgets) {
    expect(value).toBeLessThanOrEqual(budget);
    return;
  }

  expect(Number.isFinite(value)).toBe(true);
  expect(value).toBeGreaterThanOrEqual(0);
};

const openStory = async (page: Page, storyId: string) => {
  await installLongTaskObserver(page);
  await throttleChromiumCpu(page);
  await page.goto(`/iframe.html?id=${storyId}&globals=theme:pstdio-light`);
};

test.describe("chat panel performance", () => {
  const largeMountSamples: number[] = [];
  const switchSamples: number[] = [];
  const streamingSamples: number[] = [];
  const longTaskSamples: number[] = [];

  test.afterAll(() => {
    console.info("chat-large-mount", calculateStats(largeMountSamples));
    console.info("chat-session-switch", calculateStats(switchSamples));
    console.info("chat-streaming-complete", calculateStats(streamingSamples));
    console.info("chat-total-long-tasks", calculateStats(longTaskSamples));
  });

  test("loads a large conversation", async ({ page }) => {
    await openStory(page, STORY_IDS.largeConversation);

    const mountMetric = await waitForMountMetric(page, "large-conversation", "Large chat mount");
    const longTasks = await getTotalLongTaskDuration(page);
    const profiler = await getProfilerStats(page, "large-conversation");

    expect(mountMetric).not.toBeNull();
    largeMountSamples.push(mountMetric?.totalMs ?? 0);
    longTaskSamples.push(longTasks);
    console.info("large-conversation-mount", mountMetric);
    console.info("large-conversation-profiler", profiler);

    expectWithinBudget(mountMetric?.totalMs ?? 0, BUDGETS.largeConversationReadyMs);
    expectWithinBudget(longTasks, BUDGETS.totalLongTaskMs);
    expect(profiler.commits).toBeGreaterThanOrEqual(0);
  });

  test("switches between large sessions", async ({ page }) => {
    await openStory(page, STORY_IDS.sessionSwitching);
    await waitForMark(page, "chat-perf:session-switch-ready");

    await page.evaluate(() => {
      performance.clearMarks();
      window.__chatPanelMountMetrics = [];
      window.__longTasks = [];
    });
    await page.evaluate(() => performance.mark("chat-perf:test-session-switch-click"));
    await page.getByRole("button", { name: "Secondary" }).click();

    const switchStartDelay = await waitForMark(
      page,
      "chat-perf:session-switch-start",
      "chat-perf:test-session-switch-click",
    );
    const switchMetric = await waitForMountMetric(page, "session-switching", "Secondary session switch");
    const longTasks = await getTotalLongTaskDuration(page);
    const profiler = await getProfilerStats(page, "session-switching");

    expect(switchMetric).not.toBeNull();
    switchSamples.push(switchMetric?.totalMs ?? 0);
    longTaskSamples.push(longTasks);
    console.info("session-switching", switchMetric);
    console.info("session-switching-profiler", profiler);

    expect(switchStartDelay).toBeLessThan(400);
    expectWithinBudget(switchMetric?.totalMs ?? 0, BUDGETS.sessionSwitchMs);
    expectWithinBudget(longTasks, BUDGETS.totalLongTaskMs);
    expect(await page.getByTestId("chat-perf-message-count").textContent()).toContain("1000 messages");
  });

  test("streams incremental updates into an existing conversation", async ({ page }) => {
    await openStory(page, STORY_IDS.streamingScenario);

    const streamTime = await waitForMark(page, "chat-perf:stream-complete", "chat-perf:stream-start");
    const mountMetric = await waitForMountMetric(page, "streaming", "Seed chat mount");
    const longTasks = await getTotalLongTaskDuration(page);
    const profiler = await getProfilerStats(page, "streaming");

    streamingSamples.push(streamTime);
    longTaskSamples.push(longTasks);
    console.info("streaming-seed-mount", mountMetric);
    console.info("streaming-profiler", profiler);

    expectWithinBudget(streamTime, BUDGETS.streamingCompleteMs);
    expectWithinBudget(longTasks, BUDGETS.totalLongTaskMs);
    expect(await page.getByTestId("chat-perf-message-count").textContent()).toContain("1000 messages");
  });
});
