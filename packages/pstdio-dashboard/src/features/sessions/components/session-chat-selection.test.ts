import { describe, expect, test } from "bun:test";
import { resolveInitialSessionChatSelection } from "./session-chat-selection";

describe("resolveInitialSessionChatSelection", () => {
  test("loads agent and model from an existing session", () => {
    const selection = resolveInitialSessionChatSelection({
      sessionAgent: "opencode",
      sessionLastSelectedModel: "openai/gpt-5.5",
      lastSelectedAgent: "claude-code",
      lastSelectedModels: ["claude-code-fast"],
      configuredModel: "claude-code-default",
    });

    expect(selection).toEqual({ agent: "opencode", model: "openai/gpt-5.5" });
  });

  test("does not reuse browser history model for an existing session without a selected model", () => {
    const selection = resolveInitialSessionChatSelection({
      sessionAgent: "claude-code",
      sessionLastSelectedModel: null,
      lastSelectedAgent: "opencode",
      lastSelectedModels: ["opencode/big-pickle"],
      configuredModel: "opencode/gpt-5.5",
    });

    expect(selection).toEqual({ agent: "claude-code", model: "" });
  });

  test("uses the browser history model for a new session", () => {
    const selection = resolveInitialSessionChatSelection({
      sessionAgent: null,
      sessionLastSelectedModel: null,
      lastSelectedAgent: "opencode",
      lastSelectedModels: ["openai/gpt-5.3-codex"],
      configuredModel: "openai/gpt-5.5",
    });

    expect(selection).toEqual({ agent: "opencode", model: "openai/gpt-5.3-codex" });
  });
});
