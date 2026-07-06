import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { TerminalSessionHandle } from "pstdio-api-contracts/extension-kernel";
import { createApp } from "../../app";
import type { AppBindings } from "../../types";
import { createTerminalRoutes } from "./routes";

let app: OpenAPIHono<AppBindings>;
let closeApp: () => Promise<void>;
let tempRoot: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-terminal-test-"));
  ({ app, close: closeApp } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  }));
});

afterAll(async () => {
  await closeApp();
  rmSync(tempRoot, { recursive: true, force: true });
});

const openSession = async (body: Record<string, unknown>) => {
  const res = await app.request("/v1/terminal/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(res.status).toBe(201);
  return (await res.json()) as { sessionId: string };
};

type SseEvent = { event: string; data: Record<string, unknown> };

const readSseEvents = async (res: Response) => {
  const text = await res.text();
  const events: SseEvent[] = [];
  for (const block of text.split("\n\n")) {
    const eventLine = block.split("\n").find((line) => line.startsWith("event:"));
    const dataLine = block.split("\n").find((line) => line.startsWith("data:"));
    if (!eventLine || !dataLine) continue;
    events.push({
      event: eventLine.slice("event:".length).trim(),
      data: JSON.parse(dataLine.slice("data:".length).trim()),
    });
  }
  return events;
};

describe("terminal session routes", () => {
  test("opens a session and streams terminal output and exit over SSE", async () => {
    const handle: TerminalSessionHandle = {
      id: "scripted-session",
      write: () => undefined,
      resize: () => undefined,
      kill: async () => undefined,
      events: async function* () {
        yield { kind: "data", chunk: new TextEncoder().encode("hello-pty\n") };
        yield { kind: "exit", code: 0, signal: null };
      },
    };
    const routes = createTerminalRoutes({
      terminal: {
        openSession: () => handle,
      },
    });
    const opened = await routes.request("/terminal/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cols: 80, rows: 24 }),
    });
    expect(opened.status).toBe(201);
    const { sessionId } = (await opened.json()) as { sessionId: string };
    expect(sessionId).toBeTruthy();

    const res = await routes.request(`/terminal/sessions/${sessionId}/events`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const events = await readSseEvents(res);
    const output = events
      .filter((event) => event.event === "data")
      .map((event) => Buffer.from(String(event.data.chunk), "base64").toString("utf8"))
      .join("");
    expect(output).toContain("hello-pty");

    const exit = events.find((event) => event.event === "exit");
    expect(exit?.data.code).toBe(0);
  });

  test("writes stdin to a live session", async () => {
    const { sessionId } = await openSession({ command: ["/bin/cat"], cols: 80, rows: 24 });

    const write = await app.request(`/v1/terminal/sessions/${sessionId}/write`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: Buffer.from("echo-back\r").toString("base64") }),
    });
    expect(write.status).toBe(200);

    const resize = await app.request(`/v1/terminal/sessions/${sessionId}/resize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cols: 100, rows: 30 }),
    });
    expect(resize.status).toBe(200);

    const eventsPromise = (async () => readSseEvents(await app.request(`/v1/terminal/sessions/${sessionId}/events`)))();

    // Give cat a moment to echo before killing the session so the stream ends.
    await Bun.sleep(150);
    const kill = await app.request(`/v1/terminal/sessions/${sessionId}`, { method: "DELETE" });
    expect(kill.status).toBe(200);

    const events = await eventsPromise;
    const output = events
      .filter((event) => event.event === "data")
      .map((event) => Buffer.from(String(event.data.chunk), "base64").toString("utf8"))
      .join("");
    expect(output).toContain("echo-back");
    expect(events.at(-1)?.event).toBe("exit");
  });

  test("returns 404 for operations on unknown sessions", async () => {
    const write = await app.request("/v1/terminal/sessions/unknown/write", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: "" }),
    });
    expect(write.status).toBe(404);

    const events = await app.request("/v1/terminal/sessions/unknown/events");
    expect(events.status).toBe(404);
  });

  test("kills and removes a session when the SSE client aborts", async () => {
    let killed = 0;
    let releaseEvents: (() => void) | undefined;
    const handle: TerminalSessionHandle = {
      id: "abort-session",
      write: () => undefined,
      resize: () => undefined,
      kill: async () => {
        killed += 1;
        releaseEvents?.();
      },
      events: async function* () {
        await new Promise<void>((resolve) => {
          releaseEvents = resolve;
        });
      },
    };
    const routes = createTerminalRoutes({
      terminal: {
        openSession: () => handle,
      },
    });
    const opened = await routes.request("/terminal/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cols: 80, rows: 24 }),
    });
    expect(opened.status).toBe(201);

    const abort = new AbortController();
    const events = await routes.request("/terminal/sessions/abort-session/events", { signal: abort.signal });
    expect(events.status).toBe(200);
    const reader = events.body?.getReader();
    expect(reader).toBeDefined();
    const read = reader!.read().catch(() => undefined);
    for (let attempt = 0; attempt < 50 && !releaseEvents; attempt += 1) await Bun.sleep(1);
    expect(releaseEvents).toBeDefined();

    abort.abort();
    await Promise.race([read, Bun.sleep(100)]);
    for (let attempt = 0; attempt < 50 && killed === 0; attempt += 1) await Bun.sleep(1);

    expect(killed).toBe(1);
    const write = await routes.request("/terminal/sessions/abort-session/write", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: "" }),
    });
    expect(write.status).toBe(404);
  });
});
