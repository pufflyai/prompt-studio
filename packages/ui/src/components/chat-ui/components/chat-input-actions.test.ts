import { describe, expect, it } from "bun:test";
import { resolveChatInputButtonAction, resolveChatInputKeyboardAction } from "./chat-input-actions";

describe("chat input actions", () => {
  it("keeps Enter as message submission only", () => {
    expect(
      resolveChatInputKeyboardAction({
        canInterrupt: true,
        isDisabled: false,
        streaming: true,
        hasText: true,
      }),
    ).toBe("none");
  });

  it("lets the action button interrupt while streaming", () => {
    expect(
      resolveChatInputButtonAction({
        canInterrupt: true,
        isDisabled: false,
        streaming: true,
        hasText: true,
      }),
    ).toBe("interrupt");
  });

  it("submits non-empty messages when not streaming", () => {
    const input = {
      canInterrupt: false,
      isDisabled: false,
      streaming: false,
      hasText: true,
    };

    expect(resolveChatInputKeyboardAction(input)).toBe("submit");
    expect(resolveChatInputButtonAction(input)).toBe("submit");
  });

  it("blocks submission when there is no text", () => {
    const input = {
      canInterrupt: false,
      isDisabled: false,
      streaming: false,
      hasText: false,
    };

    expect(resolveChatInputKeyboardAction(input)).toBe("none");
    expect(resolveChatInputButtonAction(input)).toBe("none");
  });
});
