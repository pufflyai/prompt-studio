import type { ExtensionsRouteDeps } from "../../features/extensions/deps";

// Writes in a burst, such as one sync round or one command, commit a few milliseconds apart and
// across several event loop turns. Waiting for a short quiet gap merges them; the maximum delay
// keeps a long download from holding back every view update.
const quietMs = 25;
const maxDelayMs = 250;
const maxScopeEntries = 128;

interface StorageChangeScope {
  extensionId: string;
  recordIds?: readonly string[];
}
type ProjectChanges = Map<string, Set<string> | null> | null;
const addScope = (projects: Map<string, ProjectChanges>, projectId: string, scope?: StorageChangeScope) => {
  if (!scope) {
    projects.set(projectId, null);
    return;
  }
  let extensions = projects.get(projectId);
  if (extensions === null) return;
  if (!extensions) {
    extensions = new Map();
    projects.set(projectId, extensions);
  }
  const current = extensions.get(scope.extensionId);
  if (current === null) return;
  const records = new Set([...(current ?? []), ...(scope.recordIds ?? [])]);
  extensions.set(scope.extensionId, scope.recordIds && records.size <= maxScopeEntries ? records : null);
  if (extensions.size > maxScopeEntries) projects.set(projectId, null);
};

/** Coalesce committed storage hints without discarding known extension or record scope. */
export const createStorageChangeAnnouncer = (eventBus: ExtensionsRouteDeps["eventBus"]) => {
  const projects = new Map<string, ProjectChanges>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let firstChange = 0;
  let closed = false;
  const announce = () => {
    timer = undefined;
    const pending = [...projects];
    projects.clear();
    for (const [projectId, extensions] of pending) {
      const scopes = extensions
        ? [...extensions].map(([extensionId, records]) => ({
            extensionId,
            ...(records && { recordIds: [...records] }),
          }))
        : [{}];
      for (const scope of scopes) {
        if (closed) return;
        eventBus.emit("extension_events", "set", {
          id: crypto.randomUUID(),
          projectId,
          eventId: "pstdio.event.storage-changed",
          ...scope,
        });
      }
    }
  };
  return {
    changed(projectId: string, scope?: StorageChangeScope) {
      if (closed) return;
      const now = performance.now();
      if (!projects.size) firstChange = now;
      addScope(projects, projectId, scope);
      clearTimeout(timer);
      timer = setTimeout(announce, Math.max(0, Math.min(quietMs, firstChange + maxDelayMs - now)));
    },
    close() {
      closed = true;
      clearTimeout(timer);
      projects.clear();
    },
  };
};
