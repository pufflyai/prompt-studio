import { describe, expect, test } from "bun:test";
import type { HarnessContext } from "@pstdio/sdk/extensions";
import { createClaudeCodeHarness } from "./harness";

const ctx: HarnessContext = {
  extensionId: "pstdio.harness-claude-code",
  name: "harness-claude-code",
  process: {
    run: async () => ({ exitCode: 0, stdout: "1.0.0", stderr: "" }),
    runOrThrow: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    spawnDetached: async () => ({}),
  },
  net: { findFreePort: async () => 0 },
  logger: { info: () => {}, warn: () => {}, error: () => {} },
};

const buildTranscript = (entries: unknown[]) => entries.map((entry) => JSON.stringify(entry)).join("\n");

describe("claude-code harness getMessages", () => {
  test("keeps the latest entry for duplicate UUIDs", async () => {
    const transcript = buildTranscript([
      {
        type: "user",
        uuid: "user-1",
        message: { role: "user", content: "hello" },
      },
      {
        type: "assistant",
        uuid: "assistant-1",
        message: { role: "assistant", content: [{ type: "text", text: "draft reply" }] },
      },
      {
        type: "assistant",
        uuid: "assistant-1",
        message: { role: "assistant", content: [{ type: "text", text: "final reply" }] },
      },
    ]);

    const harness = createClaudeCodeHarness({ readTranscript: async () => transcript });

    const messages = await harness.getMessages!(ctx, { agentSessionId: "session-1" });

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[1].role).toBe("assistant");
    expect((messages[1].parts[0] as { type: string; text: string }).text).toBe("final reply");
  });

  test("normalizes transcript tool_result entries without creating user tool messages", async () => {
    const transcript = buildTranscript([
      {
        type: "assistant",
        uuid: "assistant-tool-start",
        message: {
          role: "assistant",
          content: [{ type: "tool_use", id: "call-1", name: "Read", input: { file: "README.md" } }],
        },
      },
      {
        type: "user",
        uuid: "user-tool-result",
        message: {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "call-1", content: "file contents", is_error: false }],
        },
      },
      {
        type: "assistant",
        uuid: "assistant-text",
        message: { role: "assistant", content: [{ type: "text", text: "done" }] },
      },
    ]);

    const harness = createClaudeCodeHarness({ readTranscript: async () => transcript });

    const messages = await harness.getMessages!(ctx, { agentSessionId: "session-1" });

    const userToolMessages = messages.filter(
      (message) => message.role === "user" && message.parts.some((part) => part.type === "tool"),
    );
    expect(userToolMessages).toHaveLength(0);

    const toolMessage = messages.find((message) => message.parts.some((part) => part.type === "tool"));
    expect(toolMessage).toBeDefined();
    expect(toolMessage?.role).toBe("assistant");

    const toolPart = toolMessage?.parts[0] as { type: string; status?: string; callId?: string };

    expect(toolPart.type).toBe("tool");
    expect(toolPart.callId).toBe("call-1");
    expect(toolPart.status).toBe("completed");
  });
});

describe("claude-code harness detection", () => {
  test("declares discrete run params", () => {
    const harness = createClaudeCodeHarness();

    expect(harness.params).toMatchObject({
      thinking: {
        type: "select",
        defaultValue: "high",
        options: [
          { label: "Low", value: "low", icon: "Gauge" },
          { label: "Medium", value: "medium", icon: "Brain" },
          { label: "High", value: "high", icon: "Zap" },
          { label: "XHigh", value: "xhigh", icon: "Flame" },
          { label: "Max", value: "max", icon: "Sparkles" },
        ],
      },
    });
    expect(harness.params).not.toHaveProperty("permission-mode");
  });

  test("reports availability with the CLI version", async () => {
    const harness = createClaudeCodeHarness();
    expect(await harness.detect!(ctx)).toEqual({ available: true, version: "1.0.0" });
  });

  test("lists no models when the CLI is missing", async () => {
    const harness = createClaudeCodeHarness({ detect: async () => ({ available: false }) });
    expect(await harness.listModels!(ctx)).toEqual([]);
  });

  test("lists discovered models when the CLI is present and caches the catalog", async () => {
    let discoveries = 0;
    const harness = createClaudeCodeHarness({
      listModels: async () => {
        discoveries += 1;
        return [{ id: "sonnet-live" }];
      },
    });
    expect((await harness.listModels!(ctx)).map((model) => model.id)).toEqual(["sonnet-live"]);
    expect((await harness.listModels!(ctx)).map((model) => model.id)).toEqual(["sonnet-live"]);
    expect(discoveries).toBe(1);
  });
});
