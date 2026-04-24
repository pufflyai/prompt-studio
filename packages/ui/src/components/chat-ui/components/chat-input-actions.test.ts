import { describe, expect, it } from "bun:test";
import { resolveChatInputButtonAction, resolveChatInputKeyboardAction } from "./chat-input-actions";

describe("chat input actions", () => {
  it("keeps Enter as message submission only", () => {
    expect(
      resolveChatInputKeyboardAction({
        canInterrupt: true,
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
        isDisabled: false,
        streaming: true,
        text: "stop",
      }),
    ).toBe("interrupt");
  });

  it("submits non-empty messages when not streaming", () => {
    const input = {
      canInterrupt: false,
      isDisabled: false,
      streaming: false,
      text: "hello",
    };

    expect(resolveChatInputKeyboardAction(input)).toBe("submit");
    expect(resolveChatInputButtonAction(input)).toBe("submit");
  });
});
