import { resolve } from "node:path";

// Discovery and uninstall own the same source rows and files. An uninstall must wait for an
// earlier discovery to finish; a later discovery must check the files after acquiring ownership.
export const createExtensionSourceMutations = () => {
  const pending = new Map<string, Promise<unknown>>();
  return <T>(sourcePath: string, mutate: () => Promise<T>) => {
    const key = resolve(sourcePath);
    const previous = pending.get(key) ?? Promise.resolve();
    const work = previous.catch(() => {}).then(mutate);
    pending.set(key, work);
    void work
      .finally(() => {
        if (pending.get(key) === work) pending.delete(key);
      })
      .catch(() => {});
    return work;
  };
};
