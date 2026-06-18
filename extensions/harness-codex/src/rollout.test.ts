import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionMessage, ToolPart } from "@pstdio/sdk/extensions";
import { findRolloutPath, normalizeRollout } from "./rollout";

const fixture = readFileSync(new URL("./mocks/rollout.jsonl", import.meta.url), "utf8");

describe("normalizeRollout", () => {
  let messages: SessionMessage[];

  test("keeps only conversational response items", () => {
    messages = normalizeRollout(fixture);

    expect(messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "assistant",
      "assistant",
      "assistant",
    ]);
  });

  test("skips injected developer and environment context messages", () => {
    const texts = messages
      .flatMap((message) => message.parts)
      .filter((part) => part.type === "text")
      .map((part) => part.text);

    expect(texts.some((text) => text.includes("<environment_context>"))).toBe(false);
    expect(texts.some((text) => text.includes("<permissions instructions>"))).toBe(false);
    expect(texts[0]).toContain("Create a file named greeting.txt");
  });

  test("converts reasoning summaries to reasoning parts", () => {
    const reasoning = messages.find((message) => message.parts[0]?.type === "reasoning");
    expect(reasoning?.parts[0]).toMatchObject({ type: "reasoning", text: "**Planning the file write**" });
  });

  test("uses rollout timestamps for message timestamps", () => {
    expect(messages[0].createdAt).toBe(Date.parse("2026-06-11T19:32:41.033Z"));
    expect(messages.find((message) => message.parts[0]?.type === "reasoning")?.createdAt).toBe(
      Date.parse("2026-06-11T19:32:45.000Z"),
    );
  });

  test("merges function_call_output into the matching tool message", () => {
    const tool = messages.find((message) => message.parts[0]?.type === "tool");
    const part = tool?.parts[0] as ToolPart;

    expect(part).toMatchObject({ type: "tool", tool: "exec_command", actionType: "execute", status: "completed" });
    expect(part.callId).toBe("call_0hTiFWrTbMwwIy6CXSMUt47t");
    expect(part.state?.input).toMatchObject({ cmd: "printf 'hi\n' > greeting.txt && cat greeting.txt" });
    expect(String(part.state?.output)).toContain("hi");
  });
});

describe("findRolloutPath", () => {
  test("locates the rollout file for a thread id under nested date directories", () => {
    const root = mkdtempSync(join(tmpdir(), "codex-sessions-"));
    const dayDir = join(root, "2026", "06", "11");
    const path = join(dayDir, "rollout-2026-06-11T21-32-34-thread-xyz.jsonl");

    require("node:fs").mkdirSync(dayDir, { recursive: true });
    writeFileSync(path, "{}\n");

    expect(findRolloutPath("thread-xyz", root)).toBe(path);
    expect(findRolloutPath("missing-thread", root)).toBeNull();
  });
});
