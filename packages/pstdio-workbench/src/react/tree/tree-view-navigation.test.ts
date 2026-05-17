import { describe, expect, test } from "bun:test";
import { shouldSelectTreeNodeForNavigationTarget } from "./tree-view-navigation";

describe("shouldSelectTreeNodeForNavigationTarget", () => {
  test("does not select command-only navigation targets", () => {
    expect(
      shouldSelectTreeNodeForNavigationTarget({
        kind: "command",
        commandId: "workbench.openCommandPalette",
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
    expect(shouldSelectTreeNodeForNavigationTarget({ kind: "view", widgetId: "tickets" })).toBe(true);
  });
});
