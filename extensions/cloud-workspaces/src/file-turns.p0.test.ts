import { expect, spyOn, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { reconnectFileTurn, resumeFileTurn, startFileTurn, supportsFileTurns } from "./file-turns";
import { fileTurnFixture as fixture } from "./file-turns.test-fixture";

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

test("Stop that races finalization does not restore the completed request", async () => {
  let request: { requestId: string };
  let posts = 0;
  let finalized = false;
  const stopReceipt = Promise.withResolvers<void>();
  const f = await fixture(async (req) => {
    const path = new URL(req.url).pathname;
    if (path.endsWith("/cancel")) return Response.json({});
    const receipt = () => ({
      acceptance: { execution: { requestId: request.requestId } },
      phase: finalized ? "terminal" : "running",
      outcome: { status: "completed" },
      finalizedAt: finalized ? new Date().toISOString() : null,
    });
    if (req.method !== "POST") return Response.json(receipt());
    request = await req.json();
    if (++posts === 1) return Response.json({});
    // Stop read this receipt before the observer saw the request finalize.
    const stale = receipt();
    await stopReceipt.promise;
    return Response.json(stale);
  });
  try {
    const session = await startFileTurn(f.ctx, f.input, f.ref);
    while (posts < 1) await Bun.sleep(10);
    const stopping = session.stop();
    while (posts < 2) await Bun.sleep(10);
    finalized = true;
    expect(await session.done).toEqual({ status: "completed" });
    stopReceipt.resolve();
    await stopping;
    expect(await f.state.get(`file-turn:${f.input.sessionId}`)).toBeUndefined();
    expect(await f.state.get(`file-cancel:${request!.requestId}`)).toBeUndefined();
  } finally {
    await f.close();
  }
});

test("a stalled receipt read disconnects a turn that has a run signal", async () => {
  const timeout = AbortSignal.timeout.bind(AbortSignal);
  // Shorten the transport deadline so the stalled read gives up quickly.
  const deadline = spyOn(AbortSignal, "timeout").mockImplementation((ms) => timeout(Math.min(ms, 100)));
  const f = await fixture((req) => (req.method === "POST" ? Response.json({}) : new Promise<Response>(() => {})));
  try {
    const session = await startFileTurn(f.ctx, { ...f.input, signal: new AbortController().signal }, f.ref);
    expect(await session.done).toEqual({ status: "disconnected" });
    expect(await f.state.get(`file-turn:${f.input.sessionId}`)).toBeDefined();
  } finally {
    deadline.mockRestore();
    await f.close();
  }
});

test("a Stop after a rejected first submission leaves no cancel ID behind", async () => {
  let requestId = "";
  const f = await fixture(async (req) => {
    requestId = ((await req.json()) as { requestId: string }).requestId;
    return Response.json({ error: "invalid input" }, { status: 422 });
  });
  try {
    const session = await startFileTurn(f.ctx, f.input, f.ref);
    expect(await session.done).toEqual({ status: "failed" });
    await expect(session.stop()).rejects.toThrow();
    expect(requestId).not.toBe("");
    expect(await f.state.get(`file-cancel:${requestId}`)).toBeUndefined();
  } finally {
    await f.close();
  }
});
