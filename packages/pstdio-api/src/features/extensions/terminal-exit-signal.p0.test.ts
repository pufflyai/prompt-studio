import { expect, test } from "bun:test";
import { constants } from "node:os";
import { terminalExitSignal } from "./terminal-exit-signal";

test("keeps terminal exit signals in the public string form", () => {
  expect(terminalExitSignal("SIGTERM")).toBe("SIGTERM");
  expect(terminalExitSignal(constants.signals.SIGKILL)).toBe("SIGKILL");
  expect(terminalExitSignal(null)).toBeNull();
});

test("preserves an unknown platform signal as text", () => {
  expect(terminalExitSignal(999)).toBe("999");
});
