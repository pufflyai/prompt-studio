import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { HarnessEventSink, JsonPatch, SessionMessage } from "@pstdio/sdk/extensions";
import { createCodexStreamPipeline } from "./normalize-stream";

const recordingSink = () => {
  const patches: JsonPatch[] = [];
  const sink: HarnessEventSink = { push: (patch) => patches.push(patch) };
  return { patches, sink };
};

const fixtureLines = (name: string) =>
  readFileSync(new URL(`./mocks/${name}`, import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0);

const messageOf = (patch: JsonPatch) => patch.value as SessionMessage;

describe("createCodexStreamPipeline", () => {
  test("normalizes a real codex tool-call stream into message patches", () => {
    const { patches, sink } = recordingSink();
    const pipeline = createCodexStreamPipeline(sink, {
      initialMessages: [{ id: "user-1", role: "user", parts: [{ type: "text", text: "Create greeting.txt" }] }],
    });

    for (const line of fixtureLines("tool-events.jsonl")) {
      pipeline.handleLine(line);
    }

    // Initial user message is pushed first.
    expect(patches[0]).toMatchObject({ op: "add", path: "/messages/0" });
    expect(messageOf(patches[0]).role).toBe("user");

    // First agent_message item becomes assistant text.
    const firstAssistant = patches[1];
    expect(firstAssistant).toMatchObject({ op: "add", path: "/messages/1" });
    expect(messageOf(firstAssistant).parts[0]).toMatchObject({ type: "text" });
    expect(messageOf(firstAssistant).createdAt).toEqual(expect.any(Number));

    // command_execution: item.started adds a pending tool, item.completed replaces it in place.
    const toolAdd = patches[2];
    expect(toolAdd).toMatchObject({ op: "add", path: "/messages/2" });
    expect(messageOf(toolAdd).parts[0]).toMatchObject({
      type: "tool",
      tool: "shell",
      actionType: "execute",
      status: "pending",
    });

    const toolReplace = patches.find((patch) => patch.op === "replace" && patch.path === "/messages/2");
    expect(toolReplace).toBeDefined();
    expect(messageOf(toolReplace!).parts[0]).toMatchObject({
      type: "tool",
      status: "completed",
      state: { output: "hi\n" },
    });

    // turn.completed yields a token_usage system message.
    const usagePatch = patches[patches.length - 1];
    expect(messageOf(usagePatch).parts[0]).toMatchObject({
      type: "token_usage",
      inputTokens: 50907,
      outputTokens: 110,
      cacheReadTokens: 48896,
    });
    expect(messageOf(usagePatch).createdAt).toEqual(expect.any(Number));
  });

  test("offsets patch paths for resumed sessions", () => {
    const { patches, sink } = recordingSink();
    const pipeline = createCodexStreamPipeline(sink, {
      initialMessages: [{ id: "user-2", role: "user", parts: [{ type: "text", text: "Follow up" }] }],
      indexOffset: 7,
    });

    for (const line of fixtureLines("resume-events.jsonl")) {
      pipeline.handleLine(line);
    }

    expect(patches[0].path).toBe("/messages/7");
    expect(patches[1].path).toBe("/messages/8");
  });

  test("maps a failed turn to a single error message", () => {
    const { patches, sink } = recordingSink();
    const pipeline = createCodexStreamPipeline(sink, {});

    // Real codex failures emit an error event followed by turn.failed with the same message.
    pipeline.handleLine(JSON.stringify({ type: "thread.started", thread_id: "t-1" }));
    pipeline.handleLine(JSON.stringify({ type: "turn.started" }));
    pipeline.handleLine(JSON.stringify({ type: "error", message: "model not supported" }));
    pipeline.handleLine(JSON.stringify({ type: "turn.failed", error: { message: "model not supported" } }));

    expect(patches).toHaveLength(1);
    expect(messageOf(patches[0]).parts[0]).toMatchObject({
      type: "error",
      errorType: "other",
      message: "model not supported",
    });
  });

  test("normalizes reasoning and failed command items", () => {
    const { patches, sink } = recordingSink();
    const pipeline = createCodexStreamPipeline(sink, {});

    pipeline.handleLine(
      JSON.stringify({
        type: "item.completed",
        item: { id: "item_0", type: "reasoning", text: "**Thinking it over**" },
      }),
    );
    pipeline.handleLine(
      JSON.stringify({
        type: "item.completed",
        item: {
          id: "item_1",
          type: "command_execution",
          command: "false",
          aggregated_output: "",
          exit_code: 1,
          status: "failed",
        },
      }),
    );

    expect(messageOf(patches[0]).parts[0]).toMatchObject({ type: "reasoning", text: "**Thinking it over**" });
    expect(messageOf(patches[1]).parts[0]).toMatchObject({ type: "tool", status: "failed" });
  });
});
