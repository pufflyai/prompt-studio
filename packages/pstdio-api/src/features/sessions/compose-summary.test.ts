import { describe, expect, test } from "bun:test";
import type { SessionMessage } from "pstdio-api-contracts";
import { composeSummary } from "./compose-summary";

const msg = (role: SessionMessage["role"], text: string): SessionMessage => ({
  id: crypto.randomUUID(),
  role,
  parts: [{ type: "text", text }],
});

const conversation: SessionMessage[] = [
  msg("user", "implement the login page"),
  msg("assistant", "I will create a login component with email/password fields."),
  msg("user", "add validation"),
  msg("assistant", "Added email format validation and required field checks."),
];

describe("composeSummary", () => {
  test("brief format returns assistant messages only by default", () => {
    const result = composeSummary(conversation, { format: "brief", role: "assistant" });

    expect(result).toContain("I will create a login component");
    expect(result).toContain("Added email format validation");
    expect(result).not.toContain("implement the login page");
  });

  test("brief format with role=all includes user messages", () => {
    const result = composeSummary(conversation, { format: "brief", role: "all" });

    expect(result).toContain("implement the login page");
    expect(result).toContain("I will create a login component");
  });

  test("detailed format includes role labels", () => {
    const result = composeSummary(conversation, { format: "detailed", role: "all" });

    expect(result).toContain("[user]");
    expect(result).toContain("[assistant]");
    expect(result).toContain("implement the login page");
  });

  test("detailed format with role=assistant omits user messages", () => {
    const result = composeSummary(conversation, { format: "detailed", role: "assistant" });

    expect(result).toContain("[assistant]");
    expect(result).not.toContain("[user]");
  });

  test("skips non-text parts (tool, reasoning)", () => {
    const messages: SessionMessage[] = [
      {
        id: "1",
        role: "assistant",
        parts: [
          { type: "text", text: "Let me check." },
          { type: "tool", tool: "read", callId: "c1" },
          { type: "reasoning", text: "thinking..." },
        ],
      },
    ];

    const result = composeSummary(messages, { format: "brief", role: "assistant" });
    expect(result).toContain("Let me check.");
    expect(result).not.toContain("thinking...");
  });

  test("returns empty string for no matching messages", () => {
    const result = composeSummary([msg("user", "hello")], { format: "brief", role: "assistant" });
    expect(result).toBe("");
  });
});
