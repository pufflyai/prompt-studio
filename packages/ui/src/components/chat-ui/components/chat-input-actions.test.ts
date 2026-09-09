import { describe, expect, it } from "bun:test";
import { resolveChatInputButtonAction, resolveChatInputKeyboardAction } from "./chat-input-actions";

describe("chat input actions", () => {
  it("keeps Enter as message submission only", () => {
    expect(
      resolveChatInputKeyboardAction({
        canInterrupt: true,
        hasQuestionPrompt: false,
        canSubmit: true,
        isDisabled: false,
        streaming: true,
        text: "stop",
      }),
    ).toBe("none");
  });

  it("lets the action button interrupt while streaming", () => {
    expect(
      resolveChatInputButtonAction({
        canInterrupt: true,
        hasQuestionPrompt: false,
        canSubmit: true,
        isDisabled: false,
        streaming: true,
        text: "stop",
      }),
    ).toBe("interrupt");
  });

  it("submits a question answer while the provider stream waits for the response", () => {
    const input = {
      canInterrupt: false,
      hasQuestionPrompt: true,
      canSubmit: true,
      isDisabled: false,
      streaming: true,
      text: "Which project?: Prompt Studio",
    };

    expect(resolveChatInputKeyboardAction(input)).toBe("submit");
    expect(resolveChatInputButtonAction(input)).toBe("submit");
  });

  it("submits non-empty messages when not streaming", () => {
    const input = {
      canInterrupt: false,
      hasQuestionPrompt: false,
      canSubmit: true,
      isDisabled: false,
      streaming: false,
      text: "hello",
    };

    expect(resolveChatInputKeyboardAction(input)).toBe("submit");
    expect(resolveChatInputButtonAction(input)).toBe("submit");
  });

  it("blocks submission but keeps interrupt when the runtime cannot accept a message", () => {
    const blocked = {
      canInterrupt: true,
      canSubmit: false,
      hasQuestionPrompt: false,
      isDisabled: false,
      streaming: false,
      text: "hello",
    };

    expect(resolveChatInputKeyboardAction(blocked)).toBe("none");
    expect(resolveChatInputButtonAction(blocked)).toBe("none");
    expect(resolveChatInputButtonAction({ ...blocked, streaming: true })).toBe("interrupt");
  });
});
