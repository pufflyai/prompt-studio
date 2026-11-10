import { createExtensionSourceWatcher } from "pstdio-extensions/authoring";
import { publishPreparationEvent } from "pstdio-extensions/preparation-server";
import { createExtensionRootWatcher } from "./extension-root-watcher";

interface WatchState {
  sources: { install_name: string; source_path: string }[];
  roots: { path: string }[];
  watcher: { refresh(path?: string): Promise<void>; dispose(): void };
}
const watchers = new Map<string, WatchState>();
type WatchUpdate = {
  id: string;
  sourcePath?: string;
} & ({ kind: "sources"; rows: WatchState["sources"] } | { kind: "roots"; rows: WatchState["roots"] });
export const updatePreparationWatcher = async (input: WatchUpdate) => {
  const existing = watchers.get(input.id);
  if (existing) {
    if (input.kind === "sources") existing.sources = input.rows;
    else existing.roots = input.rows;
    await existing.watcher.refresh(input.sourcePath);
    return;
  }
  const state: WatchState = {
    sources: input.kind === "sources" ? input.rows : [],
    roots: input.kind === "roots" ? input.rows : [],
    watcher: null!,
  };
  const report = (event: object) => publishPreparationEvent({ watchId: input.id, ...event });
  if (input.kind === "sources")
    state.watcher = await createExtensionSourceWatcher({
      listInstalledSources: async () => state.sources,
      onSourceChanged: async (sourcePath) => report({ sourcePath }),
      onError: (error) => report({ error: error instanceof Error ? error.message : String(error) }),
    });
  else
    state.watcher = await createExtensionRootWatcher({
      listExtensionRoots: async () =>
        state.roots.map((row) => ({ path: row.path, sync: async () => report({ sourcePath: row.path }) })),
      onError: (error) => report({ error: error instanceof Error ? error.message : String(error) }),
    });
  watchers.set(input.id, state);
};
export const disposePreparationWatcher = (id: string) => {
  watchers.get(id)?.watcher.dispose();
  watchers.delete(id);
};
export const disposePreparationWatchers = () => {
  for (const id of watchers.keys()) disposePreparationWatcher(id);
};
