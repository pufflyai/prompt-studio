import { afterEach, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { HarnessSession, HarnessSteeringInput, JsonPatch, SessionMessage } from "@pstdio/sdk/extensions";
import { createCodexRuntime } from "./codex-runtime";
import { recoverNativeHistory } from "./native-history";

const runtimes: ReturnType<typeof createCodexRuntime>[] = [];
afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
});
const start = async (mode?: string) => {
  const messages: SessionMessage[] = [];
  const runtime = createCodexRuntime({
    spawnProcess: (_args, options) => {
      const child = spawn(process.execPath, [fileURLToPath(new URL("./steering.fixture.ts", import.meta.url))], {
        stdio: "pipe",
        env: { ...process.env, ...options?.env },
      });
      return {
        stdin: child.stdin!,
        stdout: child.stdout!,
        stderr: child.stderr!,
        kill: () => {
          child.kill();
        },
        onExit: new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal }))),
      };
    },
  });
  runtimes.push(runtime);
  const events = {
    getMessages: () => messages,
    push: (patch: JsonPatch) => {
      messages[Number(patch.path.split("/").at(-1))] = patch.value as SessionMessage;
    },
  };
  const env = mode ? { PSTDIO_TEST_MODE: mode } : undefined;
  const session: HarnessSession = await runtime.run({ prompt: "Original work", events, env });
  return { session, messages, read: () => runtime.readMessages({ agentSessionId: session.agentSessionId!, env }) };
};
const delivery: HarnessSteeringInput = {
  deliveryId: "delivery",
  prompt: "Åsa: focus on the café tests",
  attachments: [
    {
      fileId: "notes",
      fileName: "notes.txt",
      mimeType: "text/plain",
      sizeBytes: 12,
      localPath: "/tmp/notes.txt",
      url: "/files/notes",
    },
  ],
};

for (const mode of ["echo-first", "ack-first", "no-initial-echo"]) {
  test(`steers the active turn once with attachments and a recoverable identity (${mode})`, async () => {
    const { session, messages, read } = await start(mode);
    expect(session.steer).toBeFunction();
    expect(await session.steer!(delivery)).toEqual({ status: "accepted" });
    const history = await read();
    expect(messages.filter((message) => message.role === "user")).toHaveLength(2);
    const steered = messages.filter((message) => message.id === delivery.deliveryId);
    expect(steered).toHaveLength(1);
    expect(steered[0].parts).toEqual([
      { type: "text", text: delivery.prompt },
      { type: "file", fileId: "notes", filename: "notes.txt", mediaType: "text/plain", size: 12, url: "/files/notes" },
    ]);
    const request = messages
      .flatMap((message) => message.parts)
      .find((part) => part.type === "text" && part.text?.includes('"turn/steer"'));
    expect(request?.type === "text" && JSON.parse(request.text!)).toMatchObject({
      method: "turn/steer",
      params: {
        threadId: "thread",
        expectedTurnId: "turn",
        clientUserMessageId: delivery.deliveryId,
        input: [{ type: "text", text: expect.stringContaining('path="/tmp/notes.txt"') }],
      },
    });
    expect(history.filter((message) => message.id === delivery.deliveryId)).toHaveLength(1);
    const recovered = recoverNativeHistory({ knownMessages: messages, nativeMessages: history });
    expect(recovered.messages.filter((message) => message.role === "user")).toHaveLength(2);
    expect(recovered.messages.find((message) => message.id === delivery.deliveryId)?.parts).toEqual(steered[0].parts);
    await session.stop();
    expect(await session.done).toEqual({ status: "cancelled" });
  });
}

test("a native rejection leaves the correction unsent and the original turn running", async () => {
  const { session, messages } = await start("reject");
  expect(session.steer).toBeFunction();
  expect(await session.steer!(delivery)).toEqual({ status: "rejected", reason: "Turn is no longer active" });
  expect(messages.some((message) => message.id === delivery.deliveryId)).toBe(false);
  await session.stop();
  expect(await session.done).toEqual({ status: "cancelled" });
});

test("lost steering acknowledgement is uncertain and retains native delivery evidence", async () => {
  const { session, messages } = await start("lost-ack");
  expect(session.steer).toBeFunction();
  const error = await session.steer!(delivery).catch((error: unknown) => error);
  expect(error).toMatchObject({ message: expect.stringContaining("connection closed") });
  expect(await session.done).toEqual({ status: "disconnected" });
  expect(messages.filter((message) => message.id === delivery.deliveryId)).toHaveLength(1);
  expect(messages.find((message) => message.id === delivery.deliveryId)?.parts).toContainEqual({
    type: "file",
    fileId: "notes",
    filename: "notes.txt",
    mediaType: "text/plain",
    size: 12,
    url: "/files/notes",
  });
});

test("finished or cancelled steering cannot submit another native mutation", async () => {
  const { session, messages } = await start();
  expect(session.steer).toBeFunction();
  const controller = new AbortController();
  controller.abort(new Error("Request cancelled"));
  await expect(session.steer!({ ...delivery, signal: controller.signal })).rejects.toThrow("Request cancelled");
  await session.stop();
  await session.done;
  expect(await session.steer!(delivery)).toMatchObject({ status: "rejected" });
  expect(messages.some((message) => message.id === delivery.deliveryId)).toBe(false);
});
