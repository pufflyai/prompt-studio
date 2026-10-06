import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionMessage, ToolPart } from "@pstdio/sdk/extensions";
import { codexSessionsRoot, findRolloutPath, normalizeRollout } from "./rollout";

const fixture = readFileSync(new URL("./mocks/rollout.jsonl", import.meta.url), "utf8");

test("finds native user sessions when HOME is absent", () => {
  const originalHome = process.env.HOME;
  const originalCodexHome = process.env.CODEX_HOME;
  delete process.env.HOME;
  delete process.env.CODEX_HOME;
  try {
    expect(codexSessionsRoot()).toBe(join(homedir(), ".codex", "sessions"));
    const configuredHome = join(tmpdir(), "custom-codex-home");
    process.env.CODEX_HOME = configuredHome;
    expect(codexSessionsRoot()).toBe(join(configuredHome, "sessions"));
  } finally {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = originalCodexHome;
  }
});

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

describe("normalizeRollout in code mode", () => {
  const codeMode = readFileSync(new URL("./mocks/code-mode-rollout.jsonl", import.meta.url), "utf8");

  test("reads a code-mode turn from its completed items", () => {
    const messages = normalizeRollout(codeMode);
    expect(messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "assistant",
      "assistant",
      "assistant",
      "assistant",
      "assistant",
      "assistant",
    ]);
    const tools = messages.flatMap((message) => message.parts.filter((part): part is ToolPart => part.type === "tool"));
    expect(tools.map((part) => [part.tool, part.status, part.state?.input])).toEqual([
      ["shell", "completed", { command: ["/bin/zsh", "-lc", "pst tickets --help"] }],
      ["shell", "failed", { command: ["/bin/zsh", "-lc", "printenv | rg 'PSTDIO|PST_'"] }],
      ["shell", "completed", { command: ["/bin/zsh", "-lc", `bun -e 'console.log("ok")'`] }],
      ["apply_patch", "completed", { changes: [{ path: "/repo/notes.md", kind: "update" }] }],
    ]);
    expect(messages[0].parts).toEqual([{ type: "text", text: "update the board" }]);
  });

  test("keeps turns recorded before code mode in the same thread", () => {
    const messages = normalizeRollout(`${fixture}\n${codeMode}`);
    expect(messages.slice(0, normalizeRollout(fixture).length)).toEqual(normalizeRollout(fixture));
    expect(messages.slice(normalizeRollout(fixture).length)).toEqual(normalizeRollout(codeMode));
  });
});

describe("findRolloutPath", () => {
  const writeRollout = (root: string, threadId: string) => {
    const dayDir = join(root, "2026", "06", "11");
    mkdirSync(dayDir, { recursive: true });
    const path = join(dayDir, `rollout-2026-06-11T21-32-34-${threadId}.jsonl`);
    writeFileSync(path, "{}\n");
    return path;
  };

  test("locates the rollout file for a thread id under nested date directories", async () => {
    const root = mkdtempSync(join(tmpdir(), "codex-sessions-"));
    const path = writeRollout(root, "thread-xyz");

    const lookup = findRolloutPath("thread-xyz", root);

    expect(lookup).toBeInstanceOf(Promise);
    expect(await lookup).toBe(path);
    expect(await findRolloutPath("missing-thread", root)).toBeNull();
  });

  // Harness code runs in the API process, so a full scan of ~/.codex/sessions on every history
  // load would stall it. A thread keeps its rollout file, so only the first lookup scans.
  test("scans for a thread once and finds a rollout written after a miss", async () => {
    const root = mkdtempSync(join(tmpdir(), "codex-sessions-"));
    expect(await findRolloutPath("thread-late", root)).toBeNull();
    const path = writeRollout(root, "thread-late");
    expect(await findRolloutPath("thread-late", root)).toBe(path);

    rmSync(join(root, "2026"), { recursive: true });

    expect(await findRolloutPath("thread-late", root)).toBe(path);
  });
});
