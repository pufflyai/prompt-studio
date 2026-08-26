import { describe, expect, test } from "bun:test";
import { createStatusBarRegistry } from "./status-bar-registry";

describe("createStatusBarRegistry", () => {
  test("returns every visible item grouped by slot and ordered deterministically", () => {
    const views = new Set(["acme.view.branch", "tools.view.sync", "tools.view.hidden"]);
    const registry = createStatusBarRegistry({ hasView: (viewId) => views.has(viewId) });

    registry.registerItem({
      id: "tools.status.sync",
      viewId: "tools.view.sync",
      slot: "leading",
      order: 200,
    });
    registry.registerItem({
      id: "acme.status.branch",
      viewId: "acme.view.branch",
      slot: "leading",
      order: 100,
    });
    registry.registerItem({
      id: "tools.status.hidden",
      viewId: "tools.view.hidden",
      slot: "trailing",
      isVisible: () => false,
    });

    expect(registry.listVisibleItems("leading").map((item) => item.id)).toEqual([
      "acme.status.branch",
      "tools.status.sync",
    ]);
    expect(registry.listVisibleItems("trailing")).toEqual([]);
  });

  test("rejects missing views and removes only the disposed owner's item", () => {
    const registry = createStatusBarRegistry({ hasView: (viewId) => viewId === "acme.view.branch" });

    expect(() => registry.registerItem({ id: "missing", viewId: "missing.view", slot: "leading" })).toThrow(
      "Status bar view is not registered: missing.view",
    );

    const branch = registry.registerItem({
      id: "acme.status.branch",
      viewId: "acme.view.branch",
      slot: "leading",
    });
    registry.registerItem({
      id: "tools.status.branch",
      viewId: "acme.view.branch",
      slot: "trailing",
    });

    branch.dispose();

    expect(registry.listItems().map((item) => item.id)).toEqual(["tools.status.branch"]);
  });
});
