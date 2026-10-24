import type { Layout, LayoutChange } from "./layout";

interface LayoutSessionOptions {
  read: () => Promise<Layout>;
  write: (change: LayoutChange) => Promise<unknown>;
  apply: (layout: Layout) => void;
  error: (message: string) => void;
}
export const createLayoutSession = (options: LayoutSessionOptions) => {
  let active = true;
  let version = 0;
  let pending = 0;
  let failed: LayoutChange | undefined;
  let queue = Promise.resolve();
  const refresh = async () => {
    if (!active || pending || failed) return;
    const request = ++version;
    try {
      const next = await options.read();
      if (!active || version !== request || pending || failed) return;
      options.apply(next);
      options.error("");
    } catch (reason) {
      if (active && version === request) options.error(`Saved layout is unavailable: ${String(reason)}`);
    }
  };
  const save = (change: LayoutChange) => {
    pending += 1;
    version += 1;
    queue = queue.then(async () => {
      const patch = { ...failed, ...change, positions: { ...failed?.positions, ...change.positions } };
      let saved = false;
      try {
        await options.write(patch);
        failed = undefined;
        saved = true;
        if (active) options.error("");
      } catch (reason) {
        failed = patch;
        if (active) options.error(`Layout could not be saved: ${String(reason)}`);
      } finally {
        pending -= 1;
        if (!pending && saved) await refresh();
      }
    });
    return queue;
  };
  return {
    refresh,
    save,
    retry: () => (failed ? save({}) : refresh()),
    dispose: () => {
      active = false;
      version += 1;
    },
  };
};
