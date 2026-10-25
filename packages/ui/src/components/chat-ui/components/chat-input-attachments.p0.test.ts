import { describe, expect, mock, test } from "bun:test";
import { createAttachmentEventHandlers, shouldAttachPastedText } from "./chat-input-attachments";

const lines = (count: number) => Array.from({ length: count }, (_, index) => `line ${index + 1}`).join("\n");

const pasteEvent = (text: string) => {
  const preventDefault = mock(() => undefined);
  return {
    clipboardData: {
      files: [],
      getData: (type: string) => (type === "text/plain" ? text : ""),
    },
    preventDefault,
  };
};

describe("chat input attachments", () => {
  test("attaches pasted text only when it is longer than 200 lines", () => {
    expect(shouldAttachPastedText(lines(200))).toBe(false);
    expect(shouldAttachPastedText(lines(201))).toBe(true);
  });

  test("prevents long pasted text from entering the editor", () => {
    const onAttachText = mock(() => undefined);
    const handlers = createAttachmentEventHandlers({
      onAttachText,
      textAttachmentPasteLineThreshold: 200,
    });
    const event = pasteEvent(lines(201));

    handlers.onPasteCapture(event as never);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(onAttachText).toHaveBeenCalledWith(lines(201));
  });
});
