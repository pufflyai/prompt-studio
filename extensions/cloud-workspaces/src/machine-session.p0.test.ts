import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CommandContext, SessionMessage } from "@pstdio/sdk/extensions";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { createMachineHarness } from "./agent";
import { createInstances } from "./instances";
import { createMachineCommands } from "./machine-commands";

async function connectionFixture(options: { retained?: boolean; historyFailure?: boolean } = {}) {
  const root = await mkdtemp(join(tmpdir(), "pc-connect-history-"));
  const instanceId = randomUUID(),
    machineId = randomUUID(),
    conversationId = randomUUID();
  const requests: { method: string; path: string }[] = [];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname;
      requests.push({ method: request.method, path });
      if (path.endsWith("/capabilities")) return Response.json({ requests: true, attachments: true });
      if (path.endsWith("/conversations"))
        return Response.json({
          items:
            options.retained === false
              ? []
              : [
                  {
                    conversation_id: conversationId,
                    status: "retained",
                    last_activity_at: "2026-11-22T00:00:00Z",
                  },
                ],
        });
      if (path.endsWith("/conversation/open")) return Response.json({ turns: [] });
      if (path.includes("/conversations/")) {
        if (options.historyFailure)
          return Response.json(
            { error: { code: "history_unavailable", message: "History unavailable" } },
            { status: 503 },
          );
        return Response.json({
          items: [
            {
              message_id: "saved-reply",
              role: "assistant",
              occurred_at: "2026-11-22T00:00:00Z",
              content: "The saved conversation",
            },
          ],
          next_cursor: null,
        });
      }
      return Response.json({ id: machineId, external_id: "Agent", state: "ready", metadata: {} });
    },
  });
  await mkdir(join(root, instanceId));
  await Bun.write(
    join(root, instanceId, "instance.json"),
    JSON.stringify({ id: instanceId, url: server.url.toString() }),
  );
  await Bun.write(
    join(root, instanceId, "owner.json"),
    JSON.stringify({ token: "fixture", expiresAt: new Date(Date.now() + 60000).toISOString() }),
  );
  const instances = createInstances(root);
  const storage = createMemoryStorage();
  const state = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {}, overrides: { extensionId: "pocketcoder.pocketcoder" } });
  const harnessCtx = { ...ctx, name: "fixture", state, logger: console };
  const harness = createMachineHarness(() => instances);
  const messages: SessionMessage[] = [];
  const opened: unknown[] = [];
  const created: Awaited<ReturnType<CommandContext["sessions"]["create"]>>[] = [];
  let agentSessionId: string | null = null;
  ctx.navigation.open = (target) => {
    opened.push(target);
  };
  ctx.sessions.invokeHarnessOperation = async (sessionId, input) => {
    const operation = await harness.prepareOperation!(harnessCtx, { sessionId }, input);
    const result = await operation.invoke({
      events: {
        getMessages: () => messages,
        push(patch) {
          if (patch.op === "replace" && patch.path === "/messages")
            messages.splice(0, messages.length, ...(patch.value as SessionMessage[]));
        },
      },
    });
    expect(result.kind).toBe("started");
    if (result.kind !== "started") return { status: "completed" };
    agentSessionId = result.session.agentSessionId ?? null;
    await result.session.done;
    return { status: "started" };
  };
  ctx.sessions.create = async (input) => {
    const timestamp = new Date().toISOString();
    const session: Awaited<ReturnType<CommandContext["sessions"]["create"]>> = {
      id: randomUUID(),
      type: "session",
      title: input.title,
      status: "completed",
      archived: false,
      agent: input.harness?.harnessId ?? null,
      cwd: null,
      lastSelectedModel: null,
      workspaceId: null,
      originalSessionId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastRequestStarted: null,
      lastRequestEnded: null,
      usage: null,
      last_selected_model: null,
      workspace_id: null,
      original_session_id: null,
      created_at: timestamp,
      updated_at: timestamp,
      last_request_started: null,
      last_request_ended: null,
      anchors_json: [],
    };
    created.push(session);
    // Model the public host operation result, including its returned failed row.
    if (input.operation) {
      try {
        session.operationResult = await ctx.sessions.invokeHarnessOperation(session.id, input.operation);
      } catch (error) {
        session.status = "failed";
        session.operationResult = { status: "completed", message: String(error) };
      }
    }
    return session;
  };
  ctx.sessions.get = async (id) => {
    const session = created.find((item) => item.id === id);
    return session ? { ...session, projectId: ctx.projectId, agentSessionId, sessionFileId: null, params: null } : null;
  };
  const connect = () =>
    createMachineCommands(() => instances).connectMachine.run(ctx, { instance: instanceId, machineId });
  return {
    connect,
    instances,
    instanceId,
    machineId,
    conversationId,
    requests,
    messages,
    created,
    opened,
    storage,
    async seedBlank(savedConversationId: string) {
      const session = await ctx.sessions.create({
        title: "Previously connected",
        harness: { harnessId: `${ctx.extensionId}.harness.agent` },
      });
      await instances.bindSession(session.id, instanceId, machineId, savedConversationId);
      await storage.set(`machine-session:${instanceId}:${machineId}`, session.id);
      return session;
    },
    nativeId: () => agentSessionId,
    async close() {
      await harness.dispose?.(harnessCtx);
      await server.stop(true);
      await rm(root, { recursive: true, force: true });
    },
  };
}

test("connecting loads the retained conversation without submitting a turn and reuses that session", async () => {
  const f = await connectionFixture();
  try {
    const result = await f.connect();
    expect(f.messages).toMatchObject([
      { id: "saved-reply", parts: [{ type: "text", text: "The saved conversation" }] },
    ]);
    expect(f.nativeId()).toBe(`${f.instanceId}:${f.machineId}:${f.conversationId}`);
    expect(await f.instances.sessionTarget(result.sessionId)).toEqual({
      instanceId: f.instanceId,
      machineId: f.machineId,
      conversationId: f.conversationId,
    });
    expect(f.opened).toHaveLength(1);
    expect(await f.connect()).toEqual(result);
    expect(f.created).toHaveLength(1);
    expect(f.requests.filter((request) => request.path.endsWith("/conversations"))).toHaveLength(1);
    expect(f.requests.every((request) => request.method === "GET")).toBe(true);
  } finally {
    await f.close();
  }
});

test("reconnecting a previously blank session loads its saved conversation and preserves the session ID", async () => {
  const f = await connectionFixture();
  const savedConversationId = randomUUID();
  try {
    const previous = await f.seedBlank(savedConversationId);
    expect((await f.connect()).sessionId).toBe(previous.id);
    expect(f.messages).toMatchObject([{ id: "saved-reply" }]);
    expect(f.nativeId()).toBe(`${f.instanceId}:${f.machineId}:${savedConversationId}`);
    expect(f.created).toHaveLength(1);
    expect(f.requests.filter((request) => request.path.endsWith("/conversations"))).toHaveLength(0);
    expect(f.requests.some((request) => request.path.endsWith(`/conversations/${savedConversationId}`))).toBe(true);
    expect(f.requests.every((request) => request.method === "GET")).toBe(true);
  } finally {
    await f.close();
  }
});

test("failed history attachment retains its failed session for retry without opening it", async () => {
  const f = await connectionFixture({ historyFailure: true });
  try {
    await expect(f.connect()).rejects.toThrow("History unavailable");
    expect(await f.storage.get(`machine-session:${f.instanceId}:${f.machineId}`)).toBe(f.created[0]?.id);
    expect(f.opened).toEqual([]);
    expect(f.created.map((session) => session.status)).toEqual(["failed"]);
    expect(f.requests.every((request) => request.method === "GET")).toBe(true);
  } finally {
    await f.close();
  }
});

test("retrying a failed history attachment reuses the recorded session", async () => {
  const options = { historyFailure: true };
  const f = await connectionFixture(options);
  try {
    await expect(f.connect()).rejects.toThrow("History unavailable");
    options.historyFailure = false;
    await f.connect();
    expect(f.created).toHaveLength(1);
    expect(f.messages).toMatchObject([{ id: "saved-reply" }]);
    expect(f.opened).toHaveLength(1);
  } finally {
    await f.close();
  }
});

test("a machine without retained conversations opens a new empty session without executing", async () => {
  const f = await connectionFixture({ retained: false });
  try {
    await f.connect();
    expect(f.created).toHaveLength(1);
    expect(f.created[0].operationResult).toBeUndefined();
    expect(f.messages).toEqual([]);
    expect(f.nativeId()).toBeNull();
    expect(f.opened).toHaveLength(1);
    expect(f.requests.every((request) => request.method === "GET")).toBe(true);
  } finally {
    await f.close();
  }
});
