import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createTestApp } from "../../test-utils/create-test-app";
import type { AppBindings } from "../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;
let previousDefaultExtensions: string | undefined;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-sync-test-"));
  previousDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  ({ app } = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(tempRoot, "storage"),
  }));
});

afterAll(() => {
  if (previousDefaultExtensions === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  else process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaultExtensions;
  rmSync(tempRoot, { recursive: true, force: true });
});

interface SSEEvent {
  event: string;
  data: unknown;
}

const parseSSEBlock = (block: string): SSEEvent | null => {
  if (!block.trim()) return null;

  let event = "message";
  let data = "";

  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data = line.slice(5).trim();
  }

  return data ? { event, data: JSON.parse(data) } : null;
};

const createSSEReader = (response: Response) => {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const readEvents = async (count: number) => {
    const events: SSEEvent[] = [];

    while (events.length < count) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        const parsed = parseSSEBlock(block);
        if (parsed) events.push(parsed);
      }
    }

    return events;
  };

  const close = () => reader.cancel();

  return { readEvents, close };
};

describe("GET /v1/sync/stream", () => {
  test("returns SSE init event with all tables", async () => {
    const res = await app.request("/v1/sync/stream");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const sse = createSSEReader(res);
    const events = await sse.readEvents(1);
    sse.close();

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("init");

    const data = events[0].data as { tables: Record<string, unknown[]>; seq: number };
    expect(data).toHaveProperty("tables");
    expect(data).toHaveProperty("seq");
    expect(data.tables).toHaveProperty("projects");
    expect(Array.isArray(data.tables.projects)).toBe(true);
  });

  test("streams sync:set events when data changes", async () => {
    const res = await app.request("/v1/sync/stream");
    const sse = createSSEReader(res);

    // Create a project through the API.
    await app.request("/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "sync-test-project" }),
    });

    const allEvents = await sse.readEvents(2);
    sse.close();

    expect(allEvents[0].event).toBe("init");
    const initData = allEvents[0].data as { tables: { projects: Array<{ name: string }> } };
    const projectInSnapshot = initData.tables.projects.some((project) => project.name === "sync-test-project");
    const syncEvents = allEvents.filter((e) => e.event === "sync:set");
    const projectEvent = syncEvents.find((e) => (e.data as { table: string }).table === "projects");
    const projectInEvent = (projectEvent?.data as { data?: { name?: string } } | undefined)?.data?.name;

    expect(projectInSnapshot || projectInEvent === "sync-test-project").toBe(true);
  });
});
