import { describe, expect, test } from "bun:test";
import { createStatusBarRegistry } from "./status-bar-registry";

describe("createStatusBarRegistry", () => {
  test("reorders within a slot and retains the chosen order when an item is registered again", () => {
    const registry = createStatusBarRegistry({ hasView: () => true });
    const connection = registry.registerItem({ id: "connection", viewId: "connection", slot: "trailing" });
    registry.registerItem({ id: "performance", viewId: "performance", slot: "trailing" });
    registry.registerItem({ id: "branch", viewId: "branch", slot: "leading" });
    registry.reorderItem("performance", { beforeItemId: "connection" });
    expect(registry.listVisibleItems("trailing").map((item) => item.id)).toEqual(["performance", "connection"]);
    connection.dispose();
    registry.registerItem({ id: "connection", viewId: "connection", slot: "trailing" });
    expect(registry.listVisibleItems("trailing").map((item) => item.id)).toEqual(["performance", "connection"]);
    registry.reorderItem("connection", { beforeItemId: "branch" });
    expect(registry.listItems().map((item) => item.id)).toEqual(["branch", "performance", "connection"]);
  });

  test("restores the order independently of registration order and includes hidden items", () => {
    let saved: string[] | undefined;
    const persistence = {
      getOrder: () => saved,
      setOrder: (ids: string[]) => {
        saved = ids;
      },
    };
    const first = createStatusBarRegistry({ hasView: () => true, persistence });
    first.registerItem({ id: "a", viewId: "a", slot: "trailing" });
    first.registerItem({ id: "b", viewId: "b", slot: "trailing", isVisible: () => false });
    first.registerItem({ id: "c", viewId: "c", slot: "trailing" });
    first.reorderItem("c", { beforeItemId: "a" });
    const restored = createStatusBarRegistry({ hasView: () => true, persistence });
    for (const id of ["b", "a", "c"]) restored.registerItem({ id, viewId: id, slot: "trailing" });
    expect(restored.listItems().map((item) => item.id)).toEqual(["c", "a", "b"]);
  });

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
