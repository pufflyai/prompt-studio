// Owners signal that a status may have changed. Reads run one at a time, and only a changed
// derived status is published, so frequent local saves and host starts do not flood extension events.
export const createStatusEvents = <T>(input: {
  status: (id: string) => Promise<T>;
  publish: (id: string, status: T) => void;
}) => {
  const known = new Map<string, string>();
  const dirty = new Set<string>();
  let running: Promise<void> | undefined;
  let closed = false;
  const run = async () => {
    try {
      for (const projectId of dirty) {
        if (closed) return;
        dirty.delete(projectId);
        const status = await input.status(projectId).catch(() => null);
        // A project that cannot be read now, for example a deleted one, starts again from its next read.
        if (!status) {
          known.delete(projectId);
          continue;
        }
        const key = JSON.stringify(status);
        const previous = known.get(projectId);
        known.set(projectId, key);
        // The first read is where extensions start; they read it themselves. Later differences are changes.
        if (!closed && previous !== undefined && previous !== key) await input.publish(projectId, status);
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
    /** Resolves after a status read that is still running, so the caller can close storage after it. */
    async close() {
      closed = true;
      dirty.clear();
      await running;
    },
  };
};
