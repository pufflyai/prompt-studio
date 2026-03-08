import { describe, expect, test } from "bun:test";
import { PassThrough, Writable } from "node:stream";
import { createEventStore } from "../../services/event-store";
import type { JsonPatch } from "../../types";
import { buildSpawnArgs, type SpawnDeps, spawnClaudeCodeMessage, spawnClaudeCodeSession } from "./claude-code-spawn";

const collect = async (iterable: AsyncIterable<JsonPatch>, limit: number, timeoutMs = 2000) => {
  const items: JsonPatch[] = [];
  const deadline = Date.now() + timeoutMs;

  for await (const item of iterable) {
    items.push(item);
    if (items.length >= limit) break;
    if (Date.now() > deadline) break;
  }

  return items;
};

const createMockSpawnDeps = (stdoutLines: string[], options?: { delayMs?: number }): SpawnDeps => {
  const stdout = new PassThrough();
  const stdin = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });

  const onExit = new Promise<{ code: number | null; signal: string | null }>((resolve) => {
    const writeLines = async () => {
      const delay = options?.delayMs ?? 5;

      for (const line of stdoutLines) {
        await new Promise((r) => setTimeout(r, delay));
        stdout.write(`${line}\n`);
      }

      await new Promise((r) => setTimeout(r, delay));
      stdout.end();
      resolve({ code: 0, signal: null });
    };

    writeLines();
  });

  return {
    spawnProcess: () => ({
      stdin,
      stdout,
      stderr: new PassThrough(),
      kill: () => {},
      onExit,
    }),
  };
};

describe("buildSpawnArgs", () => {
  test("does not enable replay-user-messages or include-partial-messages", () => {
    const args = buildSpawnArgs({
      sessionId: "session-abc",
      prompt: "Follow up",
    });

    expect(args[0]).toBe("--resume");
    expect(args[1]).toBe("session-abc");
    expect(args).not.toContain("--replay-user-messages");
    expect(args).not.toContain("--include-partial-messages");
  });
});

describe("spawnClaudeCodeSession", () => {
  test("extracts session id and streams events to event store", async () => {
    const lines = [
      JSON.stringify({ type: "system", session_id: "session-abc" }),
      JSON.stringify({
        type: "content_block_delta",
        delta: { type: "text_delta", text: "Hello " },
      }),
      JSON.stringify({
        type: "content_block_delta",
        delta: { type: "text_delta", text: "world" },
      }),
      JSON.stringify({ type: "result", usage: { input_tokens: 10, output_tokens: 5 } }),
    ];

    const deps = createMockSpawnDeps(lines);
    const eventStore = createEventStore();

    const result = await spawnClaudeCodeSession({ prompt: "Hello", eventStore }, deps);

    expect(result.sessionId).toBe("session-abc");
    expect(result.process).toBeDefined();

    await result.process!.onExit;

    const history = eventStore.getHistory();
    expect(history.length).toBeGreaterThanOrEqual(2);

    // First event should be the user message
    const userPatch = history[0];
    expect(userPatch.op).toBe("add");
    expect(userPatch.path).toBe("/messages/0");
    expect((userPatch.value as { role: string }).role).toBe("user");
  });
});

describe("spawnClaudeCodeMessage (resume)", () => {
  test("pushes user message and streams assistant events to event store", async () => {
    const lines = [
      JSON.stringify({ type: "system", session_id: "session-abc" }),
      JSON.stringify({
        type: "content_block_delta",
        delta: { type: "text_delta", text: "Resumed reply" },
      }),
      JSON.stringify({ type: "result", usage: { input_tokens: 20, output_tokens: 10 } }),
    ];

    const deps = createMockSpawnDeps(lines);
    const eventStore = createEventStore();

    const process = await spawnClaudeCodeMessage(
      { sessionId: "session-abc", prompt: "Follow up", messageOffset: 5 },
      eventStore,
      undefined,
      deps,
    );

    await process.onExit;

    const history = eventStore.getHistory();

    // First patch: user message at offset 5
    const userPatch = history[0];
    expect(userPatch.op).toBe("add");
    expect(userPatch.path).toBe("/messages/5");
    expect((userPatch.value as { role: string }).role).toBe("user");

    // Second patch: assistant text at offset 6
    const textPatch = history[1];
    expect(textPatch.op).toBe("add");
    expect(textPatch.path).toBe("/messages/6");
    expect((textPatch.value as { parts: Array<{ type: string; text: string }> }).parts[0].type).toBe("text");
    expect((textPatch.value as { parts: Array<{ type: string; text: string }> }).parts[0].text).toBe("Resumed reply");

    // Third patch: token usage at offset 7
    const usagePatch = history[2];
    expect(usagePatch.op).toBe("add");
    expect(usagePatch.path).toBe("/messages/7");
    expect((usagePatch.value as { parts: Array<{ type: string }> }).parts[0].type).toBe("token_usage");
  });

  test("streams events in real-time via historyPlusStream", async () => {
    const lines = [
      JSON.stringify({
        type: "content_block_delta",
        delta: { type: "text_delta", text: "First " },
      }),
      JSON.stringify({
        type: "content_block_delta",
        delta: { type: "text_delta", text: "second" },
      }),
    ];

    const deps = createMockSpawnDeps(lines, { delayMs: 30 });
    const eventStore = createEventStore();

    const process = await spawnClaudeCodeMessage(
      { sessionId: "session-abc", prompt: "Hello", messageOffset: 0 },
      eventStore,
      undefined,
      deps,
    );

    // Collect events via historyPlusStream (simulating WebSocket consumer)
    const items = await collect(eventStore.historyPlusStream(), 3, 3000);

    await process.onExit;

    // Should have received: user message + accumulated text
    expect(items.length).toBeGreaterThanOrEqual(1);

    // First item should be the user message
    expect(items[0].path).toBe("/messages/0");
    expect((items[0].value as { role: string }).role).toBe("user");
  });

  test("handles thinking/reasoning events during resume", async () => {
    const lines = [
      JSON.stringify({
        type: "content_block_start",
        content_block: { type: "thinking", thinking: "" },
      }),
      JSON.stringify({
        type: "content_block_delta",
        delta: { type: "thinking_delta", thinking: "Let me think..." },
      }),
      JSON.stringify({
        type: "content_block_delta",
        delta: { type: "text_delta", text: "Here's my answer" },
      }),
    ];

    const deps = createMockSpawnDeps(lines);
    const eventStore = createEventStore();

    const process = await spawnClaudeCodeMessage(
      { sessionId: "session-abc", prompt: "Think about this", messageOffset: 0 },
      eventStore,
      undefined,
      deps,
    );

    await process.onExit;

    const history = eventStore.getHistory();

    // Should have: user message + reasoning + reasoning delta (accumulated) + text
    expect(history.length).toBeGreaterThanOrEqual(3);

    // Find reasoning and text patches
    const messageParts = history
      .filter((p) => p.path.startsWith("/messages/"))
      .map((p) => p.value as { parts: Array<{ type: string }> });

    const types = messageParts.map((m) => m.parts[0]?.type);
    expect(types).toContain("reasoning");
    expect(types).toContain("text");
  });

  test("handles tool_use and tool_result events during resume", async () => {
    const lines = [
      JSON.stringify({
        type: "content_block_start",
        content_block: { type: "tool_use", id: "call-1", name: "Read" },
      }),
      JSON.stringify({
        type: "content_block_start",
        content_block: { type: "tool_result", tool_use_id: "call-1", content: "file contents", is_error: false },
      }),
    ];

    const deps = createMockSpawnDeps(lines);
    const eventStore = createEventStore();

    const process = await spawnClaudeCodeMessage(
      { sessionId: "session-abc", prompt: "Read file", messageOffset: 0 },
      eventStore,
      undefined,
      deps,
    );

    await process.onExit;

    const history = eventStore.getHistory();

    // Find tool patches
    const toolPatches = history
      .filter((p) => p.path.startsWith("/messages/"))
      .filter((p) => {
        const msg = p.value as { parts: Array<{ type: string }> };
        return msg.parts[0]?.type === "tool";
      });

    // Should have tool_use (pending) replaced by tool_result (completed)
    expect(toolPatches.length).toBeGreaterThanOrEqual(1);
  });
});
