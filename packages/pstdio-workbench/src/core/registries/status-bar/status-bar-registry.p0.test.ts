import { describe, expect, test } from "bun:test";
import { createStatusBarRegistry } from "./status-bar-registry";

describe("createStatusBarRegistry", () => {
  test("moves a single widget between empty alignment slots and orders it beside a destination widget", () => {
    const registry = createStatusBarRegistry({ hasView: () => true });
    registry.registerItem({ id: "cloud", viewId: "cloud", slot: "trailing" });
    registry.moveItem("cloud", "center");
    expect(registry.listVisibleItems("center").map((item) => item.id)).toEqual(["cloud"]);
    expect(registry.listVisibleItems("trailing")).toEqual([]);
    registry.registerItem({ id: "meter", viewId: "meter", slot: "leading" });
    registry.moveItem("cloud", "leading", { beforeItemId: "meter" });
    expect(registry.listVisibleItems("leading").map((item) => item.id)).toEqual(["cloud", "meter"]);
    expect(registry.getItem("cloud")?.slot).toBe("leading");
    registry.reorderItem("meter", { beforeItemId: "cloud" });
    expect(registry.listVisibleItems("leading").map((item) => item.id)).toEqual(["meter", "cloud"]);
  });

  test("ignores a drop whose destination owner was removed", () => {
    const registry = createStatusBarRegistry({ hasView: () => true });
    registry.registerItem({ id: "cloud", viewId: "cloud", slot: "trailing" });
    const destination = registry.registerItem({ id: "meter", viewId: "meter", slot: "center" });
    destination.dispose();
    registry.moveItem("cloud", "center", { beforeItemId: "meter" });
    expect(registry.getItem("cloud")?.slot).toBe("trailing");
  });

  test("restores chosen alignment and order after reload and owner replacement", () => {
    let order: string[] | undefined;
    let slots: Record<string, "leading" | "center" | "trailing"> | undefined;
    const persistence = {
      getOrder: () => order,
      setOrder: (value: string[]) => {
        order = value;
      },
      getSlots: () => slots,
      setSlots: (value: NonNullable<typeof slots>) => {
        slots = value;
      },
    };
    const first = createStatusBarRegistry({ hasView: () => true, persistence });
    const owner = first.registerItem({ id: "cloud", viewId: "cloud", slot: "trailing" });
    first.registerItem({ id: "meter", viewId: "meter", slot: "trailing" });
    first.moveItem("cloud", "center");
    first.moveItem("meter", "center", { beforeItemId: "cloud" });
    owner.dispose();
    first.registerItem({ id: "cloud", viewId: "cloud", slot: "leading" });
    expect(first.getItem("cloud")?.slot).toBe("center");
    const restored = createStatusBarRegistry({ hasView: () => true, persistence });
    restored.registerItem({ id: "cloud", viewId: "cloud", slot: "trailing" });
    restored.registerItem({ id: "meter", viewId: "meter", slot: "trailing" });
    expect(restored.listVisibleItems("center").map((item) => item.id)).toEqual(["meter", "cloud"]);
    expect(restored.listVisibleItems("leading")).toEqual([]);
  });
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
    expect(() =>
      registry.registerItem({
        id: "missing-details",
        viewId: "acme.view.branch",
        popoverViewId: "missing.view",
        slot: "leading",
      }),
    ).toThrow("Status bar popover view is not registered: missing.view");

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
