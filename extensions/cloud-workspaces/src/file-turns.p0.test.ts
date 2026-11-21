import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessContext, HarnessEventSink } from "@pstdio/sdk/extensions";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { reconnectFileTurn, resumeFileTurn, startFileTurn, supportsFileTurns } from "./file-turns";
import { createInstances } from "./instances";

async function fixture(handle: (request: Request) => Response | Promise<Response>) {
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname;
      if (path.includes("/conversation/open")) return Response.json({ turns: [] });
      if (path.includes("/conversations/")) return Response.json({ items: [], next_cursor: null });
      return handle(request);
    },
  });
  const root = await mkdtemp(join(tmpdir(), "pc-file-turn-"));
  const instanceId = randomUUID(),
    machineId = randomUUID(),
    sessionId = randomUUID();
  const directory = join(root, instanceId);
  await mkdir(directory);
  await Bun.write(join(directory, "instance.json"), JSON.stringify({ id: instanceId, url: server.url.toString() }));
  await Bun.write(
    join(directory, "owner.json"),
    JSON.stringify({ token: "host-fixture", expiresAt: new Date(Date.now() + 60000).toISOString() }),
  );
  const state = createMemoryStorage();
  const ctx: HarnessContext = {
    ...makeCommandContext({
      storage: createMemoryStorage(),
      projectId: "test",
      params: {},
      overrides: { extensionId: "pocketcoder.pocketcoder" },
    }),
    name: "fixture",
    logger: console,
    state: {
      get: (key) => state.get(key),
      set: (key, value) => state.set(key, value),
      delete: (key) => state.delete(key),
    },
  };
  const instances = createInstances(root);
  const ref = { instanceId, machineId, sessionId: `${instanceId}:${machineId}`, instances };
  const events: HarnessEventSink = { getMessages: () => [], push() {} };
  const input = { sessionId, prompt: "hello", events, signal: AbortSignal.timeout(5000) };
  return {
    ctx,
    ref,
    input,
    state,
    async close() {
      await server.stop(true);
      await rm(root, { recursive: true, force: true });
    },
  };
}

test.each([400, 413, 422])("a definitive initial POST rejection (%s) releases the pending turn", async (status) => {
  let rejected = true;
  let request: { requestId: string; message: string };
  const f = await fixture(async (req) => {
    if (req.method === "POST") {
      if (rejected) return Response.json({ error: "invalid input" }, { status });
      request = await req.json();
      return Response.json({});
    }
    const receipt = {
      acceptance: {
        execution: { requestId: request.requestId },
        input: { message: request.message },
        inputs: { objects: [] },
      },
      phase: "terminal",
      finalizedAt: new Date().toISOString(),
      outcome: { status: "completed", finalResponse: "reply" },
    };
    return Response.json(
      new URL(req.url).searchParams.has("limit") ? { items: [receipt], next_cursor: null } : receipt,
    );
  });
  try {
    const first = await startFileTurn(f.ctx, f.input, f.ref);
    expect(await first.done).toEqual({ status: "failed" });
    expect(await f.state.get(`file-turn:${f.input.sessionId}`)).toBeUndefined();
    rejected = false;
    const next = await startFileTurn(f.ctx, f.input, f.ref);
    expect(await next.done).toEqual({ status: "completed" });
  } finally {
    await f.close();
  }
});

test("a rejected replay retains a request whose first submission may have succeeded", async () => {
  let attempts = 0;
  const f = await fixture(() =>
    Response.json({ error: "uncertain first submission" }, { status: ++attempts === 1 ? 503 : 422 }),
  );
  try {
    const first = await startFileTurn(f.ctx, f.input, f.ref);
    expect(await first.done).toEqual({ status: "disconnected" });
    const pending = await f.state.get(`file-turn:${f.input.sessionId}`);
    expect(pending).toBeDefined();
    const replay = await reconnectFileTurn(f.ctx, { ...f.input, agentSessionId: first.agentSessionId ?? "" }, f.ref);
    expect(await replay?.done).toEqual({ status: "disconnected" });
    expect(await f.state.get<unknown>(`file-turn:${f.input.sessionId}`)).toEqual(pending);
    await expect(startFileTurn(f.ctx, f.input, f.ref)).rejects.toThrow("pending request");
  } finally {
    await f.close();
  }
});

test("capability detection preserves authorization failures", async () => {
  const f = await fixture(() => new Response(null, { status: 403 }));
  try {
    await expect(supportsFileTurns(f.ref)).rejects.toThrow("403");
  } finally {
    await f.close();
  }
});

test("cancellation waits for canonical finalization before releasing the pending turn", async () => {
  let ready = false;
  let reads = 0;
  const f = await fixture((req) => {
    if (req.method === "POST") return Response.json({});
    reads++;
    return Response.json({
      phase: "canceled",
      finalizedAt: ready ? new Date().toISOString() : null,
      outcome: { status: "canceled" },
    });
  });
  try {
    const session = await startFileTurn(f.ctx, f.input, f.ref);
    while (reads < 2) await Bun.sleep(10);
    expect(await f.state.get(`file-turn:${f.input.sessionId}`)).toBeDefined();
    ready = true;
    expect(await session.done).toEqual({ status: "cancelled" });
    expect(await f.state.get(`file-turn:${f.input.sessionId}`)).toBeUndefined();
  } finally {
    await f.close();
  }
});

test("Stop while recovering a pending request does not launch its queued follow-up", async () => {
  let request: { requestId: string; message: string };
  let canceled = false;
  let finalized = false;
  let reads = 0;
  const prompts: string[] = [];
  const f = await fixture(async (req) => {
    const path = new URL(req.url).pathname;
    if (path.endsWith("/cancel")) {
      canceled = true;
      return Response.json({});
    }
    if (req.method === "POST") {
      request = await req.json();
      prompts.push(request.message);
      return Response.json(receipt());
    }
    reads++;
    return Response.json(receipt());
  });
  function receipt() {
    return {
      acceptance: {
        execution: {
          workspaceId: f.ref.machineId,
          incarnationId: "test",
          owner: "conversation-request",
          requestId: request.requestId,
        },
      },
      phase: canceled ? "canceled" : "running",
      outcome: { status: canceled ? "canceled" : "completed" },
      finalizedAt: finalized ? new Date().toISOString() : null,
    };
  }
  const disconnect = new AbortController();
  try {
    const first = await startFileTurn(f.ctx, { ...f.input, signal: disconnect.signal }, f.ref);
    while (!reads) await Bun.sleep(10);
    disconnect.abort();
    expect(await first.done).toEqual({ status: "disconnected" });
    const resumed = await resumeFileTurn(
      f.ctx,
      { ...f.input, agentSessionId: first.agentSessionId ?? "", prompt: "queued follow-up" },
      f.ref,
    );
    await resumed.stop();
    finalized = true;
    expect(await resumed.done).toEqual({ status: "cancelled" });
    expect(new Set(prompts)).toEqual(new Set(["hello"]));
  } finally {
    await f.close();
  }
});

test("reattaching after a restored machine keeps the old terminal request and its conversation", async () => {
  const f = await fixture((req) => {
    if (req.method === "POST") throw new Error("A fenced request must not be submitted to the restored machine");
    return Response.json({ phase: "lost", finalizedAt: new Date().toISOString(), outcome: { status: "lost" } });
  });
  try {
    const conversationId = randomUUID();
    await f.state.set(`file-turn:${f.input.sessionId}`, {
      target: f.ref.sessionId,
      request: { requestId: randomUUID(), conversationId, message: "accepted before restore", files: [] },
    });
    const machineId = randomUUID();
    const ref = { ...f.ref, machineId, sessionId: `${f.ref.instanceId}:${machineId}` };
    const session = await reconnectFileTurn(
      f.ctx,
      { ...f.input, agentSessionId: `${f.ref.sessionId}:${conversationId}` },
      ref,
    );
    expect(await session?.done).toEqual({ status: "failed" });
    expect(session?.agentSessionId).toBe(`${ref.sessionId}:${conversationId}`);
    expect(await f.state.get(`file-turn:${f.input.sessionId}`)).toBeUndefined();
    expect(await f.state.get(`file-conversation:${f.input.sessionId}`)).toBe(conversationId);
  } finally {
    await f.close();
  }
});
