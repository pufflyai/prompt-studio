import { afterEach, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { HarnessSession, HarnessSteeringInput } from "@pstdio/sdk/extensions";
import { parseTranscript } from "./harness";
import { recoverClaudeMessages } from "./history-reconciliation";
import { controlledChild, recordingSink, waitForStreamIo } from "./mocks/controlled-child";
import { normalizeClaudeCodeStream } from "./normalize-stream";
import { normalizeClaudeCodeMessages } from "./normalize-transcript";
import { userMessageFor } from "./session-input";
import { resumeClaudeCodeSession, type SpawnDeps, startClaudeCodeSession } from "./spawn";

const delivery: HarnessSteeringInput = {
  deliveryId: "25a3615a-f724-4ef8-9cf1-2f4cbb3b3b1c",
  prompt: "/correct this",
  attachments: [
    {
      fileId: "file",
      fileName: "note.txt",
      localPath: "/tmp/note.txt",
      mimeType: "text/plain",
      sizeBytes: 4,
      url: "/files/file",
    },
  ],
};
const cleanups: Array<() => Promise<unknown>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

const assistant = (text: string) => ({
  type: "assistant",
  message: { role: "assistant", content: [{ type: "text", text }] },
});
const replay = (uuid: string, content = delivery.prompt) => ({
  type: "user",
  uuid,
  isReplay: true,
  message: { role: "user", content },
});
const result = { type: "result", usage: {} };
const background = (tasks: string[]) => ({
  type: "system",
  subtype: "background_tasks_changed",
  session_id: "thread",
  tasks,
});

const setup = async (mode: "start" | "resume" = "resume") => {
  const process = controlledChild();
  const recording = recordingSink();
  const deps = { spawnProcess: () => process.child };
  const input = { prompt: "Initial", events: recording.sink };
  let session: HarnessSession;
  if (mode === "start") {
    const starting = startClaudeCodeSession(input, deps);
    process.emit({ type: "system", subtype: "init", session_id: "thread" });
    session = await starting;
  } else session = resumeClaudeCodeSession({ ...input, agentSessionId: "thread" }, deps);
  cleanups.push(async () => {
    process.child.exit();
    await session.done;
  });
  return { ...process, ...recording, session };
};

for (const mode of ["start", "resume"] as const) {
  test(`${mode} acknowledges live input once in stream order with attachments`, async () => {
    const { session, emit, written, messages } = await setup(mode);
    expect(session.steer).toBeFunction();
    emit(assistant("Before"));
    await waitForStreamIo();
    let settled = false;
    const accepted = session.steer!(delivery).then((value) => {
      settled = true;
      return value;
    });
    await waitForStreamIo();
    expect(settled).toBe(false);
    const sent = written().at(-1);
    expect(sent.uuid).toBe(delivery.deliveryId);
    expect(sent.message.content).toContain("<user-message>\n/correct this\n</user-message>");
    expect(sent.message.content).toContain('path="/tmp/note.txt"');
    emit(replay(sent.uuid, sent.message.content));
    emit(replay(sent.uuid, sent.message.content));
    emit(assistant("After"));
    expect(await accepted).toEqual({ status: "accepted" });
    await waitForStreamIo();
    expect(messages.map((message) => message.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(messages[2]).toMatchObject({
      id: delivery.deliveryId,
      parts: [
        { type: "text", text: delivery.prompt },
        { type: "file", fileId: "file" },
      ],
    });
    const native = normalizeClaudeCodeMessages([
      { uuid: "initial", type: "user", message: { role: "user", content: "Initial" } },
      { uuid: "before", type: "assistant", message: assistant("Before").message },
      { uuid: sent.uuid, type: "user", message: sent.message },
      { uuid: "after", type: "assistant", message: assistant("After").message },
    ]);
    const recovered = recoverClaudeMessages({ knownMessages: messages, nativeMessages: native });
    expect(recovered.kind).toBe("recovered");
    if (recovered.kind === "recovered")
      expect(recovered.messages[2]).toMatchObject({ id: delivery.deliveryId, parts: messages[2].parts });
  });
}

test("identical submissions retain their own identities in live and recovered history", async () => {
  const { session, emit, written, messages } = await setup();
  expect(session.steer).toBeFunction();
  const entries = [];
  for (const deliveryId of [delivery.deliveryId, "9d41353e-1ccc-40fd-a8db-71534e3e0f06"]) {
    const accepted = session.steer!({ ...delivery, deliveryId });
    const sent = written().at(-1);
    emit(replay(sent.uuid, sent.message.content));
    entries.push({ uuid: sent.uuid, type: "user", message: sent.message });
    expect(await accepted).toEqual({ status: "accepted" });
  }
  expect(messages.filter((message) => message.role === "user")).toHaveLength(3);
  const nativeMessages = normalizeClaudeCodeMessages(entries);
  expect(nativeMessages.map((message) => message.id)).toEqual(entries.map((entry) => entry.uuid));
  const recovered = recoverClaudeMessages({ knownMessages: messages.slice(1), nativeMessages });
  expect(recovered.kind).toBe("recovered");
  if (recovered.kind === "recovered")
    expect(recovered.messages.map((message) => message.parts)).toEqual(
      messages.slice(1).map((message) => message.parts),
    );
});

test("native queued-command attachments recover as distinct user messages by source UUID", () => {
  const entries = [delivery.deliveryId, "9d41353e-1ccc-40fd-a8db-71534e3e0f06"].map((source_uuid) => ({
    type: "attachment",
    uuid: crypto.randomUUID(),
    timestamp: "2026-10-30T20:34:58.803Z",
    attachment: {
      type: "queued_command",
      prompt: "identical",
      source_uuid,
      commandMode: "prompt",
      timestamp: "2026-10-30T20:34:58.803Z",
    },
  }));
  const messages = normalizeClaudeCodeMessages(
    parseTranscript(entries.map((entry) => JSON.stringify(entry)).join("\n")),
  );
  expect(messages.map((message) => message.id)).toEqual(entries.map((entry) => entry.attachment.source_uuid));
  expect(messages.map((message) => message.parts)).toEqual(entries.map(() => [{ type: "text", text: "identical" }]));
});

test("recovery pairs identical accepted input by native identity before later responses arrive", () => {
  const knownMessages = ["initial", delivery.deliveryId, "9d41353e-1ccc-40fd-a8db-71534e3e0f06"].map((id) => ({
    ...userMessageFor(id === "initial" ? "Initial" : delivery.prompt, [], id),
    createdAt: 100,
  }));
  const nativeMessages = [
    ...knownMessages.map((message) => ({ ...message, createdAt: 101 })),
    {
      id: "reply",
      role: "assistant" as const,
      createdAt: 102,
      parts: [{ type: "text" as const, text: "Final reply" }],
    },
  ];
  const recovered = recoverClaudeMessages({ knownMessages, nativeMessages });
  expect(recovered.kind).toBe("recovered");
  if (recovered.kind === "recovered")
    expect(recovered.messages.map((message) => message.id)).toEqual(nativeMessages.map((message) => message.id));
});

test("accepted live input shows its response after a compaction command", async () => {
  async function* events() {
    yield { type: "stdout" as const, data: JSON.stringify(assistant("Earlier reply")) };
    yield { type: "user_message" as const, message: userMessageFor(delivery.prompt, [], delivery.deliveryId) };
    yield { type: "stdout" as const, data: JSON.stringify(assistant("Correction response")) };
  }
  const messages = [];
  for await (const message of normalizeClaudeCodeStream(events(), { compact: true })) messages.push(message);
  expect(messages.map((message) => message.parts[0])).toEqual([
    { type: "text", text: delivery.prompt },
    { type: "text", text: "Correction response" },
  ]);
});

test("the initial replay is suppressed and pending input keeps stdin open across a result", async () => {
  const { session, emit, written, messages, stdinEnded } = await setup();
  expect(session.steer).toBeFunction();
  const initial = written()[0];
  emit(replay(initial.uuid, initial.message.content));
  const accepted = session.steer!(delivery);
  emit(result);
  await waitForStreamIo();
  expect(stdinEnded()).toBe(false);
  emit(replay(delivery.deliveryId));
  expect(await accepted).toEqual({ status: "accepted" });
  expect(stdinEnded()).toBe(false);
  emit(assistant("Correction processed"));
  emit(result);
  await waitForStreamIo();
  expect(stdinEnded()).toBe(true);
  expect(messages.filter((message) => message.role === "user")).toHaveLength(2);
});

test("input between background turns reaches the same process", async () => {
  const { session, emit, stdinEnded } = await setup();
  expect(session.steer).toBeFunction();
  emit(background(["task"]));
  emit(result);
  await waitForStreamIo();
  const accepted = session.steer!(delivery);
  emit(replay(delivery.deliveryId));
  expect(await accepted).toEqual({ status: "accepted" });
  emit(result);
  await waitForStreamIo();
  expect(stdinEnded()).toBe(false);
  emit(background([]));
  emit(result);
  await waitForStreamIo();
  expect(stdinEnded()).toBe(true);
});

test("finished and cancelled input never writes to the native pipe", async () => {
  const { session, emit, written } = await setup();
  expect(session.steer).toBeFunction();
  const controller = new AbortController();
  controller.abort(new Error("Request cancelled"));
  await expect(session.steer!({ ...delivery, signal: controller.signal })).rejects.toThrow("Request cancelled");
  expect(written()).toHaveLength(1);
  emit(result);
  await waitForStreamIo();
  expect(await session.steer!(delivery)).toMatchObject({ status: "rejected" });
  expect(written()).toHaveLength(1);
});

test("a lost acknowledgment settles as uncertain without a replay", async () => {
  const { session, child, written } = await setup();
  expect(session.steer).toBeFunction();
  const pending = session.steer!(delivery);
  child.exit();
  expect(await pending).toMatchObject({ status: "uncertain" });
  expect(written()).toHaveLength(2);
});

test("stopping closes live input before process exit", async () => {
  const { session, written } = await setup();
  await session.stop();
  expect(await session.steer!(delivery)).toMatchObject({ status: "rejected" });
  expect(written()).toHaveLength(1);
});

test("cancellation after a possible write stays uncertain and a late echo retains evidence", async () => {
  const { session, emit, messages, written } = await setup();
  expect(session.steer).toBeFunction();
  const controller = new AbortController();
  const pending = session.steer!({ ...delivery, signal: controller.signal });
  controller.abort();
  expect(await pending).toMatchObject({ status: "uncertain" });
  emit(replay(delivery.deliveryId));
  await waitForStreamIo();
  expect(messages.find((message) => message.id === delivery.deliveryId)?.parts[1]).toMatchObject({
    type: "file",
    fileId: "file",
  });
  expect(written()).toHaveLength(2);
});

test("live steering uses a real subprocess pipe without replacing the process", async () => {
  const { sink, messages } = recordingSink();
  const deps: SpawnDeps = {
    spawnProcess: () => {
      const child = spawn(process.execPath, [fileURLToPath(new URL("./steering.fixture.ts", import.meta.url))], {
        stdio: "pipe",
      });
      return {
        stdin: child.stdin,
        stdout: child.stdout,
        stderr: child.stderr,
        pid: child.pid,
        kill: () => child.kill(),
        onExit: new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal }))),
      };
    },
  };
  const session: HarnessSession = await startClaudeCodeSession({ prompt: "Initial", events: sink }, deps);
  cleanups.push(async () => {
    session.stop();
    await session.done;
  });
  expect(session.steer).toBeFunction();
  expect(await session.steer!(delivery)).toEqual({ status: "accepted" });
  expect(await session.done).toEqual({ status: "completed" });
  expect(messages.filter((message) => message.id === delivery.deliveryId)).toHaveLength(1);
  expect(session.agentSessionId).toBe("same-thread");
});
