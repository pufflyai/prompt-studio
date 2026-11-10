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
  const previousSources = new Set(existing?.sources.map((row) => row.source_path));
  const addedSources =
    input.kind === "sources" ? input.rows.filter((row) => !previousSources.has(row.source_path)) : [];
  const report = (event: object) => publishPreparationEvent({ watchId: input.id, ...event });
  const reconcileAttachments = () => {
    // An edit can precede detached registration or land while its worker is absent.
    // Reconcile after watching so a later edit is covered by ordinary notifications.
    for (const row of addedSources) report({ sourcePath: row.source_path });
  };
  if (existing) {
    const previous = { sources: existing.sources, roots: existing.roots };
    if (input.kind === "sources") existing.sources = input.rows;
    else existing.roots = input.rows;
    try {
      await existing.watcher.refresh(addedSources.length ? undefined : input.sourcePath);
    } catch (error) {
      Object.assign(existing, previous);
      throw error;
    }
    reconcileAttachments();
    return;
  }
  const state: WatchState = {
    sources: input.kind === "sources" ? input.rows : [],
    roots: input.kind === "roots" ? input.rows : [],
    watcher: null!,
  };
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
  reconcileAttachments();
};
export const disposePreparationWatcher = (id: string) => {
  watchers.get(id)?.watcher.dispose();
  watchers.delete(id);
};
export const disposePreparationWatchers = () => {
  for (const id of watchers.keys()) disposePreparationWatcher(id);
};
