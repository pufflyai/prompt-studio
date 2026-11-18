import { AsyncLocalStorage } from "node:async_hooks";
import { access, mkdir, open, unlink } from "node:fs/promises";
import { join } from "node:path";

/** File maintenance gates admission without inventing a workspace lifecycle transition. */
export const createWorkspaceMaintenance = (directory?: string) => {
  const pending = new Map<string, Promise<unknown>>();
  const owners = new AsyncLocalStorage<{ active: boolean }[]>();
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
  const enqueue = async <T>(id: string, work: () => Promise<T>): Promise<T> => {
    const inherited = owners.getStore() ?? [];
    const task = (pending.get(id) ?? Promise.resolve())
      .catch(() => {})
      .then(async () => {
        const owner = { active: true };
        return owners.run([...inherited, owner], async () => {
          try {
            return await work();
          } finally {
            owner.active = false;
          }
        });
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
  };
  return {
    assertCanDelete: (id: string) => {
      // A hook still owns its gate until it returns. Waiting on another busy
      // gate from this scope can make the two owners wait on each other.
      if (pending.has(id) && owners.getStore()?.some((owner) => owner.active))
        throw new Error("Workspace deletion cannot be nested while the target has pending maintenance.");
    },
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
    run: <T>(id: string, work: () => Promise<T>) =>
      enqueue(id, async () => {
        const path = marker(id);
        // The marker lets startup recover interrupted skill-file maintenance.
        await begin(path);
        const result = await work();
        if (path) await unlink(path);
        return result;
      }),
    // Provider operations serialize with writers without creating skill-file recovery work.
    runExclusive: enqueue,
  };
};
