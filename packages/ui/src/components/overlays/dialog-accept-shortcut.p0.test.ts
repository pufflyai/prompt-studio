import { describe, expect, test } from "bun:test";
import { handleDialogAcceptShortcut } from "./dialog-accept-shortcut";

const createEvent = (overrides: Partial<Parameters<typeof handleDialogAcceptShortcut>[0]> = {}) => {
  let defaultPrevented = false;
  let propagationStopped = false;
  return {
    event: {
      key: "Enter",
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      defaultPrevented: false,
      preventDefault: () => {
        defaultPrevented = true;
      },
      stopPropagation: () => {
        propagationStopped = true;
      },
      ...overrides,
    },
    wasDefaultPrevented: () => defaultPrevented,
    wasPropagationStopped: () => propagationStopped,
  };
};

describe("handleDialogAcceptShortcut", () => {
  test("accepts the dialog on Ctrl+Enter", () => {
    const captured = createEvent();
    let accepted = false;

    handleDialogAcceptShortcut(captured.event, () => {
      accepted = true;
    });

    expect(accepted).toBe(true);
    expect(captured.wasDefaultPrevented()).toBe(true);
    expect(captured.wasPropagationStopped()).toBe(true);
  });

  test("ignores Enter without a mod key", () => {
    const captured = createEvent({ ctrlKey: false });
    let accepted = false;

    handleDialogAcceptShortcut(captured.event, () => {
      accepted = true;
    });

    expect(accepted).toBe(false);
    expect(captured.wasDefaultPrevented()).toBe(false);
    expect(captured.wasPropagationStopped()).toBe(false);
  });
});
