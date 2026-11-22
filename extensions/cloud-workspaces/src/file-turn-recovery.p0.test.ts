import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import type { WorkspaceRequest } from "@pstdio/pocketcoder-sdk";
import type { SessionMessage } from "@pstdio/sdk/extensions";
import { startFileTurn } from "./file-turns";
import { fileTurnFixture } from "./file-turns.test-fixture";

test("late Stop completion cannot restore a finalized pending request", async () => {
  const stopped = Promise.withResolvers<void>();
  const releaseStop = Promise.withResolvers<void>();
  const observing = Promise.withResolvers<void>();
  let submitted = 0;
  let finalized = false;
  let request: WorkspaceRequest;
  const cancelIds: string[] = [];
  const receipt = (done: boolean) => ({
    acceptance: { execution: { requestId: request.requestId } },
    phase: "terminal",
    finalizedAt: done ? new Date().toISOString() : null,
    outcome: { status: "completed" },
  });
  const f = await fileTurnFixture(async (req) => {
    if (new URL(req.url).pathname.endsWith("/cancel")) {
      cancelIds.push((await req.json()).cancelId);
      return Response.json({});
    }
    if (req.method === "POST") {
      request = await req.json();
      if (++submitted > 1) {
        const stale = receipt(false);
        stopped.resolve();
        await releaseStop.promise;
        return Response.json(stale);
      }
    }
    if (req.method === "GET") observing.resolve();
    return Response.json(receipt(finalized));
  });
  let stopping: Promise<void> | undefined;
  try {
    const session = await startFileTurn(f.ctx, f.input, f.ref);
    await observing.promise;
    stopping = Promise.resolve(session.stop());
    await stopped.promise;
    finalized = true;
    expect(await session.done).toEqual({ status: "completed" });
    expect(await f.state.get(`file-turn:${f.input.sessionId}`)).toBeUndefined();
    releaseStop.resolve();
    await stopping;
    expect(await f.state.get(`file-turn:${f.input.sessionId}`)).toBeUndefined();
    expect(cancelIds).toHaveLength(1);
    const next = await startFileTurn(f.ctx, { ...f.input, prompt: "next message" }, f.ref);
    expect(await next.done).toEqual({ status: "completed" });
  } finally {
    releaseStop.resolve();
    try {
      await stopping?.catch(() => {});
    } finally {
      await f.close();
    }
  }
});

test("receipt polls retain saved history without rereading unchanged pages and refresh final output", async () => {
  let request: WorkspaceRequest;
  let reads = 0;
  let finalized = false;
  let historyReads = 0;
  const polled = Promise.withResolvers<void>();
  const f = await fileTurnFixture(
    async (req) => {
      const url = new URL(req.url);
      if (url.pathname.endsWith("/conversation/open"))
        return Response.json({
          turns: [
            {
              conversation_id: request.conversationId,
              turn_id: request.requestId,
              messages: [message("live", "working", 1)],
            },
          ],
        });
      if (url.pathname.includes("/conversations/")) {
        historyReads++;
        if (!url.searchParams.has("cursor"))
          return Response.json({ items: [message("old", "saved earlier", 0)], next_cursor: "page-two" });
        return Response.json({
          items: finalized ? [message("live", "final answer", 1, request.requestId)] : [],
          next_cursor: null,
        });
      }
      if (req.method === "POST") request = await req.json();
      else if (++reads === 3) polled.resolve();
      return Response.json({
        phase: "terminal",
        finalizedAt: finalized ? new Date().toISOString() : null,
        outcome: { status: "completed" },
      });
    },
    { conversation: true },
  );
  const messages: SessionMessage[] = [];
  let updates = 0;
  const input = {
    ...f.input,
    events: {
      getMessages: () => messages,
      push(patch: { op: string; path: string; value?: unknown }) {
        if (patch.op === "replace" && patch.path === "/messages") {
          updates++;
          messages.splice(0, messages.length, ...(patch.value as SessionMessage[]));
        }
      },
    },
  };
  let session: Awaited<ReturnType<typeof startFileTurn>> | undefined;
  try {
    session = await startFileTurn(f.ctx, input, f.ref);
    await polled.promise;
    // The next receipt can be in flight; give its unchanged open snapshot time to arrive.
    await Bun.sleep(20);
    expect(historyReads).toBe(2);
    expect(updates).toBe(1);
    expect(messages.map((m) => m.parts)).toEqual([
      [{ type: "text", text: "saved earlier" }],
      [{ type: "text", text: "working" }],
    ]);
    finalized = true;
    expect(await session.done).toEqual({ status: "completed" });
    expect(historyReads).toBe(4);
    expect(messages.map((m) => m.parts)).toEqual([
      [{ type: "text", text: "saved earlier" }],
      [{ type: "text", text: "final answer" }],
    ]);
  } finally {
    finalized = true;
    await session?.done;
    await f.close();
  }
});

test.each([
  "stored-overlap",
  "committed-departure",
])("live history preserves durable authority and departing output (%s)", async (mode) => {
  let request: WorkspaceRequest;
  let stage = 0;
  let opened = -1;
  let finalized = false;
  let historyReads = 0;
  const observed = [Promise.withResolvers<void>(), Promise.withResolvers<void>(), Promise.withResolvers<void>()];
  const openTurns = () => {
    if (stage === 2) return [];
    const messages = [message("live", stage === 0 ? "working" : "new live output", 1)];
    if (mode === "stored-overlap") messages.unshift(message("old", "stale live copy", 0));
    return [{ conversation_id: request.conversationId, turn_id: request.requestId, messages }];
  };
  const f = await fileTurnFixture(
    async (req) => {
      const path = new URL(req.url).pathname;
      if (path.endsWith("/conversation/open")) {
        opened = stage;
        return Response.json({ turns: openTurns() });
      }
      if (path.includes("/conversations/")) {
        historyReads++;
        return Response.json({
          items: [
            message("old", "canonical saved output", 0),
            ...(stage === 2 ? [message("live", "committed output", 1, request.requestId)] : []),
          ],
          next_cursor: null,
        });
      }
      if (req.method === "POST") request = await req.json();
      else if (opened === stage) observed[stage]!.resolve();
      return Response.json({
        phase: "running",
        finalizedAt: finalized ? new Date().toISOString() : null,
        outcome: { status: "completed" },
      });
    },
    { conversation: true },
  );
  const messages: SessionMessage[] = [];
  const input = {
    ...f.input,
    events: {
      getMessages: () => messages,
      push(patch: { op: string; path: string; value?: unknown }) {
        if (patch.op === "replace" && patch.path === "/messages")
          messages.splice(0, messages.length, ...(patch.value as SessionMessage[]));
      },
    },
  };
  let session: Awaited<ReturnType<typeof startFileTurn>> | undefined;
  try {
    session = await startFileTurn(f.ctx, input, f.ref);
    await observed[0]!.promise;
    stage = 1;
    await observed[1]!.promise;
    expect(historyReads).toBe(1);
    expect(messages.map((m) => m.parts)).toEqual([
      [{ type: "text", text: "canonical saved output" }],
      [{ type: "text", text: "new live output" }],
    ]);
    stage = 2;
    await observed[2]!.promise;
    expect(historyReads).toBe(2);
    expect(messages.map((m) => m.parts)).toEqual([
      [{ type: "text", text: "canonical saved output" }],
      [{ type: "text", text: "committed output" }],
    ]);
  } finally {
    finalized = true;
    await session?.done;
    await f.close();
  }
});

function message(id: string, content: string, second: number, turnId?: string) {
  return {
    message_id: id,
    role: "assistant",
    content,
    occurred_at: `2026-11-22T00:00:0${second}Z`,
    ...(turnId ? { identity: { turn_id: turnId } } : {}),
  };
}

test("a departed live turn stays visible until its delayed durable commit is observed", async () => {
  let request: WorkspaceRequest;
  let stage = 0;
  let opened = -1;
  let finalized = false;
  let historyReads = 0;
  const observed = [Promise.withResolvers<void>(), Promise.withResolvers<void>(), Promise.withResolvers<void>()];
  const f = await fileTurnFixture(
    async (req) => {
      const path = new URL(req.url).pathname;
      if (path.endsWith("/conversation/open")) {
        opened = stage;
        const turns =
          stage === 0
            ? [
                {
                  conversation_id: request.conversationId,
                  turn_id: request.requestId,
                  messages: [message("live", "visible live output", 1)],
                },
              ]
            : [];
        return Response.json({ turns });
      }
      if (path.includes("/conversations/")) {
        historyReads++;
        const items = [message("old", "saved output", 0)];
        if (stage === 2) items.push(message("live", "canonical committed output", 1, request.requestId));
        return Response.json({ items, next_cursor: null });
      }
      if (req.method === "POST") request = await req.json();
      else if (opened === stage) observed[stage]!.resolve();
      return Response.json({
        phase: "running",
        finalizedAt: finalized ? new Date().toISOString() : null,
        outcome: { status: "completed" },
      });
    },
    { conversation: true },
  );
  const messages: SessionMessage[] = [];
  const input = {
    ...f.input,
    events: {
      getMessages: () => messages,
      push(patch: { op: string; path: string; value?: unknown }) {
        if (patch.op === "replace" && patch.path === "/messages")
          messages.splice(0, messages.length, ...(patch.value as SessionMessage[]));
      },
    },
  };
  let session: Awaited<ReturnType<typeof startFileTurn>> | undefined;
  try {
    session = await startFileTurn(f.ctx, input, f.ref);
    await observed[0]!.promise;
    stage = 1;
    await observed[1]!.promise;
    expect(messages.at(-1)?.parts).toEqual([{ type: "text", text: "visible live output" }]);
    const beforeCommit = historyReads;
    stage = 2;
    await observed[2]!.promise;
    expect(historyReads).toBeGreaterThan(beforeCommit);
    expect(messages.at(-1)?.parts).toEqual([{ type: "text", text: "canonical committed output" }]);
    expect(finalized).toBe(false);
  } finally {
    finalized = true;
    await session?.done;
    await f.close();
  }
});

test("Stop reuses the controller cancellation identity when retrying a lost reply", async () => {
  const cancelId = randomUUID();
  const attempts: string[] = [];
  let request: WorkspaceRequest;
  let finalized = false;
  const f = await fileTurnFixture(async (req) => {
    if (new URL(req.url).pathname.endsWith("/cancel")) {
      const body = await req.json();
      attempts.push(body.cancelId);
      if (body.cancelId !== cancelId) return Response.json({ error: "Cancel identity conflict" }, { status: 409 });
      return Response.json({}, { status: attempts.length === 1 ? 503 : 200 });
    }
    if (req.method === "POST") request = await req.json();
    return Response.json({
      acceptance: { execution: { requestId: request.requestId } },
      phase: "canceled",
      cancel: { cancelId, requestedAt: "2026-11-22T00:00:00Z" },
      finalizedAt: finalized ? new Date().toISOString() : null,
    });
  });
  let session: Awaited<ReturnType<typeof startFileTurn>> | undefined;
  try {
    session = await startFileTurn(f.ctx, f.input, f.ref);
    await expect(Promise.resolve(session.stop())).rejects.toThrow("503");
    await session.stop();
    expect(attempts).toEqual([cancelId, cancelId]);
    finalized = true;
    expect(await session.done).toEqual({ status: "cancelled" });
  } finally {
    finalized = true;
    await session?.done;
    await f.close();
  }
});
