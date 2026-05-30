import { describe, expect, test } from "bun:test";
import { getWorkbenchTargetDefinition, workbenchTargets } from "./workbench-targets";

const forbiddenTargetSegments = new Set(["button", "icon", "item", "widget"]);

describe("workbench attachment targets", () => {
  test("keeps attachment targets host-owned and contribution-kind scoped", () => {
    expect(workbenchTargets.map((target) => target.id)).toEqual([
      "workbench.top.actions",
      "workbench.top.overflow",
      "workbench.commandPalette",
      "workbench.left.tree",
      "workbench.main.left.tree",
      "workbench.main.right.tree",
      "workbench.main",
      "workbench.main.left",
      "workbench.main.right",
      "workbench.main.bottom",
      "workbench.settings",
    ]);

    expect(getWorkbenchTargetDefinition("workbench.top.actions")?.allowedKinds).toEqual(["menu"]);
    expect(getWorkbenchTargetDefinition("workbench.left.tree")?.allowedKinds).toEqual(["treeItem"]);
    expect(getWorkbenchTargetDefinition("workbench.settings")?.allowedKinds).toEqual(["settings"]);
    expect(getWorkbenchTargetDefinition("workbench.left")).toBeUndefined();
  });

  test("rejects slot-like over-specific target names", () => {
    for (const target of workbenchTargets) {
      const segments = target.id.split(".");
      expect(segments.length).toBeLessThanOrEqual(4);
      expect(segments.some((segment) => forbiddenTargetSegments.has(segment))).toBe(false);
    }
  });
});
