import { access, mkdir, open, unlink } from "node:fs/promises";
import { join } from "node:path";

/** File maintenance gates admission without inventing a workspace lifecycle transition. */
export const createWorkspaceMaintenance = (directory?: string) => {
  const pending = new Map<string, Promise<unknown>>();
  const listeners = new Set<() => void>();
  const marker = (id: string) => (directory ? join(directory, encodeURIComponent(id)) : undefined);
  const begin = async (path: string | undefined) => {
    if (!path || !directory) return;
    await mkdir(directory, { recursive: true });
    const file = await open(path, "w");
    try {
      await file.sync();
    } finally {
      await file.close();
    }
  };
  return {
    isRunning: async (id: string) => {
      if (pending.has(id)) return true;
      const path = marker(id);
      if (!path) return false;
      try {
        await access(path);
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        // A new maintenance scope can start while the filesystem read is pending.
        return pending.has(id);
      }
    },
    subscribeSettled: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    run: async <T>(id: string, work: () => Promise<T>) => {
      const path = marker(id);
      const task = (pending.get(id) ?? Promise.resolve())
        .catch(() => {})
        .then(async () => {
          // Intent reaches disk before hooks touch skill files. An interrupted host leaves it for
          // startup's normal project maintenance, while session recovery still sees a closed gate.
          await begin(path);
          const result = await work();
          if (path) await unlink(path);
          return result;
        });
      pending.set(id, task);
      try {
        return await task;
      } finally {
        if (pending.get(id) === task) {
          pending.delete(id);
          for (const listener of listeners) listener();
        }
      }
    },
  };
};
