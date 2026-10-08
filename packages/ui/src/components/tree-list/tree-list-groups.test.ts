import { describe, expect, test } from "bun:test";
import { createTreeListOrderStore } from "./tree-list-order.store";
import { applyTreeListOrder } from "./tree-list-order-filter";

const sections = [
  { id: "navigation", moveScope: "project", nodes: [{ id: "tickets", label: "Tickets" }] },
  { id: "footer", moveScope: "project", nodes: [{ id: "settings", label: "Settings" }] },
];
const group = { id: "group:research", label: "Research", moveScope: "project" };

const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
};

describe("user-created tree groups", () => {
  test("restores an empty named group in the saved tree order", () => {
    const hostStorage = storage();
    const first = createTreeListOrderStore({ storageKey: "project-a", storage: hostStorage });
    first.getState().addGroup(group, ["navigation", "footer"]);

    const restored = createTreeListOrderStore({ storageKey: "project-a", storage: hostStorage }).getState();
    const ordered = applyTreeListOrder(sections, restored.sectionOrder, restored.nodeOrderBySection, restored.groups);
    expect(ordered.map((section) => section.id)).toEqual(["navigation", "footer", group.id]);
    expect(ordered[2]).toMatchObject({ label: "Research", moveScope: "project", nodes: [] });
    expect(createTreeListOrderStore({ storageKey: "project-b", storage: hostStorage }).getState().groups).toEqual([]);
  });

  test("moves rows into a group and restores them to their original sections when it is removed", () => {
    const store = createTreeListOrderStore({ storageKey: "moves", storage: storage() });
    store.getState().addGroup(group, ["navigation", "footer"]);
    store.getState().setNodeOrder("navigation", []);
    store.getState().setNodeOrder(group.id, ["tickets"]);
    store.getState().setSectionSlot(group.id, "header");

    const ordered = () => {
      const state = store.getState();
      return applyTreeListOrder(sections, state.sectionOrder, state.nodeOrderBySection, state.groups);
    };
    expect(
      ordered()
        .find((section) => section.id === group.id)
        ?.nodes.map((node) => node.id),
    ).toEqual(["tickets"]);
    expect(ordered()[0]?.nodes).toEqual([]);

    store.getState().removeGroup(group.id);
    expect(ordered().map((section) => [section.id, section.nodes.map((node) => node.id)])).toEqual([
      ["navigation", ["tickets"]],
      ["footer", ["settings"]],
    ]);
    expect(store.getState().sectionSlotById).toEqual({});
    expect(store.getState().nodeOrderBySection).toEqual({ navigation: [] });
  });

  test("renames a group without changing its membership and clears groups on reset", () => {
    const store = createTreeListOrderStore({ storageKey: "rename", storage: storage() });
    store.getState().addGroup(group, []);
    store.getState().setNodeOrder(group.id, ["tickets"]);
    store.getState().renameGroup(group.id, "  Product research  ");
    expect(store.getState().groups).toEqual([{ ...group, label: "Product research" }]);
    expect(store.getState().nodeOrderBySection[group.id]).toEqual(["tickets"]);
    expect(() => store.getState().renameGroup(group.id, " ")).toThrow("Enter a group name.");
    store.getState().reset();
    expect(store.getState().groups).toEqual([]);
    expect(store.getState().nodeOrderBySection).toEqual({});
  });
});
