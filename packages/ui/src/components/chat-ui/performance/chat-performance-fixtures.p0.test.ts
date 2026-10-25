import { describe, expect, test } from "bun:test";
import {
  buildChatSessionSwitchFixture,
  buildLargeChatConversation,
  seedStreamingMessage,
  updateStreamingTextPart,
} from "./chat-performance-fixtures";

describe("chat performance fixtures", () => {
  test("builds deterministic large conversations with user, assistant, and tool content", () => {
    const messages = buildLargeChatConversation({
      sessionId: "perf-a",
      turns: 3,
      textRepeat: 2,
      toolCallsPerTurn: 2,
    });

    expect(messages).toHaveLength(6);
    expect(messages.map((message) => message.id)).toEqual([
      "perf-a-user-0",
      "perf-a-assistant-0",
      "perf-a-user-1",
      "perf-a-assistant-1",
      "perf-a-user-2",
      "perf-a-assistant-2",
    ]);
    expect(messages[1]?.parts.filter((part) => part.type === "tool")).toHaveLength(2);
  });

  test("includes markdown-heavy text and varied tool invocations", () => {
    const messages = buildLargeChatConversation({
      sessionId: "perf-markdown",
      turns: 5,
      textRepeat: 1,
      toolCallsPerTurn: 4,
    });
    const text = messages
      .flatMap((message) => message.parts)
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("\n");
    const toolNames = new Set(
      messages
        .flatMap((message) => message.parts)
        .filter((part): part is { type: "tool"; tool: string } => part.type === "tool")
        .map((part) => part.tool),
    );

    expect(text).toContain("```ts");
    expect(text).toContain("[session hydration notes]");
    expect(text).toContain("| Surface | Load | Risk |");
    expect(text).toContain("- [ ] Capture browser long tasks");
    expect(toolNames).toEqual(new Set(["read", "grep", "bash", "todo_write", "edit", "apply_patch", "glob", "skill"]));
  });

  test("builds two distinct session switch fixtures", () => {
    const fixture = buildChatSessionSwitchFixture();

    expect(fixture.primarySession.id).not.toBe(fixture.secondarySession.id);
    expect(fixture.primarySession.messages).toHaveLength(1000);
    expect(fixture.secondarySession.messages).toHaveLength(1000);
  });

  test("seeds and updates a streamed text part without replacing unrelated messages", () => {
    const messages = buildLargeChatConversation({ sessionId: "stream", turns: 1 });
    const assistant = messages[1]!;
    const seeded = seedStreamingMessage(assistant);
    const textPartIndex = seeded.parts.findIndex((part) => part.type === "text");
    const next = updateStreamingTextPart([messages[0]!, seeded], seeded.id, textPartIndex, "partial");

    expect(next[0]).toBe(messages[0]);
    expect(next[1]).not.toBe(seeded);
    expect(next[1]?.parts[textPartIndex]).toEqual({ type: "text", text: "partial" });
  });
});
