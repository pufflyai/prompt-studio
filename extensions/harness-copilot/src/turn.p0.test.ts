import { expect, test } from "bun:test";
import type { PermissionRequest } from "@github/copilot-sdk";
import { event, eventSink, fakeCopilot } from "./copilot.fixture";
import { LIVENESS, RPC_DEADLINE, startCopilotTurn } from "./turn";

const startTurn = (...args: Parameters<typeof startCopilotTurn>) => startCopilotTurn(...args).session;

const reply = (text: string) => [
  event("user.message", { content: "native prompt" }),
  event("assistant.message", { messageId: "m1", content: text }),
  event("session.idle", {}, true),
];

test("a turn streams into the conversation, keeps the host prompt, and releases the runtime", async () => {
  const copilot = fakeCopilot(() => reply("Hello"));
  const sink = eventSink();
  const session = await startTurn(
    {
      prompt: "Say hello",
      sessionId: "host",
      cwd: "/repo",
      model: "claude-sonnet-5.5",
      params: { reasoning: "high", permission_mode: "allow-all" },
      events: sink,
      attachments: [
        { fileId: "f", fileName: "a.png", mimeType: "image/png", sizeBytes: 3, localPath: "/tmp/a.png", url: "/f" },
      ],
    },
    copilot.factory,
    { PSTDIO_SESSION_ID: "host" },
  );
  expect(session.agentSessionId).toBe("copilot-session");
  expect(await session.done).toEqual({ status: "completed" });
  expect(copilot.configs[0]).toMatchObject({
    model: "claude-sonnet-5.5",
    reasoningEffort: "high",
    workingDirectory: "/repo",
    permissionMode: "allow-all",
    streaming: true,
  });
  expect(sink.messages.map((message) => message.parts)).toEqual([
    [
      { type: "text", text: "Say hello" },
      { type: "file", fileId: "f", filename: "a.png", mediaType: "image/png", size: 3, url: "/f" },
    ],
    [{ type: "text", text: "Hello" }],
  ]);
  // stop() detaches the session itself, with its own deadline.
  expect(copilot.calls).toEqual(["start", "create", "send:Say hello", "stop"]);
});

test("resuming appends after existing history and a session error fails the turn", async () => {
  const copilot = fakeCopilot(() => [
    event("user.message", { content: "again" }),
    event("session.error", { errorType: "quota", message: "Out of quota" }),
    event("session.idle", {}, true),
  ]);
  const sink = eventSink();
  sink.messages.push({ id: "old", role: "user", parts: [{ type: "text", text: "before" }] });
  const session = await startTurn(
    { prompt: "again", sessionId: "host", events: sink, agentSessionId: "copilot-session" },
    copilot.factory,
    {},
  );
  expect(await session.done).toEqual({ status: "failed" });
  expect(copilot.calls[1]).toBe("resume:copilot-session");
  expect(sink.messages.map((message) => message.id)).toEqual([
    "old",
    expect.stringMatching(/^copilot-/),
    expect.any(String),
  ]);
  expect(sink.messages[2]?.parts).toEqual([{ type: "error", errorType: "other", message: "Out of quota" }]);
});

test("stopping aborts Copilot and settles the turn as cancelled", async () => {
  const copilot = fakeCopilot(() => [event("user.message", { content: "long" })]);
  const session = await startTurn({ prompt: "long", sessionId: "host", events: eventSink() }, copilot.factory, {});
  await session.stop();
  expect(await session.done).toEqual({ status: "cancelled" });
  expect(copilot.calls).toContain("abort");
  expect(copilot.calls.at(-1)).toBe("stop");
});

test("Ask mode routes permission prompts to the host approval channel", async () => {
  const copilot = fakeCopilot(() => reply("ok"));
  const asked: unknown[] = [];
  const session = await startTurn(
    {
      prompt: "edit",
      sessionId: "host",
      events: eventSink(),
      params: { permission_mode: "manual" },
      approvals: {
        requestApproval: async (request) => {
          asked.push(request);
          return { id: request.id, decision: "deny" };
        },
      },
    },
    copilot.factory,
    {},
  );
  await session.done;
  const config = copilot.configs[0] as {
    permissionMode: string;
    onPermissionRequest(request: PermissionRequest): Promise<unknown>;
  };
  expect(config.permissionMode).toBe("manual");
  const decision = await config.onPermissionRequest({
    kind: "shell",
    fullCommandText: "rm -rf build",
    intention: "Clean",
    toolCallId: "t1",
  } as PermissionRequest);
  expect(decision).toMatchObject({ kind: "reject" });
  expect(asked).toEqual([
    expect.objectContaining({
      toolName: "shell",
      toolUseId: "t1",
      toolInput: { command: "rm -rf build", intention: "Clean" },
    }),
  ]);
});

test("without an approval channel Copilot is told nobody can approve", async () => {
  const copilot = fakeCopilot(() => reply("ok"));
  const session = await startTurn({ prompt: "x", sessionId: "host", events: eventSink() }, copilot.factory, {});
  await session.done;
  const config = copilot.configs[0] as { onPermissionRequest(request: PermissionRequest): Promise<unknown> };
  expect(await config.onPermissionRequest({ kind: "read", path: "a" } as PermissionRequest)).toEqual({
    kind: "user-not-available",
  });
});

test("steering delivers into the running turn and shows the host's prompt and attachments", async () => {
  const copilot = fakeCopilot((send) =>
    send.mode === "immediate"
      ? [
          event("user.message", { content: send.prompt, clientTurnId: send.clientTurnId }),
          event("assistant.message", { messageId: "m2", content: "Both done" }),
          event("session.idle", {}, true),
        ]
      : [event("user.message", { content: send.prompt })],
  );
  const sink = eventSink();
  const session = await startTurn({ prompt: "start", sessionId: "host", events: sink }, copilot.factory, {});
  const attachment = {
    fileId: "f",
    fileName: "b.txt",
    mimeType: "text/plain",
    sizeBytes: 1,
    localPath: "/tmp/b.txt",
    url: "/f",
  };
  expect(await session.steer({ deliveryId: "delivery-1", prompt: "and this", attachments: [attachment] })).toEqual({
    status: "accepted",
  });
  expect(await session.done).toEqual({ status: "completed" });
  expect(sink.messages.map((message) => message.id)).toEqual([expect.any(String), "delivery-1", "copilot-m2"]);
  expect(sink.messages[1]?.parts).toEqual([
    { type: "text", text: "and this" },
    { type: "file", fileId: "f", filename: "b.txt", mediaType: "text/plain", size: 1, url: "/f" },
  ]);
  expect(await session.steer({ deliveryId: "late", prompt: "too late", attachments: [] })).toMatchObject({
    status: "rejected",
  });
});

test("a turn fails instead of hanging when the Copilot runtime stops answering", async () => {
  const saved = { ...LIVENESS };
  Object.assign(LIVENESS, { intervalMs: 5, timeoutMs: 50 });
  try {
    const copilot = fakeCopilot(() => [event("user.message", { content: "x" })]);
    copilot.client.ping = () => Promise.reject(new Error("connection closed"));
    const sink = eventSink();
    const session = await startTurn({ prompt: "x", sessionId: "host", events: sink }, copilot.factory, {});
    expect(await session.done).toEqual({ status: "failed" });
    // A runtime that stopped answering is killed rather than asked to shut down.
    expect(copilot.calls.at(-1)).toBe("forceStop");
  } finally {
    Object.assign(LIVENESS, saved);
  }
});

test("an idle event left over from resuming does not end the new turn", async () => {
  const copilot = fakeCopilot(() => reply("fresh"));
  const sink = eventSink();
  const original = copilot.client.resumeSession;
  copilot.client.resumeSession = async (id, config) => {
    const resumed = await original(id, config);
    const on = resumed.on.bind(resumed);
    resumed.on = (handler) => {
      const off = on(handler);
      handler(event("session.idle", {}, true));
      return off;
    };
    return resumed;
  };
  const session = await startTurn(
    { prompt: "again", sessionId: "host", events: sink, agentSessionId: "copilot-session" },
    copilot.factory,
    {},
  );
  expect(await session.done).toEqual({ status: "completed" });
  expect(sink.messages.at(-1)?.parts).toEqual([{ type: "text", text: "fresh" }]);
});

test("the conversation shows a tool as failed when the turn ends with an error", async () => {
  const copilot = fakeCopilot(() => [
    event("user.message", { content: "run" }),
    event("tool.execution_start", { toolCallId: "t1", toolName: "bash" }),
    event("session.error", { errorType: "quota", message: "Out of quota" }),
    event("session.idle", {}, true),
  ]);
  const sink = eventSink();
  const session = await startTurn({ prompt: "run", sessionId: "host", events: sink }, copilot.factory, {});
  expect(await session.done).toEqual({ status: "failed" });
  expect(sink.messages[1]?.parts).toEqual([
    { type: "tool", tool: "bash", callId: "t1", status: "failed", state: { input: undefined } },
    { type: "error", errorType: "other", message: "Out of quota" },
  ]);
});

test("stopping a turn that is still starting cancels it before anything is sent", async () => {
  const copilot = fakeCopilot(() => reply("never"));
  const starting = Promise.withResolvers<void>();
  copilot.client.start = () => starting.promise;
  copilot.client.forceStop = async () => {
    copilot.calls.push("forceStop");
    starting.reject(new Error("runtime stopped"));
  };
  const turn = startCopilotTurn({ prompt: "x", sessionId: "host", events: eventSink() }, copilot.factory, {});
  await turn.stop();
  expect(await turn.done).toEqual({ status: "cancelled" });
  await expect(turn.session).rejects.toThrow();
  expect(copilot.calls).not.toContain("create");
  expect(copilot.calls.some((call) => call.startsWith("send"))).toBe(false);
});

test("steered input that Copilot never takes in is reported as uncertain", async () => {
  const finish = Promise.withResolvers<void>();
  const copilot = fakeCopilot((send) =>
    send.mode === "immediate" ? [] : [event("user.message", { content: send.prompt })],
  );
  const sink = eventSink();
  const session = await startTurn({ prompt: "start", sessionId: "host", events: sink }, copilot.factory, {});
  const steering = session.steer({ deliveryId: "d1", prompt: "late", attachments: [] });
  await Bun.sleep(5);
  void session.stop().then(finish.resolve);
  expect(await steering).toMatchObject({ status: "uncertain" });
  await finish.promise;
});

test("model-specific reasoning levels reach Copilot unchanged", async () => {
  const copilot = fakeCopilot(() => reply("ok"));
  const session = await startTurn(
    { prompt: "x", sessionId: "host", events: eventSink(), params: { reasoning: "minimal" } },
    copilot.factory,
    {},
  );
  await session.done;
  expect(copilot.configs[0]).toMatchObject({ reasoningEffort: "minimal", enableConfigDiscovery: true });
  const defaulted = fakeCopilot(() => reply("ok"));
  await (
    await startTurn(
      { prompt: "x", sessionId: "host", events: eventSink(), params: { reasoning: "default" } },
      defaulted.factory,
      {},
    )
  ).done;
  expect(defaulted.configs[0]?.reasoningEffort).toBeUndefined();
});

test("a turn ends when the runtime dies before it accepts the prompt, and stop never hangs on it", async () => {
  const saved = { liveness: { ...LIVENESS }, deadline: { ...RPC_DEADLINE } };
  Object.assign(LIVENESS, { intervalMs: 5, timeoutMs: 20 });
  Object.assign(RPC_DEADLINE, { ms: 20 });
  try {
    const copilot = fakeCopilot(() => []);
    const hung = new Promise<never>(() => {});
    copilot.client.ping = () => hung;
    const original = copilot.client.createSession;
    copilot.client.createSession = async (config) => {
      const session = await original(config);
      session.send = () => hung;
      session.abort = () => hung;
      return session;
    };
    const session = await startTurn({ prompt: "x", sessionId: "host", events: eventSink() }, copilot.factory, {});
    expect(await session.done).toEqual({ status: "failed" });
    expect(copilot.calls.at(-1)).toBe("forceStop");
    await session.stop();
  } finally {
    Object.assign(LIVENESS, saved.liveness);
    Object.assign(RPC_DEADLINE, saved.deadline);
  }
});
