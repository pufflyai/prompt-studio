import { expect, test } from "bun:test";
import { createKanbanRendererStore, getKanbanRendererStore } from "./use-kanban-renderer-store";

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};

test("restores saved views, edits, selection, and deletions from host storage", () => {
  const storage = memoryStorage();
  const options = { storageKey: "project-one/tickets", storage };
  const first = createKanbanRendererStore(options);
  const state = first.getState();
  state.setViewMode("list");
  state.setColumnGrouping("status");
  state.setRowGrouping("type");
  state.setOrdering({ attributeId: "updated", direction: "desc" });
  state.setDisplayProperties(["status", "priority"]);
  state.setFilter("status", ["todo"]);
  state.createView({ id: "saved", title: "Restart check" });
  state.setDefaultView("saved");
  state.renameView("saved", "Renamed");
  state.createView({ id: "removed", title: "Remove me" });
  state.deleteView("removed");
  const restored = createKanbanRendererStore(options).getState();
  expect(restored.views).toEqual(first.getState().views);
  expect(restored.views.map((view) => view.title)).toEqual(["All", "Renamed"]);
  expect(restored.views[1]?.isDefault).toBe(true);
  expect(restored.activeViewId).toBe("saved");
  expect(restored.settings).toEqual(first.getState().settings);
  expect(restored.filters).toEqual({ status: ["todo"] });
  expect(createKanbanRendererStore({ ...options, storageKey: "project-two/tickets" }).getState().views).toHaveLength(1);
});

test("shares stores only within the same host and storage key", () => {
  const storage = memoryStorage();
  const first = getKanbanRendererStore("tickets", undefined, storage);
  first.getState().createView({ id: "saved", title: "Saved" });
  expect(getKanbanRendererStore("tickets", undefined, storage)).toBe(first);
  expect(getKanbanRendererStore("tickets", undefined, memoryStorage()).getState().views).toHaveLength(1);
});

test("supports host storage methods on a class prototype", () => {
  class Storage {
    #values = new Map<string, string>();
    getItem(key: string) {
      return this.#values.get(key) ?? null;
    }
    setItem(key: string, value: string) {
      this.#values.set(key, value);
    }
  }
  const options = { storageKey: "tickets", storage: new Storage() };
  createKanbanRendererStore(options).getState().createView({ id: "saved", title: "Saved" });
  expect(createKanbanRendererStore(options).getState().activeViewId).toBe("saved");
});
