import type { ExtensionsRouteDeps } from "../../features/extensions/deps";

export const createPersonalAnnouncements = (deps: ExtensionsRouteDeps, projectId: string, signal: AbortSignal) => {
  const state = { announcing: false };
  const announced = new Map<string, string>();
  const announce = async () => {
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
    for (const key of announced.keys())
      if (!next.has(key)) {
        const [table, id] = JSON.parse(key);
        deps.eventBus.emit(table, "delete", { id });
      }
    state.announcing = false;
    announced.clear();
    for (const [key, value] of next) announced.set(key, value);
  };

  return {
    state,
    announce,
    clear() {
      for (const key of announced.keys()) {
        const [table, id] = JSON.parse(key);
        deps.eventBus.emit(table, "delete", { id });
      }
      announced.clear();
    },
  };
};
