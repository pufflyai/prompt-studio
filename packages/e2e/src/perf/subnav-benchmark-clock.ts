import type { Locator, Page, Request } from "@playwright/test";

export interface SubnavSample {
  destination: "sessions" | "ticket";
  visit: "first" | "repeat";
  structureMs: number;
  dataMs: number;
  lastRequestMs: number;
  mountedRows: number;
  requests: {
    path: string;
    durationMs: number;
    completedMs: number;
    status?: number;
    outcomeOk?: boolean;
    sessionRows?: number;
    failure?: string;
  }[];
  longTasks: { startTime: number; duration: number }[];
}

interface SubnavClockState {
  destination: string;
  title: string;
  started: number;
  structure: number;
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
      started: 0,
      structure: 0,
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
    document.addEventListener(
      "click",
      (event) => {
        if (!(event.target instanceof Element) || !event.target.closest("[data-subnav-benchmark-trigger]")) return;
        state.started = performance.now();
        state.structure = 0;
        state.stableFrame = 0;
        state.revision++;
        state.lastMutation = performance.now();
        const check = () => {
          if (!state.structure && structureVisible())
            afterPaintOpportunity(() => {
              if (!state.structure && structureVisible()) state.structure = performance.now();
            });
          if (!state.structure) requestAnimationFrame(check);
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
    (path.includes("/extensions/commands/") && request.postData()?.includes('"treeId"')) ||
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
) => {
  await trigger.evaluate((element) => element.setAttribute("data-subnav-benchmark-trigger", ""));
  await page.evaluate(
    ({ destination, title }) =>
      Object.assign(window.__subnavBenchmark, {
        destination,
        title,
        started: 0,
        structure: 0,
        stableFrame: 0,
      }),
    { destination, title },
  );
  const since = performance.now();
  await trigger.click();
  await page.waitForFunction(() => window.__subnavBenchmark.structure > 0);
  await recorder.settled(since);
  // Waiting for quiescence verifies completion, but the quiet interval is excluded from the sample.
  await page.waitForFunction(() => performance.now() - window.__subnavBenchmark.lastMutation >= 200);
  await recorder.settled(since);
  const state = await page.evaluate(() => window.__subnavBenchmark);
  const requestRows = [];
  const origin = await page.evaluate(() => performance.timeOrigin);
  for (const [request, entry] of recorder.entries(since)) {
    const timing = request.timing();
    const response = await request.response();
    const result = await response?.json().catch(() => undefined);
    const sections = result?.outcome?.value;
    const sessions = Array.isArray(sections)
      ? sections.find((section: { id?: string }) => section.id === "sessions")
      : undefined;
    requestRows.push({
      path: new URL(request.url()).pathname,
      status: response?.status(),
      outcomeOk: result?.outcome?.ok,
      ...(sessions ? { sessionRows: sessions.nodes.length } : {}),
      durationMs: timing.responseEnd >= 0 ? timing.responseEnd : (entry.finished ?? performance.now()) - entry.started,
      completedMs:
        timing.responseEnd >= 0
          ? timing.startTime + timing.responseEnd - origin - state.started
          : performance.timeOrigin + (entry.finished ?? performance.now()) - origin - state.started,
      ...(entry.failure ? { failure: entry.failure } : {}),
    });
  }
  const structureMs = state.structure - state.started;
  const lastRequestMs = Math.max(0, ...requestRows.map((row) => row.completedMs));
  const dataMs = Math.max(structureMs, state.stableFrame - state.started, lastRequestMs);
  return {
    destination,
    visit,
    structureMs,
    dataMs,
    lastRequestMs,
    mountedRows: await page.locator('[data-workbench-region="sidenav"] [role="option"]').count(),
    requests: requestRows,
    longTasks: state.longTasks.filter(
      (task) => task.startTime >= state.started && task.startTime <= state.started + dataMs,
    ),
  } satisfies SubnavSample;
};
