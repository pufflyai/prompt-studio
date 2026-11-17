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
  const observe = async (projectId: string) => {
    const status = await input.status(projectId).catch(() => null);
    // A project that cannot be read now starts again from its next observation.
    if (!status) {
      known.delete(projectId);
      return;
    }
    const key = JSON.stringify(status);
    const previous = known.get(projectId);
    known.set(projectId, key);
    // Extensions read the initial value themselves; later differences are changes.
    if (!closed && previous !== undefined && previous !== key) await input.publish(projectId, status);
  };
  const run = async () => {
    try {
      while (dirty.size && !closed) {
        // Let the producing turn finish before observing it. Reading each owner's
        // intermediate state competes with the synchronization the status describes.
        await new Promise<void>((resolve) => setImmediate(resolve));
        if (closed) return;
        const projects = [...dirty];
        for (const projectId of projects) {
          if (closed) return;
          dirty.delete(projectId);
          await observe(projectId);
        }
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
