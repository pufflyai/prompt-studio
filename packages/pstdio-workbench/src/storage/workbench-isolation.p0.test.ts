import { expect, test } from "bun:test";
import { createDefaultWorkbenchLayout } from "../core";
import { createLocalStorageWorkbenchPersistence } from "./local-storage-persistence";

test("an explicit global scope is independent from an unscoped host", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const host = createLocalStorageWorkbenchPersistence({ namespace: "window", storage, debounceMs: 60_000 });
  const scoped = createLocalStorageWorkbenchPersistence({ namespace: "window", scope: "global", storage });
  host.statusBarPersistence.setOrder(["host"]);
  scoped.statusBarPersistence.setOrder(["project"]);
  expect(host.statusBarPersistence.getOrder()).toEqual(["host"]);
  expect(scoped.statusBarPersistence.getOrder()).toEqual(["project"]);
  const layout = createDefaultWorkbenchLayout({ sidenav: false });
  host.layoutPersistence.setLayout(layout, "project/host");
  scoped.layoutPersistence.advanceWriteGeneration?.();
  host.layoutPersistence.flush?.();
  expect(host.layoutPersistence.getLayout("project/host")).toEqual(layout);
  host.layoutPersistence.dispose?.();
  scoped.layoutPersistence.dispose?.();
});

test("project workbenches retain independent status orders and tree expansions", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const open = (scope: string) => createLocalStorageWorkbenchPersistence({ namespace: "window", scope, storage });
  const a = open("a");
  const b = open("b");
  a.statusBarPersistence.setOrder(["first", "second"]);
  b.statusBarPersistence.setOrder(["second", "first"]);
  a.treePersistence.setTreeStates({ statesByTreeId: { files: { expandedNodeIds: ["src"], expandedSectionIds: [] } } });
  b.treePersistence.setTreeStates({ statesByTreeId: { files: { expandedNodeIds: ["docs"], expandedSectionIds: [] } } });
  expect(open("a").statusBarPersistence.getOrder()).toEqual(["first", "second"]);
  expect(open("b").statusBarPersistence.getOrder()).toEqual(["second", "first"]);
  expect(open("a").treePersistence.getTreeStates()?.statesByTreeId.files.expandedNodeIds).toEqual(["src"]);
  expect(open("b").treePersistence.getTreeStates()?.statesByTreeId.files.expandedNodeIds).toEqual(["docs"]);
});

test("invalidating one project's layouts preserves another project's pending save", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const open = (scope: string) =>
    createLocalStorageWorkbenchPersistence({ namespace: "window", scope, storage, debounceMs: 60_000 });
  const a = open("a");
  const b = open("b");
  const layout = createDefaultWorkbenchLayout({ sidenav: false });
  b.layoutPersistence.setLayout(layout, "project/b");
  a.layoutPersistence.advanceWriteGeneration?.();
  b.layoutPersistence.flush?.();
  expect(open("b").layoutPersistence.getLayout("project/b")).toEqual(layout);
  a.layoutPersistence.dispose?.();
  b.layoutPersistence.dispose?.();
});
