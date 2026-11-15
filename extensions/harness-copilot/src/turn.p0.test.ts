import { expect, test } from "bun:test";
import type { PermissionRequest } from "@github/copilot-sdk";
import { event, eventSink, fakeCopilot } from "./copilot.fixture";
import { startCopilotTurn } from "./turn";

const reply = (text: string) => [
  event("user.message", { content: "native prompt" }),
  event("assistant.message", { messageId: "m1", content: text }),
  event("session.idle", {}, true),
];

test("a turn streams into the conversation, keeps the host prompt, and releases the runtime", async () => {
  const copilot = fakeCopilot(() => reply("Hello"));
  const sink = eventSink();
  const session = await startCopilotTurn(
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
  expect(copilot.calls).toEqual(["start", "create", "send:Say hello", "disconnect", "stop"]);
});

test("resuming appends after existing history and a session error fails the turn", async () => {
  const copilot = fakeCopilot(() => [
    event("user.message", { content: "again" }),
    event("session.error", { errorType: "quota", message: "Out of quota" }),
    event("session.idle", {}, true),
  ]);
  const sink = eventSink();
  sink.messages.push({ id: "old", role: "user", parts: [{ type: "text", text: "before" }] });
  const session = await startCopilotTurn(
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
  const session = await startCopilotTurn(
    { prompt: "long", sessionId: "host", events: eventSink() },
    copilot.factory,
    {},
  );
  await session.stop();
  expect(await session.done).toEqual({ status: "cancelled" });
  expect(copilot.calls).toContain("abort");
  expect(copilot.calls.at(-1)).toBe("stop");
});

test("Ask mode routes permission prompts to the host approval channel", async () => {
  const copilot = fakeCopilot(() => reply("ok"));
  const asked: unknown[] = [];
  const session = await startCopilotTurn(
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
  const session = await startCopilotTurn({ prompt: "x", sessionId: "host", events: eventSink() }, copilot.factory, {});
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
  const session = await startCopilotTurn({ prompt: "start", sessionId: "host", events: sink }, copilot.factory, {});
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
