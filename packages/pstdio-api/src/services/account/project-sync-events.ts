import type { ProjectSyncStatus } from "pstdio-api-contracts";

// Owners signal that a status may have changed. Reads run one at a time, and only a changed
// derived status is published, so frequent local saves do not flood extension events.
export const createProjectSyncEvents = (input: {
  status: (projectId: string) => Promise<ProjectSyncStatus>;
  publish: (projectId: string, status: ProjectSyncStatus) => void;
}) => {
  const published = new Map<string, string>();
  const dirty = new Set<string>();
  let running: Promise<void> | undefined;
  let closed = false;
  const run = async () => {
    try {
      for (const projectId of dirty) {
        if (closed) return;
        dirty.delete(projectId);
        const status = await input.status(projectId).catch(() => null);
        // A project that cannot be read now (for example, deleted) publishes again once it can.
        if (!status) {
          published.delete(projectId);
          continue;
        }
        const key = JSON.stringify(status);
        if (closed || published.get(projectId) === key) continue;
        published.set(projectId, key);
        input.publish(projectId, status);
      }
    } finally {
      running = undefined;
    }
  };
  return {
    changed(projectId: string) {
      dirty.add(projectId);
      running ??= run();
      return running;
    },
    close() {
      closed = true;
      dirty.clear();
    },
  };
};
