import type { StorageLogPage } from "pstdio-sync-contracts";

const readUntilAbort = async (read: () => Promise<StorageLogPage>, signal?: AbortSignal) => {
  if (!signal) return read();
  if (signal.aborted) return;
  let cancel!: () => void;
  const cancelled = new Promise<undefined>((resolve) => {
    cancel = () => resolve(undefined);
  });
  signal.addEventListener("abort", cancel, { once: true });
  try {
    return await Promise.race([read(), cancelled]);
  } finally {
    signal.removeEventListener("abort", cancel);
  }
};

/** Changes wake an idle follower; no polling or historical replay happens between notifications. */
export async function* followLogPages(input: {
  read: (after: string | 0) => Promise<StorageLogPage>;
  watch: (listener: () => void) => () => unknown;
  after?: string | 0;
  signal?: AbortSignal;
}) {
  let after = input.after ?? 0;
  let dirty = true;
  let wake: (() => void) | undefined;
  const changed = () => {
    dirty = true;
    wake?.();
  };
  const stop = input.watch(changed);
  input.signal?.addEventListener("abort", changed);
  try {
    while (!input.signal?.aborted) {
      if (dirty) {
        dirty = false;
        const page = await readUntilAbort(() => input.read(after), input.signal);
        if (!page) return;
        after = page.cursor;
        for (const entry of page.entries) {
          if (input.signal?.aborted) return;
          yield entry;
        }
        if (page.more) dirty = true;
        continue;
      }
      await new Promise<void>((resolve) => {
        wake = resolve;
        if (dirty || input.signal?.aborted) resolve();
      });
      wake = undefined;
    }
  } finally {
    stop();
    input.signal?.removeEventListener("abort", changed);
  }
}
