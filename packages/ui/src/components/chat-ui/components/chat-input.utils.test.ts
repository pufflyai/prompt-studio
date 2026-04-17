import { describe, expect, it } from "bun:test";
import { resolveSendAction } from "./chat-input.utils";

describe("resolveSendAction", () => {
  it("blocks submit while streaming when interrupt is unavailable", () => {
    expect(
      resolveSendAction({
        isDisabled: false,
        canInterrupt: false,
        streaming: true,
        hasText: true,
      }),
    ).toBe("blocked");
  });

  it("interrupts when interrupt is available", () => {
    expect(
      resolveSendAction({
        isDisabled: false,
        canInterrupt: true,
        streaming: true,
        hasText: true,
      }),
    ).toBe("interrupt");
  });

  it("stays blocked when disabled even in interrupt mode", () => {
    expect(
      resolveSendAction({
        isDisabled: true,
        canInterrupt: true,
        streaming: true,
        hasText: true,
      }),
    ).toBe("blocked");
  });

  it("submits only when enabled, not streaming, and with text", () => {
    expect(
      resolveSendAction({
        isDisabled: false,
        canInterrupt: false,
        streaming: false,
        hasText: true,
      }),
    ).toBe("submit");
  });
});
