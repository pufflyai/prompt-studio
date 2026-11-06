import { expect, test } from "bun:test";
import { toolResultBytes } from "@pstdio/sdk/extensions";
import { normalizeOpencodeMessage } from "./opencode-normalizer";
import { readSessionSnapshot } from "./opencode-session-poller";
import { recordingSink } from "./opencode-session-poller.test-helpers";
import type { OpencodeSessionMessage } from "./opencode-types";

test("OpenCode retains bounded native polling state and published results for a 76 MB failed tool", async () => {
  const output = `HEAD${"x".repeat(76_000_000)}TAIL`;
  const { sink } = recordingSink();
  const snapshot = await readSessionSnapshot({
    loadMessages: async () => [
      {
        info: { id: "message", role: "assistant" },
        parts: [
          {
            type: "tool",
            tool: "bash",
            callID: "call",
            state: { status: "error", output, errorText: output, metadata: { copy: output } },
          },
        ],
      },
    ],
    sessionId: "session",
    cwd: undefined,
    events: sink,
    lastObserved: [],
    lastSnapshot: "",
  });
  const part = sink.getMessages()[0]?.parts[0];
  if (part?.type !== "tool") throw new Error("Expected tool");
  expect(toolResultBytes(part)).toBeLessThanOrEqual(262144);
  const retained = normalizeOpencodeMessage(snapshot.lastObserved[0], 0).parts[0];
  if (retained.type !== "tool") throw new Error("Expected retained tool");
  expect(toolResultBytes(retained)).toBeLessThanOrEqual(262144);
  expect(part.state?.output).toContain("HEAD");
  expect(part.state?.output).toContain("TAIL");
});

test("a long OpenCode session publishes only changed messages and preserves native deletion", async () => {
  const raw: OpencodeSessionMessage[] = Array.from({ length: 500 }, (_, index) => ({
    info: { id: `id-${index}`, role: "assistant" },
    parts: [{ type: "text", text: `message ${index}` }],
  }));
  const { sink, patches } = recordingSink();
  const first = await readSessionSnapshot({
    loadMessages: async () => raw,
    sessionId: "session",
    cwd: undefined,
    events: sink,
    lastObserved: [],
    lastSnapshot: "",
  });
  patches.length = 0;
  const next = [...raw];
  next[1] = { info: { id: "id-1", role: "assistant" }, parts: [{ type: "text", text: "updated earlier" }] };
  await readSessionSnapshot({
    loadMessages: async () => next,
    sessionId: "session",
    cwd: undefined,
    events: sink,
    ...first,
  });
  expect(patches).toHaveLength(1);
  expect(patches[0].path).toBe("/messages/1");
  expect(JSON.stringify(patches).length).toBeLessThan(500);
  patches.length = 0;
  await readSessionSnapshot({
    loadMessages: async () => next.slice(0, -1),
    sessionId: "session",
    cwd: undefined,
    events: sink,
    lastObserved: next,
    lastSnapshot: "",
  });
  expect(patches.at(-1)).toEqual({ op: "remove", path: "/messages/499" });
  expect(sink.getMessages()).toHaveLength(499);
});

test("OpenCode native ToolStateError.error is retained within the allowance and visible in chat", async () => {
  const { sink } = recordingSink();
  const snapshot = await readSessionSnapshot({
    loadMessages: async () => [
      {
        info: { id: "message", role: "assistant" },
        parts: [
          {
            type: "tool",
            tool: "bash",
            callID: "call",
            state: { status: "error", error: `HEAD${"x".repeat(1000000)}TAIL` },
          },
        ],
      },
    ],
    sessionId: "session",
    cwd: undefined,
    events: sink,
    lastObserved: [],
    lastSnapshot: "",
  });
  expect(Buffer.byteLength(JSON.stringify(snapshot.lastObserved))).toBeLessThan(263000);
  const part = sink.getMessages()[0].parts[0];
  if (part.type !== "tool") throw new Error("Expected tool");
  expect(part.status).toBe("failed");
  expect(part.state?.output).toContain("HEAD");
  expect(part.state?.output).toContain("TAIL");
});
