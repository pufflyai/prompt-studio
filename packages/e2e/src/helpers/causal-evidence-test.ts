import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type Page, type Request, test as base } from "@playwright/test";

const relevant = (url: string) => {
  const path = new URL(url).pathname;
  return path.includes("/text-editing") || path.includes("/extensions") || path.includes("/retry-setup");
};

const createCausalEvidence = (page: Page) => {
  const startedAt = Date.now();
  const events: object[] = [];
  const requests = new Map<Request, number>();
  let sequence = 0;
  const mark = (phase: string, details: object = {}) => {
    events.push({ at: Date.now() - startedAt, phase, ...details });
    if (events.length > 512) events.shift();
  };
  const request = (value: Request) => {
    if (!relevant(value.url())) return;
    const id = ++sequence;
    requests.set(value, id);
    if (requests.size > 256) requests.delete(requests.keys().next().value!);
    mark("request", { id, method: value.method(), url: value.url() });
  };
  const finished = (value: Request) => {
    const id = requests.get(value);
    if (id === undefined) return;
    mark("request-finished", { id, timing: value.timing() });
    requests.delete(value);
  };
  const failed = (value: Request) => {
    const id = requests.get(value);
    if (id === undefined) return;
    mark("request-failed", { id, failure: value.failure(), timing: value.timing() });
    requests.delete(value);
  };
  page.on("request", request);
  page.on("requestfinished", finished);
  page.on("requestfailed", failed);
  return {
    startedAt,
    events,
    mark,
    async phase<T>(name: string, operation: () => Promise<T>) {
      mark(`${name}:started`);
      try {
        const result = await operation();
        mark(`${name}:completed`);
        return result;
      } catch (error) {
        mark(`${name}:failed`, { error: String(error) });
        throw error;
      }
    },
    stop() {
      for (const [value, id] of requests) {
        mark("request-pending", { id, url: value.url(), timing: value.timing() });
      }
      page.off("request", request);
      page.off("requestfinished", finished);
      page.off("requestfailed", failed);
    },
  };
};

export const test = base.extend<{ causalEvidence: ReturnType<typeof createCausalEvidence> }>({
  causalEvidence: async ({ page }, use, testInfo) => {
    const evidence = createCausalEvidence(page);
    // CDP observes connection/send timing; it does not route, stall or replace requests.
    const cdp = await page.context().newCDPSession(page);
    const tracked = new Set<string>();
    cdp.on("Network.requestWillBeSent", (event) => {
      if (!relevant(event.request.url)) return;
      tracked.add(event.requestId);
      if (tracked.size > 256) tracked.delete(tracked.values().next().value!);
      evidence.mark("network-dispatch", {
        id: event.requestId,
        url: event.request.url,
        timestamp: event.timestamp,
        wallTime: event.wallTime,
      });
    });
    cdp.on("Network.responseReceived", (event) => {
      if (!tracked.has(event.requestId)) return;
      evidence.mark("network-response", {
        id: event.requestId,
        status: event.response.status,
        protocol: event.response.protocol,
        connectionId: event.response.connectionId,
        timing: event.response.timing,
      });
    });
    cdp.on("Network.loadingFailed", (event) => {
      if (tracked.delete(event.requestId)) evidence.mark("network-failed", event);
    });
    cdp.on("Network.loadingFinished", (event) => {
      if (tracked.delete(event.requestId)) evidence.mark("network-finished", event);
    });
    try {
      await cdp.send("Network.enable");
      evidence.mark("network-observer:ready");
      await use(evidence);
    } finally {
      evidence.stop();
      await cdp.detach().catch((error: Error) => evidence.mark("network-detach-failed", { error: error.message }));
      if (testInfo.status !== testInfo.expectedStatus) {
        await testInfo.attach("causal-request-phases", {
          body: JSON.stringify({ startedAt: evidence.startedAt, events: evidence.events }, null, 2),
          contentType: "application/json",
        });
        const runtime = join(import.meta.dirname, "../../test-results", process.env.E2E_RUN_ID!, "runtime.jsonl");
        const spans = (await readFile(runtime, "utf8").catch(() => ""))
          .split("\n")
          .flatMap((line) => {
            try {
              const event = JSON.parse(line);
              return Date.parse(event.time) >= evidence.startedAt && event.event === "runtime.setup.phase"
                ? [event]
                : [];
            } catch {
              return [];
            }
          })
          .slice(-256);
        await testInfo.attach("causal-runtime-setup-phases", {
          body: JSON.stringify(spans, null, 2),
          contentType: "application/json",
        });
      }
    }
  },
});
