import type { ExtensionsRouteDeps } from "../../features/extensions/deps";

export const createPersonalAnnouncements = (deps: ExtensionsRouteDeps, projectId: string, signal: AbortSignal) => {
  const state = { announcing: false };
  const announced = new Map<string, string>();
  const remove = (keys: Iterable<string>) => {
    for (const key of keys) {
      const [table, id] = JSON.parse(key);
      deps.eventBus.emit(table, "delete", { id });
    }
  };
  let revision: Awaited<ReturnType<ExtensionsRouteDeps["personalHistoryService"]["visibleRevision"]>> | undefined;
  const announce = async () => {
    const nextRevision = await deps.personalHistoryService.visibleRevision(projectId);
    if (revision?.identity === nextRevision.identity && revision?.rows === nextRevision.rows) return;
    const rowsByTable = await deps.personalHistoryService.fullState(projectId);
    if (signal.aborted) return;
    // These events describe other devices' rows. They must not count as a local index change.
    state.announcing = true;
    const next = new Map<string, string>();
    for (const [table, rows] of Object.entries(rowsByTable)) {
      for (const row of rows) {
        const key = JSON.stringify([table, row.id]);
        const value = JSON.stringify(row);
        next.set(key, value);
        if (announced.get(key) !== value) deps.eventBus.emit(table, "set", row);
      }
    }
    remove([...announced.keys()].filter((key) => !next.has(key)));
    state.announcing = false;
    announced.clear();
    for (const [key, value] of next) announced.set(key, value);
    revision = nextRevision;
  };

  return {
    state,
    announce,
    clear() {
      revision = undefined;
      remove(announced.keys());
      announced.clear();
    },
  };
};
