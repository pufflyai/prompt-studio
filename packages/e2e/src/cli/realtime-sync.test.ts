import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

const readProjectId = (repo: string) => {
  const configPath = join(repo, ".pstdio", "config.json");
  return (JSON.parse(readFileSync(configPath, "utf8")) as { project_id: string }).project_id;
};

const createPlannerTicket = async (projectId: string, shorthand: string, content: string) => {
  const res = await fetch(
    `${api.url}/v1/projects/${projectId}/extension-commands/pstdio.planner.createTicket/execute`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ params: { shorthand, content } }),
    },
  );
  expect(res.status).toBe(200);
};

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
    "streams planner ticket collection changes to connected clients",
    async () => {
      const repo = createGitRepo();
      dirs.push(repo);

      runPstdio("projects create realtime-ticket-project", repo, { PSTDIO_API_URL: api.url });
      const projectId = readProjectId(repo);

      const response = await fetch(`${api.url}/v1/sync/stream`);
      expect(response.ok).toBe(true);

      const sse = createSseReader(response);
      const initEvent = await sse.readEvent();
      expect(initEvent?.event).toBe("init");

      await createPlannerTicket(projectId, "PS-1", "# Realtime ticket test");

      let ticketEvent: SseEvent | null = null;
      for (let i = 0; i < 20; i += 1) {
        const event = await sse.readEvent();
        if (!event) break;
        if (event.event !== "sync:set") continue;

        const data = event.data as {
          table: string;
          data: { collection?: string; value_json?: { shorthand?: string } };
        };
        if (
          data.table === "extension_collection_items" &&
          data.data.collection === "tickets" &&
          data.data.value_json?.shorthand === "PS-1"
        ) {
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
    "planner ticket collection changes are reflected in multiple clients",
    async () => {
      const repo = createGitRepo();
      dirs.push(repo);

      runPstdio("projects create cross-client-project", repo, { PSTDIO_API_URL: api.url });
      const projectId = readProjectId(repo);

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

      await createPlannerTicket(projectId, "PS-2", "# Cross client ticket");

      const findTicketEvent = async (sse: ReturnType<typeof createSseReader>) => {
        for (let i = 0; i < 20; i += 1) {
          const event = await sse.readEvent();
          if (!event) break;
          if (event.event !== "sync:set") continue;

          const data = event.data as {
            table: string;
            data: { collection?: string; value_json?: { shorthand?: string } };
          };
          if (
            data.table === "extension_collection_items" &&
            data.data.collection === "tickets" &&
            data.data.value_json?.shorthand === "PS-2"
          ) {
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
