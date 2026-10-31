import { writeFileSync } from "node:fs";
import { join } from "node:path";

export const writeWorkbenchPackageConsumer = (directory: string, react: boolean) => {
  writeFileSync(
    join(directory, "workbench-consumer.ts"),
    `
import { createWorkbench } from "@pstdio/workbench";
import { createLocalStorageWorkbenchPersistence } from "@pstdio/workbench/storage";
const values = new Map<string, string>();
const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
const firstState = createLocalStorageWorkbenchPersistence({ namespace: "window", scope: "first", storage });
const secondState = createLocalStorageWorkbenchPersistence({ namespace: "window", scope: "second", storage });
const startPage = { kind: "page", extensionId: "consumer", id: "start" } as const;
let nativeEntry: { url: string; state?: unknown } = { url: "/" };
let popstate: ((entry: typeof nativeEntry) => void) | undefined;
const browser = {
  current: () => nativeEntry,
  push: (entry: typeof nativeEntry) => { nativeEntry = entry; },
  replace: (entry: typeof nativeEntry) => { nativeEntry = entry; },
  back() {},
  forward() {},
  onPopState(listener: (entry: typeof nativeEntry) => void) {
    popstate = listener;
    return { dispose() { popstate = undefined; } };
  },
};
const first = createWorkbench({ ...firstState, startPage, pageLocationBrowser: browser });
const second = createWorkbench({ ...secondState, startPage, pageLocationBrowser: browser, active: false });
firstState.statusBarPersistence.setOrder(["first", "second"]);
secondState.statusBarPersistence.setOrder(["second", "first"]);
if (first.host.storageScope !== "first" || second.host.storageScope !== "second") throw new Error("Workbench lost storage ownership");
if (firstState.statusBarPersistence.getOrder()?.[0] !== "first") throw new Error("Another workbench overwrote the status order");
for (const [project, core] of [["first", first], ["second", second]] as const) {
  core.modes.registerMode({ id: "project", activate() {} });
  for (const id of ["start", "editor"]) core.pages.registerPage({
    id, ref: { ...startPage, id }, path: id, modeId: "project", main: { kind: "panels" }, slots: [],
  });
  if (!core.pageLocations.boot(project).ok) throw new Error("Consumer page did not open");
}
const nativeStart = nativeEntry;
first.pageLocations.navigate({ kind: "page", page: { ...startPage, id: "editor" } });
const nativeEditor = nativeEntry;
for (const entry of [nativeEntry, { url: "/outside", state: null }]) {
  nativeEntry = entry;
  popstate?.(entry);
  if (first.pages.store.getState().location?.page.id !== "editor" || nativeEntry !== entry)
    throw new Error("Unchanged or unknown native history navigated the active workbench");
}
first.activation.setActive(false);
second.activation.setActive(true);
if (first.activation.isActive() || !second.activation.isActive()) throw new Error("Workbench activation did not switch");
${
  react
    ? `import { Portal, ScopedDialog, ScopedMenu, ScopedPopover, useScopedMenu, useToaster } from "@pstdio/ui";
void [Portal, ScopedDialog, ScopedMenu, ScopedPopover, useScopedMenu, useToaster];`
    : ""
}
await first.dispose();
await second.dispose();
nativeEntry = nativeEditor;
const reloaded = createWorkbench({ startPage, pageLocationBrowser: browser });
const hidden = createWorkbench({ startPage, pageLocationBrowser: browser, active: false });
for (const core of [reloaded, hidden]) {
  core.modes.registerMode({ id: "project", activate() {} });
  for (const id of ["start", "editor"]) core.pages.registerPage({
    id, ref: { ...startPage, id }, path: id, modeId: "project", main: { kind: "panels" }, slots: [],
  });
  if (!core.pageLocations.boot("first").ok) throw new Error("Reloaded consumer page did not open");
}
for (const [entry, expected] of [[nativeStart, "start"], [nativeEditor, "editor"]] as const) {
  nativeEntry = entry;
  popstate?.(entry);
  if (reloaded.pages.store.getState().location?.page.id !== expected)
    throw new Error("Native history from before reload did not restore its page");
  if (hidden.pages.store.getState().location?.page.id !== "editor")
    throw new Error("Native history changed the inactive workbench after reload");
}
await reloaded.dispose();
await hidden.dispose();
`,
  );
};
