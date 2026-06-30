import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { cleanupDirs, createGitRepo, runPstdio } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { FLOW_TIMEOUT, SETUP_TIMEOUT } from "./timeouts";

type SseEvent = {
  event: string;
  data: unknown;
};

const parseSseBlock = (block: string): SseEvent | null => {
  if (!block.trim()) return null;

  let event = "message";
  let data = "";

  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data = line.slice(5).trim();
  }

  if (!data) return null;
  return { event, data: JSON.parse(data) };
};

const createSseReader = (response: Response) => {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const queuedEvents: SseEvent[] = [];

  const readEvent = async (timeoutMs = 3_000) => {
    const nextQueuedEvent = queuedEvents.shift();
    if (nextQueuedEvent) return nextQueuedEvent;

    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const { done, value } = await reader.read();
      if (done) return queuedEvents.shift() ?? null;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        const parsed = parseSseBlock(block);
        if (parsed) queuedEvents.push(parsed);
      }

      const nextEvent = queuedEvents.shift();
      if (nextEvent) return nextEvent;
    }

    return queuedEvents.shift() ?? null;
  };

  const close = async () => {
    await reader.cancel();
  };

  return { readEvent, close };
};

let api: ApiInstance;
const dirs: string[] = [];

beforeAll(async () => {
  api = await startApi({ eventBusBufferSize: 5, env: { PSTDIO_DEFAULT_EXTENSIONS: "[]" } });
}, SETUP_TIMEOUT);

afterAll(() => {
  api?.stop();
});

afterEach(() => {
  cleanupDirs(dirs);
});

describe("stale reconnect sync", () => {
  test(
    "reconnecting with a stale seq falls back to init payload",
    async () => {
      const freshResponse = await fetch(`${api.url}/v1/sync/stream`);
      expect(freshResponse.ok).toBe(true);

      const freshSse = createSseReader(freshResponse);
      const initEvent = await freshSse.readEvent();
      expect(initEvent?.event).toBe("init");

      const initData = initEvent?.data as { seq: number };
      const clientSeq = initData.seq;
      await freshSse.close();

      const repo = createGitRepo();
      dirs.push(repo);
      runPstdio("projects create stale-reconnect-project", repo, { PSTDIO_API_URL: api.url });

      const reconnectResponse = await fetch(`${api.url}/v1/sync/stream?since=${clientSeq}`);
      expect(reconnectResponse.ok).toBe(true);

      const reconnectSse = createSseReader(reconnectResponse);
      const firstEvent = await reconnectSse.readEvent();
      await reconnectSse.close();

      expect(firstEvent).toBeTruthy();
      expect(firstEvent!.event).toBe("init");

      const reconnectData = firstEvent!.data as {
        tables: { projects: Array<{ name: string }> };
      };

      expect(reconnectData.tables.projects.some((project) => project.name === "stale-reconnect-project")).toBe(true);
    },
    FLOW_TIMEOUT,
  );
});
