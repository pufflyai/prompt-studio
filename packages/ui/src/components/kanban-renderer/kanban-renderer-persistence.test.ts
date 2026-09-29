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

test("restores local selection and unsaved settings from host storage", () => {
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
  state.activateView({
    id: "saved",
    title: "Server view",
    settings: first.getState().settings,
    filters: first.getState().filters,
  });
  state.setFilter("status", ["done"]);
  const restored = createKanbanRendererStore(options).getState();
  expect(restored.activeViewId).toBe("saved");
  expect(restored.settings).toEqual(first.getState().settings);
  expect(restored.filters).toEqual({ status: ["done"] });
});

test("shares stores only within the same host and storage key", () => {
  const storage = memoryStorage();
  const first = getKanbanRendererStore("tickets", undefined, storage);
  first.getState().setFilter("status", ["todo"]);
  expect(getKanbanRendererStore("tickets", undefined, storage)).toBe(first);
  expect(getKanbanRendererStore("tickets", undefined, memoryStorage()).getState().filters).toEqual({});
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
  createKanbanRendererStore(options).getState().setFilter("status", ["todo"]);
  expect(createKanbanRendererStore(options).getState().filters).toEqual({ status: ["todo"] });
});
