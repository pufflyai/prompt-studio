import { describe, expect, test } from "bun:test";
import type { JsonPatch } from "@pstdio/sdk/extensions";
import { replayLongStream } from "./long-stream-replay";

const shape = { turns: 3, chunksPerTurn: 4, chunkDelayMs: 1 };

describe("long stream replay", () => {
  test("streams each assistant turn in growing chunks and ends it with a tool result", async () => {
    const patches: JsonPatch[] = [];
    await replayLongStream({
      agentSessionId: "fake-1",
      startIndex: 1,
      shape,
      signal: new AbortController().signal,
      push: (patch) => patches.push(patch),
    });

    expect(patches).toHaveLength(12);
    expect(patches.slice(0, 4).map((patch) => [patch.op, patch.path])).toEqual([
      ["add", "/messages/1"],
      ["replace", "/messages/1"],
      ["replace", "/messages/1"],
      ["replace", "/messages/1"],
    ]);
    const texts = patches.slice(0, 4).map((patch) => {
      const [part] = (patch.value as { parts: Array<{ text?: string }> }).parts;
      return part?.text?.length ?? 0;
    });
    expect(texts).toEqual([...texts].sort((left, right) => left - right));
    expect(new Set(patches.map((patch) => patch.path))).toEqual(new Set(["/messages/1", "/messages/2", "/messages/3"]));
    expect(patches.at(-1)?.value).toMatchObject({
      id: "fake-1-msg-3",
      index: 3,
      role: "assistant",
      parts: [{ type: "text" }, { type: "tool", tool: "bash", status: "completed" }],
    });
  });

  test("replays the same conversation every time", async () => {
    const run = async () => {
      const patches: JsonPatch[] = [];
      await replayLongStream({
        agentSessionId: "a",
        startIndex: 0,
        shape,
        signal: new AbortController().signal,
        push: (patch) => patches.push(patch),
      });
      return patches;
    };
    expect(await run()).toEqual(await run());
  });

  test("stops streaming when the session is stopped", async () => {
    const controller = new AbortController();
    const patches: JsonPatch[] = [];
    await replayLongStream({
      agentSessionId: "fake-1",
      startIndex: 1,
      shape,
      signal: controller.signal,
      push: (patch) => {
        patches.push(patch);
        if (patches.length === 2) controller.abort();
      },
    });

    expect(patches).toHaveLength(2);
  });
});
