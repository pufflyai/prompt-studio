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

export const createExtensionSourceRefresh =
  (
    mutateSource: ReturnType<typeof createExtensionSourceMutations>,
    notifyInstalledSourcesChanged: (sourcePath?: string) => Promise<void>,
  ) =>
  <T>(sourcePath: string, mutate: (notify: (changedPath?: string) => Promise<void>) => Promise<T>) => {
    const changedPaths: Array<string | undefined> = [];
    const refresh = async () => {
      // Refresh can compile views and report their results. Release source ownership
      // before awaiting it, so readers and result writers cannot wait on this caller.
      for (const changedPath of changedPaths) await notifyInstalledSourcesChanged(changedPath);
    };

    return mutateSource(sourcePath, () =>
      mutate(async (changedPath) => {
        changedPaths.push(changedPath);
      }),
    ).then(
      async (result) => {
        await refresh();
        return result;
      },
      async (error) => {
        // A secondary refresh failure must not replace the failed source operation.
        await refresh().catch(() => {});
        throw error;
      },
    );
  };
