import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const logicalBytes = async (root: string) => {
  const pending = [root];
  let bytes = 0;
  while (pending.length) {
    const path = pending.pop()!;
    try {
      const info = await stat(path);
      if (info.isDirectory()) pending.push(...(await readdir(path)).map((child) => join(path, child)));
      else bytes += info.size;
    } catch (error) {
      // Runtime rotation can remove a file between listing and reading it.
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return bytes;
};

export const observeUpgradeDisk = (root: string) => {
  let pending: Promise<void> | undefined;
  let failure: unknown;
  let peakBytes = 0;
  let latestBytes = 0;
  const sample = () => {
    pending ??= Promise.all([logicalBytes(join(root, "db.sqlite")), logicalBytes(join(root, "storage"))])
      .then(([database, assets]) => {
        latestBytes = database + assets;
        peakBytes = Math.max(peakBytes, latestBytes);
      })
      .catch((error) => {
        failure = error;
      })
      .finally(() => {
        pending = undefined;
      });
    return pending;
  };
  const timer = setInterval(() => void sample(), 100);
  return {
    sample,
    stop: async () => {
      clearInterval(timer);
      await pending;
      await sample();
      if (failure) throw failure;
      return { sampleIntervalMs: 100, sampledPeakLogicalBytes: peakBytes, finalLogicalBytes: latestBytes };
    },
  };
};
