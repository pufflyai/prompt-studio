import { afterEach, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PassThrough, Writable } from "node:stream";
import type { JsonPatch, SessionMessage } from "@pstdio/sdk/extensions";
import type { RpcMessage } from "./app-server-rpc";
import { createCodexRuntime } from "./codex-runtime";
import { MINIMUM_VERSION } from "./detection";

// Real app-server traffic from the oldest supported and the latest Codex, made by scripts/record-cli-output.ts.
const recordedDir = join(import.meta.dir, "mocks/recorded");
const versions = [...new Set(readdirSync(recordedDir).map((name) => name.slice(0, name.indexOf("-"))))];
type Traffic = { direction: "sent" | "received"; message: RpcMessage };
const recorded = (version: string) =>
  readFileSync(join(recordedDir, `${version}-shell-turn.jsonl`), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Traffic);

// Answers each message the harness sends with what Codex sent back after that message in the recording.
const replayPeer = (traffic: Traffic[]) => {
  const stdout = new PassThrough();
  const exited = Promise.withResolvers<{ code: number | null; signal: string | null }>();
  const ids = new Map<string | number, string | number>();
  let next = 0;
  const emitReceived = () => {
    while (traffic[next]?.direction === "received") {
      const { message } = traffic[next++];
      const id = message.id !== undefined && ids.has(message.id) ? ids.get(message.id) : message.id;
      stdout.write(`${JSON.stringify({ ...message, id })}\n`);
    }
  };
  const stdin = new Writable({
    write(chunk, _encoding, done) {
      const sent = JSON.parse(String(chunk)) as RpcMessage;
      const expected = traffic[next++]?.message;
      if (expected?.method !== sent.method) {
        done(new Error(`Replay expected ${expected?.method ?? "nothing"} but the harness sent ${sent.method}.`));
        return;
      }
      if (expected.id !== undefined && sent.id !== undefined) ids.set(expected.id, sent.id);
      emitReceived();
      done();
    },
  });
  emitReceived();
  const kill = () => {
    stdout.end();
    exited.resolve({ code: null, signal: "SIGTERM" });
  };
  return { stdin, stdout, stderr: new PassThrough(), kill, pid: 1, onExit: exited.promise };
};

const shellCall = (messages: SessionMessage[]) =>
  messages.flatMap((message) => message.parts).find((part) => part.type === "tool" && part.tool === "shell");
const assistantText = (messages: SessionMessage[]) =>
  messages
    .filter((message) => message.role === "assistant")
    .flatMap((message) => message.parts)
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join(" ");
const ranCommand = {
  state: { input: { command: expect.stringContaining("sleep 2 && echo hi") }, output: expect.stringContaining("hi") },
};

const runtimes: ReturnType<typeof createCodexRuntime>[] = [];
afterEach(async () => {
  for (const runtime of runtimes.splice(0)) await runtime.dispose();
});

test("has recorded traffic from the minimum supported Codex version", () => {
  expect(versions).toContain(MINIMUM_VERSION);
});

describe.each(versions)("Codex %s", (version) => {
  test("runs a turn with a shell command and reads it back from history", async () => {
    const traffic = recorded(version);
    const runtime = createCodexRuntime({ spawnProcess: () => replayPeer(traffic) });
    runtimes.push(runtime);
    const messages: SessionMessage[] = [];
    const events = {
      getMessages: () => messages,
      push: (patch: JsonPatch) => {
        messages[Number(patch.path.split("/").at(-1))] = patch.value as SessionMessage;
      },
    };
    const input = { prompt: "Run a shell command", events, cwd: "/workspace", env: { PSTDIO_SESSION_ID: "record" } };
    const session = await runtime.run({ ...input, params: { model_reasoning_effort: "low" } });
    expect(await session.done).toEqual({ status: "completed" });
    expect(shellCall(messages)).toMatchObject(ranCommand);
    expect(assistantText(messages)).toMatch(/\bdone\b/i);

    const history = await runtime.readMessages({ agentSessionId: session.agentSessionId, ...input });
    expect(shellCall(history)).toMatchObject(ranCommand);
    expect(assistantText(history)).toMatch(/\bdone\b/i);
  });
});
