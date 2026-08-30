import { describe, expect, test } from "bun:test";
import { workbenchEmitResourceCommandId } from "../../../core";
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

  test("selects navigation targets that present content", () => {
    expect(
      shouldSelectTreeNodeForNavigationTarget({
        kind: "resource",
        resource: { kind: "ticket", uri: "pstdio://ticket/1" },
      }),
    ).toBe(true);
    expect(
      shouldSelectTreeNodeForNavigationTarget({
        kind: "page",
        pageId: "workspaces",
        resource: { kind: "workspace", uri: "pstdio://workspace/1" },
      }),
    ).toBe(true);
    expect(
      shouldSelectTreeNodeForNavigationTarget({
        kind: "command",
        commandId: workbenchEmitResourceCommandId,
        args: { resource: { kind: "ticket", uri: "pstdio://ticket/1" } },
      }),
    ).toBe(true);
    expect(
      shouldSelectTreeNodeForNavigationTarget({
        kind: "compound",
        targets: [
          { kind: "command", commandId: "workbench.action.switchMode", args: { modeId: "ops" } },
          { kind: "page", pageId: "services" },
        ],
      }),
    ).toBe(true);
  });
});
