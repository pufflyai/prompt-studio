import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import type { ReadableStreamDefaultReader } from "node:stream/web";
import { cleanupDirs, createGitRepo, runPstdio } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

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
  const reader = response.body!.getReader() as ReadableStreamDefaultReader<Uint8Array>;
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
  api = await startApi();
}, SETUP_TIMEOUT);

afterAll(() => {
  api?.stop();
});

afterEach(() => {
  cleanupDirs(dirs);
});

describe("realtime sync stream", () => {
  test(
    "sends init payload without yjs tables",
    async () => {
      const response = await fetch(`${api.url}/v1/sync/stream`);
      expect(response.ok).toBe(true);

      const sse = createSseReader(response);
      const event = await sse.readEvent();
      await sse.close();

      expect(event).toBeTruthy();
      expect(event?.event).toBe("init");

      const payload = event?.data as { tables: Record<string, unknown[]> };
      expect(payload.tables).toHaveProperty("projects");
      expect(payload.tables).not.toHaveProperty("ydoc_updates");
      expect(payload.tables).not.toHaveProperty("ydoc_awareness");
      expect(payload.tables).not.toHaveProperty("ydoc_resume_state");
    },
    TEST_TIMEOUT,
  );

  test(
    "streams project create changes to connected clients",
    async () => {
      const response = await fetch(`${api.url}/v1/sync/stream`);
      expect(response.ok).toBe(true);

      const sse = createSseReader(response);
      const initEvent = await sse.readEvent();
      expect(initEvent?.event).toBe("init");

      const repo = createGitRepo();
      dirs.push(repo);

      runPstdio("projects create realtime-e2e-project", repo, { PSTDIO_API_URL: api.url });

      let projectEvent: SseEvent | null = null;
      for (let i = 0; i < 20; i += 1) {
        const event = await sse.readEvent();
        if (!event) break;
        if (event.event !== "sync:set") continue;

        const data = event.data as { table: string; data: { name?: string } };
        if (data.table === "projects" && data.data.name === "realtime-e2e-project") {
          projectEvent = event;
          break;
        }
      }

      await sse.close();

      expect(projectEvent).toBeTruthy();
    },
    TEST_TIMEOUT,
  );

  test(
    "streams ticket creation to connected clients",
    async () => {
      const repo = createGitRepo();
      dirs.push(repo);

      runPstdio("projects create realtime-ticket-project", repo, { PSTDIO_API_URL: api.url });

      const response = await fetch(`${api.url}/v1/sync/stream`);
      expect(response.ok).toBe(true);

      const sse = createSseReader(response);
      const initEvent = await sse.readEvent();
      expect(initEvent?.event).toBe("init");

      runPstdio('tickets create --content "Realtime ticket test"', repo, { PSTDIO_API_URL: api.url });

      let ticketEvent: SseEvent | null = null;
      for (let i = 0; i < 20; i += 1) {
        const event = await sse.readEvent();
        if (!event) break;
        if (event.event !== "sync:set") continue;

        const data = event.data as { table: string; data: { display_title?: string } };
        if (data.table === "tickets" && data.data.display_title === "Realtime ticket test") {
          ticketEvent = event;
          break;
        }
      }

      await sse.close();

      expect(ticketEvent).toBeTruthy();
    },
    TEST_TIMEOUT,
  );

  test(
    "ticket update in one client is reflected in another",
    async () => {
      const repo = createGitRepo();
      dirs.push(repo);

      runPstdio("projects create cross-client-project", repo, { PSTDIO_API_URL: api.url });

      // Open two SSE connections (simulating two client instances)
      const [responseA, responseB] = await Promise.all([
        fetch(`${api.url}/v1/sync/stream`),
        fetch(`${api.url}/v1/sync/stream`),
      ]);

      const sseA = createSseReader(responseA);
      const sseB = createSseReader(responseB);

      // Consume init events
      await sseA.readEvent();
      await sseB.readEvent();

      // Create a ticket (both clients should see it)
      runPstdio('tickets create --content "Cross client ticket"', repo, { PSTDIO_API_URL: api.url });

      const findTicketEvent = async (sse: ReturnType<typeof createSseReader>) => {
        for (let i = 0; i < 20; i += 1) {
          const event = await sse.readEvent();
          if (!event) break;
          if (event.event !== "sync:set") continue;

          const data = event.data as { table: string; data: { display_title?: string } };
          if (data.table === "tickets" && data.data.display_title === "Cross client ticket") {
            return event;
          }
        }
        return null;
      };

      const [ticketA, ticketB] = await Promise.all([findTicketEvent(sseA), findTicketEvent(sseB)]);

      await sseA.close();
      await sseB.close();

      expect(ticketA).toBeTruthy();
      expect(ticketB).toBeTruthy();
    },
    TEST_TIMEOUT,
  );
});
