import { expect, test } from "bun:test";
import type { JsonPatch, SessionMessage } from "@pstdio/sdk/extensions";
import { recoverCodexMessages } from "./history-reconciliation";
import { createCodexStreamPipeline } from "./normalize-stream";
import { normalizeRollout } from "./rollout";

test("paired live and rollout history keep native reasoning and the live tool call", async () => {
  const nativeMessages = normalizeRollout(await Bun.file(new URL("./mocks/rollout.jsonl", import.meta.url)).text());
  const knownMessages: SessionMessage[] = [nativeMessages[0]];
  const sink = {
    getMessages: () => knownMessages,
    push: (patch: JsonPatch) => {
      const index = Number(patch.path.split("/").at(-1));
      if (patch.op === "add") knownMessages.splice(index, 0, patch.value as SessionMessage);
      else knownMessages[index] = patch.value as SessionMessage;
    },
  };
  const pipeline = createCodexStreamPipeline(sink, { indexOffset: 1 });
  const live = await Bun.file(new URL("./mocks/tool-events.jsonl", import.meta.url)).text();
  live.split("\n").forEach(pipeline.handleLine);
  const result = recoverCodexMessages({ knownMessages, nativeMessages, cwd: "/tmp/codex-harness-e2e" });
  expect(result.kind).toBe("recovered");
  if (result.kind !== "recovered") return;
  const liveCall = knownMessages.find((message) => message.parts[0]?.type === "tool")!;
  const expected = nativeMessages.map((message) => (message.parts[0]?.type === "tool" ? liveCall : message));
  expect(result.messages).toEqual([...expected, knownMessages.at(-1)!]);
});

test("a crash after the first of two identical commands restores the second from the rollout", () => {
  const run = (id: string, callId: string, output?: string): SessionMessage => ({
    id,
    role: "assistant",
    parts: [
      { type: "tool", tool: "exec_command", callId, state: { input: { cmd: "git status", workdir: "/repo" }, output } },
    ],
  });
  const prompt: SessionMessage = { id: "prompt", role: "user", parts: [{ type: "text", text: "check twice" }] };
  const nativeMessages = [prompt, run("first", "call_1", "clean"), run("second", "call_2", "clean")];
  const knownMessages = [prompt, run("live-first", "item_1", "clean")];
  const result = recoverCodexMessages({ knownMessages, nativeMessages, cwd: "/repo" });
  expect(result).toEqual({ kind: "recovered", messages: [prompt, knownMessages[1], nativeMessages[2]] });
});

test("a code-mode rollout reconciles with the live stream of the same turn", async () => {
  const nativeMessages = normalizeRollout(
    await Bun.file(new URL("./mocks/code-mode-rollout.jsonl", import.meta.url)).text(),
  );
  const prompt: SessionMessage = { id: "prompt", role: "user", parts: [{ type: "text", text: "update the board" }] };
  const knownMessages: SessionMessage[] = [prompt];
  const sink = {
    getMessages: () => knownMessages,
    push: (patch: JsonPatch) => {
      const index = Number(patch.path.split("/").at(-1));
      if (patch.op === "add") knownMessages.splice(index, 0, patch.value as SessionMessage);
      else knownMessages[index] = patch.value as SessionMessage;
    },
  };
  const pipeline = createCodexStreamPipeline(sink, { indexOffset: 1 });
  const live = await Bun.file(new URL("./mocks/code-mode-events.jsonl", import.meta.url)).text();
  live.split("\n").forEach(pipeline.handleLine);
  const result = recoverCodexMessages({ knownMessages, nativeMessages, cwd: "/repo" });
  expect(result.kind).toBe("recovered");
  if (result.kind !== "recovered") return;
  const shape = (messages: SessionMessage[]) =>
    messages.map((message) => {
      const part = message.parts[0];
      return [message.role, part.type === "tool" ? part.tool : part.type === "text" ? part.text : part.type];
    });
  expect(shape(result.messages)).toEqual(shape(knownMessages));
});
