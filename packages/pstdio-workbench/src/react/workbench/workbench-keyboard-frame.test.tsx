import { describe, expect, test } from "bun:test";
import { shouldFocusWorkbenchKeyboardFrame } from "./workbench-keyboard-frame";

const createTarget = (matchesInteractive: boolean) =>
  ({
    closest: () => (matchesInteractive ? {} : null),
  }) as unknown as EventTarget;

describe("WorkbenchKeyboardFrame", () => {
  test("focuses the keyboard frame only for non-interactive pointer targets", () => {
    const frame = {} as EventTarget;

    expect(shouldFocusWorkbenchKeyboardFrame(frame, frame)).toBe(true);
    expect(shouldFocusWorkbenchKeyboardFrame(createTarget(true), frame)).toBe(false);
    expect(shouldFocusWorkbenchKeyboardFrame(createTarget(false), frame)).toBe(true);
  });
});
