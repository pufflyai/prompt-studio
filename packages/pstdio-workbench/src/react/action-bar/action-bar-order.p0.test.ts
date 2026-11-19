import { expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import { createLocalStorageWorkbenchPersistence } from "../../storage";
import { applyActionBarOrder, createActionBarOrder } from "./action-bar-order";

test("action bar customization survives reload and stays scoped to the toolbar and project", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
  const open = () => createWorkbench(createLocalStorageWorkbenchPersistence({ namespace: "action-bar", storage }));
  const items = [{ id: "move" }, { id: "text" }, { id: "document" }];
  const workbench = open();
  const bar = createActionBarOrder(workbench.preferences, "project", "tools");
  expect(applyActionBarOrder(items, bar.read())).toEqual(items);
  await bar.move(items, "document", "move", "before");

  const reloaded = open();
  const ordered = (projectId: string, viewId: string) =>
    applyActionBarOrder(items, createActionBarOrder(reloaded.preferences, projectId, viewId).read());
  expect(ordered("project", "tools").map((item) => item.id)).toEqual(["document", "move", "text"]);
  expect(ordered("project", "library")).toEqual(items);
  expect(ordered("other", "tools")).toEqual(items);
});

test("reordering current tools keeps temporarily unavailable tools and includes new tools", async () => {
  const workbench = createWorkbench();
  const bar = createActionBarOrder(workbench.preferences, "project", "tools");
  const items = [{ id: "move" }, { id: "text" }, { id: "document" }];
  await bar.move(items, "text", "move", "before");
  const visible = items.filter((item) => item.id !== "move");
  await bar.move(visible, "text", "document", "after");
  expect(applyActionBarOrder([...items, { id: "shape" }], bar.read()).map((item) => item.id)).toEqual([
    "document",
    "move",
    "text",
    "shape",
  ]);
});
