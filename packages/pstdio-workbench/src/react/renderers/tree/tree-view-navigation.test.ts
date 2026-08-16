import { describe, expect, test } from "bun:test";
import { getSwitchModeNavigationTargetModeId } from "../../../core";
import { shouldSelectTreeNodeForNavigationTarget } from "./tree-view-navigation";

describe("shouldSelectTreeNodeForNavigationTarget", () => {
  test("does not select command-only navigation targets", () => {
    expect(
      shouldSelectTreeNodeForNavigationTarget({
        kind: "command",
        commandId: "workbench.openCommandPalette",
      }),
    ).toBe(false);
    expect(
      shouldSelectTreeNodeForNavigationTarget({
        kind: "command",
        commandId: "workbench.action.switchMode",
        args: { modeId: "lab" },
      }),
    ).toBe(false);
  });

  test("selects navigation targets that open durable workbench content", () => {
    expect(
      shouldSelectTreeNodeForNavigationTarget({
        kind: "resource",
        resource: { kind: "ticket", uri: "pstdio://ticket/1" },
      }),
    ).toBe(true);
    expect(shouldSelectTreeNodeForNavigationTarget({ kind: "panel", panelId: "tickets" })).toBe(true);
  });
});

describe("getSwitchModeNavigationTargetModeId", () => {
  test("returns the concrete mode targeted by the built-in switch-mode command", () => {
    expect(
      getSwitchModeNavigationTargetModeId({
        kind: "command",
        commandId: "workbench.action.switchMode",
        args: { modeId: "lab" },
      }),
    ).toBe("lab");
  });

  test("rejects other commands and missing or empty mode ids", () => {
    expect(
      getSwitchModeNavigationTargetModeId({
        kind: "command",
        commandId: "extension-lab.open",
        args: { modeId: "lab" },
      }),
    ).toBeUndefined();
    expect(
      getSwitchModeNavigationTargetModeId({
        kind: "command",
        commandId: "workbench.action.switchMode",
      }),
    ).toBeUndefined();
    expect(
      getSwitchModeNavigationTargetModeId({
        kind: "command",
        commandId: "workbench.action.switchMode",
        args: { modeId: "" },
      }),
    ).toBeUndefined();
    expect(
      getSwitchModeNavigationTargetModeId({
        kind: "command",
        commandId: "workbench.action.switchMode",
        args: { modeId: "   " },
      }),
    ).toBeUndefined();
  });
});
