import type { Locator, Page, Request } from "@playwright/test";
import type { SubnavObservedRequest } from "./subnav-request-outcomes";
import { withSubnavClientAborts } from "./subnav-request-signals";
import { measureSubnavRequests, type SubnavRequestClockInput } from "./subnav-resource-clock";

export interface SubnavSample {
  destination: "sessions" | "ticket";
  visit: "first" | "repeat";
  structureMs: number;
  dataMs: number;
  editorMs?: number;
  editorResources?: {
    path: string;
    startMs: number;
    durationMs: number;
    bytes: number;
    requestStartMs?: number;
    responseStartMs?: number;
  }[];
  lastRequestMs: number;
  mountedRows: number;
  workspaceDiffs?: { id: string; state: string | null }[];
  requests: SubnavObservedRequest[];
  longTasks: { startTime: number; duration: number }[];
}

interface SubnavClockState {
  destination: string;
  title: string;
  editorTitle: string;
  started: number;
  structure: number;
  editor: number;
  stableFrame: number;
  lastMutation: number;
  revision: number;
  longTasks: { startTime: number; duration: number }[];
}

declare global {
  interface Window {
    __subnavBenchmark: SubnavClockState;
  }
}

export const installSubnavClock = (page: Page) =>
  page.addInitScript(() => {
    const state: SubnavClockState = {
      destination: "",
      title: "",
      editorTitle: "",
      started: 0,
      structure: 0,
      editor: 0,
      stableFrame: 0,
      lastMutation: 0,
      revision: 0,
      longTasks: [] as { startTime: number; duration: number }[],
    };
    Object.assign(window, { __subnavBenchmark: state });
    new PerformanceObserver((list) =>
      state.longTasks.push(
        ...list.getEntries().map((entry) => ({ startTime: entry.startTime, duration: entry.duration })),
      ),
    ).observe({ type: "longtask" });
    const visible = (element: Element) => {
      const bounds = element.getBoundingClientRect();
      return (
        bounds.width > 0 &&
        bounds.height > 0 &&
        bounds.bottom > 0 &&
        bounds.top < innerHeight &&
        element.checkVisibility()
      );
    };
    const structureVisible = () => {
      const nav = document.querySelector('[data-workbench-region="sidenav"]');
      if (!nav) return false;
      const headers = [...nav.querySelectorAll("p, span")]
        .filter((element) => visible(element) && !element.closest('[role="option"]'))
        .map((element) => element.textContent?.trim().toLowerCase());
      if (state.destination === "sessions") return headers.includes("sessions");
      return (
        nav.textContent?.includes(state.title) &&
        ["files", "workspaces", "sessions"].every((label) => headers.includes(label))
      );
    };
    const afterPaintOpportunity = (callback: () => void) =>
      requestAnimationFrame(() => requestAnimationFrame(callback));
    const checkEditor = () => {
      if (state.destination !== "ticket" || state.editor) return;
      const editor = [...document.querySelectorAll('[data-workbench-region="main"] [contenteditable="true"]')].find(
        (element) => visible(element) && element.textContent?.includes(state.editorTitle),
      );
      if (!editor) return;
      afterPaintOpportunity(() => {
        if (!state.editor && visible(editor) && editor.textContent?.includes(state.editorTitle))
          state.editor = performance.now();
      });
    };
    document.addEventListener(
      "click",
      (event) => {
        if (!(event.target instanceof Element) || !event.target.closest("[data-subnav-benchmark-trigger]")) return;
        state.started = performance.now();
        state.structure = 0;
        state.editor = 0;
        state.stableFrame = 0;
        state.revision++;
        state.lastMutation = performance.now();
        const check = () => {
          if (!state.structure && structureVisible())
            afterPaintOpportunity(() => {
              if (!state.structure && structureVisible()) state.structure = performance.now();
            });
          checkEditor();
          if (!state.structure || (state.destination === "ticket" && !state.editor)) requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      },
      true,
    );
    document.addEventListener("DOMContentLoaded", () => {
      new MutationObserver((records) => {
        if (
          !state.started ||
          !records.some((record) =>
            (record.target instanceof Element ? record.target : record.target.parentElement)?.closest(
              '[data-workbench-region="sidenav"]',
            ),
          )
        )
          return;
        const revision = ++state.revision;
        state.lastMutation = performance.now();
        afterPaintOpportunity(() => {
          if (revision === state.revision && structureVisible()) state.stableFrame = performance.now();
        });
      }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
    });
  });

const isSubnavRequest = (request: Request) => {
  const path = new URL(request.url()).pathname;
  return (
    (path.includes("/extensions/commands/") &&
      (request.postData()?.includes('"treeId"') || /\.tree\.(body|children)\/execute$/.test(path))) ||
    /\/workspaces\/[^/]+\/diff-summary$/.test(path)
  );
};

export const createSubnavNetworkRecorder = (page: Page) => {
  const requests = new Map<Request, { started: number; finished?: number; failure?: string }>();
  page.on("request", (request) => {
    if (isSubnavRequest(request)) requests.set(request, { started: performance.now() });
  });
  const finish = (request: Request, failure?: string) => {
    const entry = requests.get(request);
    if (entry) Object.assign(entry, { finished: performance.now(), failure });
  };
  page.on("requestfinished", (request) => finish(request));
  page.on("requestfailed", (request) => finish(request, request.failure()?.errorText));
  return {
    async settled(since: number) {
      const relevant = () =>
        [...requests.values()].filter((entry) => entry.started >= since || !entry.finished || entry.finished >= since);
      const deadline = performance.now() + 10_000;
      while (
        relevant().some((entry) => entry.finished === undefined) ||
        performance.now() - Math.max(since, ...relevant().map((entry) => entry.finished ?? performance.now())) < 200
      ) {
        if (performance.now() > deadline)
          throw new Error("Subnav requests did not settle within the 10 second measurement allowance");
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    },
    entries(since: number) {
      return [...requests.entries()].filter(
        ([, entry]) => entry.started >= since || (entry.finished ?? Infinity) >= since,
      );
    },
  };
};

export const measureSubnav = async (
  page: Page,
  recorder: ReturnType<typeof createSubnavNetworkRecorder>,
  trigger: Locator,
  destination: SubnavSample["destination"],
  visit: SubnavSample["visit"],
  title: string,
  editorTitle = "",
  workspaceIds: string[] = [],
) => {
  await trigger.evaluate((element) => element.setAttribute("data-subnav-benchmark-trigger", ""));
  await page.evaluate(
    ({ destination, title, editorTitle }) => {
      performance.clearResourceTimings();
      Object.assign(window.__subnavBenchmark, {
        destination,
        title,
        editorTitle,
        started: 0,
        structure: 0,
        editor: 0,
        stableFrame: 0,
      });
    },
    { destination, title, editorTitle },
  );
  const since = performance.now();
  await trigger.click();
  await page.waitForFunction(() => window.__subnavBenchmark.structure > 0);
  if (destination === "ticket") await page.waitForFunction(() => window.__subnavBenchmark.editor > 0);
  // Live row decorations are part of data readiness, including accepted empty totals and warm catch-up.
  if (destination === "ticket")
    await page.waitForFunction(
      (ids) => {
        const cells = [
          ...document.querySelectorAll<HTMLElement>('[data-workbench-region="sidenav"] [data-workspace-diff-id]'),
        ];
        return ids.every((id) =>
          cells.some(
            (cell) =>
              cell.dataset.workspaceDiffId === id &&
              cell.checkVisibility() &&
              cell.dataset.workspaceDiffState === "ready",
          ),
        );
      },
      workspaceIds,
      { timeout: 10_000 },
    );
  await recorder.settled(since);
  // Waiting for quiescence verifies completion, but the quiet interval is excluded from the sample.
  await page.waitForFunction(() => performance.now() - window.__subnavBenchmark.lastMutation >= 200);
  await recorder.settled(since);
  const { state, resources, fetchSignals } = await page.evaluate(() => ({
    state: window.__subnavBenchmark,
    fetchSignals: window.__subnavFetchSignals,
    resources: (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).map((entry) => ({
      name: entry.name,
      startTime: entry.startTime,
      responseEnd: entry.responseEnd,
    })),
  }));
  const responses = [];
  const clocks: SubnavRequestClockInput[] = [];
  for (const [request, entry] of recorder.entries(since)) {
    const timing = request.timing();
    const response = await request.response();
    const result = await response?.json().catch(() => undefined);
    const sections = result?.outcome?.value;
    const sessions = Array.isArray(sections)
      ? sections.find((section: { id?: string }) => section.id === "sessions")
      : undefined;
    clocks.push({ url: request.url(), timing, elapsedMs: (entry.finished ?? performance.now()) - entry.started });
    responses.push({
      path: new URL(request.url()).pathname,
      url: request.url(),
      method: request.method(),
      postData: request.postDataJSON(),
      status: response?.status(),
      outcomeOk: result?.outcome?.ok,
      ...(sessions ? { sessionRows: sessions.nodes.length } : {}),
      ...(entry.failure ? { failure: entry.failure } : {}),
    });
  }
  const measured = measureSubnavRequests(clocks, resources, state.started);
  const requestRows = withSubnavClientAborts(
    responses.map((response, index) => ({ ...response, ...measured[index]! })),
    fetchSignals,
    state.started,
  );
  const structureMs = state.structure - state.started;
  const lastRequestMs = Math.max(0, ...requestRows.map((row) => row.completedMs));
  const dataMs = Math.max(structureMs, state.stableFrame - state.started, lastRequestMs);
  const editorResources =
    destination === "ticket"
      ? await page.evaluate(
          (started) =>
            performance
              .getEntriesByType("resource")
              .filter((entry) => entry.startTime >= started)
              .map((entry) => ({
                path: new URL(entry.name).pathname,
                startMs: entry.startTime - started,
                durationMs: entry.duration,
                bytes: (entry as PerformanceResourceTiming).transferSize,
                ...((entry as PerformanceResourceTiming).requestStart > 0
                  ? { requestStartMs: (entry as PerformanceResourceTiming).requestStart - started }
                  : {}),
                ...((entry as PerformanceResourceTiming).responseStart > 0
                  ? { responseStartMs: (entry as PerformanceResourceTiming).responseStart - started }
                  : {}),
              })),
          state.started,
        )
      : undefined;
  return {
    destination,
    visit,
    structureMs,
    dataMs,
    ...(destination === "ticket" ? { editorMs: state.editor - state.started, editorResources } : {}),
    lastRequestMs,
    mountedRows: await page.locator('[data-workbench-region="sidenav"] [role="option"]').count(),
    ...(destination === "ticket"
      ? {
          workspaceDiffs: await page
            .locator('[data-workbench-region="sidenav"] [data-workspace-diff-id]')
            .evaluateAll((cells) =>
              cells
                .filter((cell) => cell.checkVisibility())
                .map((cell) => ({
                  id: cell.getAttribute("data-workspace-diff-id")!,
                  state: cell.getAttribute("data-workspace-diff-state"),
                })),
            ),
        }
      : {}),
    requests: requestRows,
    longTasks: state.longTasks.filter(
      (task) => task.startTime >= state.started && task.startTime <= state.started + dataMs,
    ),
  } satisfies SubnavSample;
};
