import { describe, expect, test } from "bun:test";
import { getWorkbenchModeLayoutTargetPanel, getWorkbenchTargetDefinition, workbenchTargets } from "./workbench-targets";

const forbiddenTargetSegments = new Set(["button", "icon", "item", "widget"]);

describe("workbench attachment targets", () => {
  test("keeps attachment targets host-owned and contribution-kind scoped", () => {
    expect(workbenchTargets.map((target) => target.id)).toEqual([
      "workbench.nav.actions",
      "workbench.nav.overflow",
      "workbench.left.tree",
      "workbench.main.left.tree",
      "workbench.main.right.tree",
      "workbench.main",
      "workbench.main.left",
      "workbench.main.right",
      "workbench.secondary",
      "workbench.settings",
    ]);

    expect(getWorkbenchTargetDefinition("workbench.nav.actions")?.allowedKinds).toEqual(["menu"]);
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

  test("maps mode targets to logical panels", () => {
    expect(getWorkbenchModeLayoutTargetPanel("workbench.left")).toBeUndefined();
    expect(getWorkbenchModeLayoutTargetPanel("workbench.main.left")).toBe("main");
    expect(getWorkbenchModeLayoutTargetPanel("workbench.main")).toBe("main");
    expect(getWorkbenchModeLayoutTargetPanel("workbench.main.right")).toBe("main");
    expect(getWorkbenchModeLayoutTargetPanel("workbench.secondary")).toBe("secondary");
  });
});
