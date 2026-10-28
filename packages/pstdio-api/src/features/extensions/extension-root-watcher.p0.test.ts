import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionRootWatcher } from "./extension-root-watcher";

type Listener = (eventType: string, filename: string | Buffer | null) => void;
type ErrorListener = (error: Error) => void;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const createDeferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const waitFor = async (predicate: () => boolean) => {
  for (let attempt = 0; attempt < 20; attempt++) {
    if (predicate()) return;
    await delay(5);
  }

  throw new Error("Timed out waiting for watcher assertion.");
};

class FakeWatcher {
  closed = false;
  listener: Listener;
  onError: ErrorListener | undefined;

  constructor(listener: Listener, onError?: ErrorListener) {
    this.listener = listener;
    this.onError = onError;
  }

  close() {
    this.closed = true;
  }
}

describe("createExtensionRootWatcher", () => {
  test("syncs extension roots when their child folders change", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-root-watcher-"));
    const watchers: Array<{ path: string; watcher: FakeWatcher }> = [];
    const ensured: string[] = [];
    const synced: string[] = [];

    const watcher = await createExtensionRootWatcher({
      debounceMs: 5,
      ensureRoot: (path) => ensured.push(path),
      listExtensionRoots: async () => [
        {
          path: join(root, "extensions"),
          sync: async () => {
            synced.push("extensions");
          },
        },
      ],
      watch: (path, listener) => {
        const fake = new FakeWatcher(listener);
        watchers.push({ path, watcher: fake });
        return fake;
      },
    });

    try {
      expect(ensured).toEqual([join(root, "extensions")]);
      expect(watchers.map((entry) => entry.path)).toEqual([join(root, "extensions")]);

      watchers[0]?.watcher.listener("rename", "added-extension");
      watchers[0]?.watcher.listener("change", "added-extension/package.json");
      await delay(15);

      expect(synced).toEqual(["extensions"]);
    } finally {
      watcher.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("serializes root syncs and reruns after an in-flight change", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-root-serialized-"));
    const firstSync = createDeferred();
    const watchers: FakeWatcher[] = [];
    let activeSyncs = 0;
    let maxActiveSyncs = 0;
    let syncs = 0;

    const watcher = await createExtensionRootWatcher({
      debounceMs: 1,
      listExtensionRoots: async () => [
        {
          path: join(root, "extensions"),
          sync: async () => {
            syncs++;
            activeSyncs++;
            maxActiveSyncs = Math.max(maxActiveSyncs, activeSyncs);

            try {
              if (syncs === 1) await firstSync.promise;
            } finally {
              activeSyncs--;
            }
          },
        },
      ],
      watch: (_path, listener) => {
        const fake = new FakeWatcher(listener);
        watchers.push(fake);
        return fake;
      },
    });

    try {
      watchers[0]?.listener("rename", "first-extension");
      await waitFor(() => syncs === 1);

      watchers[0]?.listener("rename", "second-extension");
      await delay(10);

      expect(syncs).toBe(1);
      expect(maxActiveSyncs).toBe(1);

      firstSync.resolve();
      await waitFor(() => syncs === 2);

      expect(maxActiveSyncs).toBe(1);
    } finally {
      watcher.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("refreshes root watcher registrations", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-root-refresh-"));
    const firstRoot = join(root, "first");
    const secondRoot = join(root, "second");
    let roots = [{ path: firstRoot, sync: async () => {} }];
    const watchers: FakeWatcher[] = [];

    const watcher = await createExtensionRootWatcher({
      listExtensionRoots: async () => roots,
      watch: (_path, listener) => {
        const fake = new FakeWatcher(listener);
        watchers.push(fake);
        return fake;
      },
    });

    try {
      roots = [{ path: secondRoot, sync: async () => {} }];
      await watcher.refresh();

      expect(watchers).toHaveLength(2);
      expect(watchers[0]?.closed).toBe(true);
      expect(watchers[1]?.closed).toBe(false);
    } finally {
      watcher.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("reports a watcher error and watches the root again on the next refresh", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-root-error-"));
    const watchers: FakeWatcher[] = [];
    const errors: unknown[] = [];
    const watchError = Object.assign(new Error("EPERM: operation not permitted, watch"), { code: "EPERM" });

    const watcher = await createExtensionRootWatcher({
      listExtensionRoots: async () => [{ path: join(root, "extensions"), sync: async () => {} }],
      onError: (error) => errors.push(error),
      watch: (_path, listener, onError) => {
        const fake = new FakeWatcher(listener, onError);
        watchers.push(fake);
        return fake;
      },
    });

    try {
      watchers[0]?.onError?.(watchError);

      expect(errors).toEqual([watchError]);
      expect(watchers[0]?.closed).toBe(true);

      await watcher.refresh();

      expect(watchers).toHaveLength(2);
      expect(watchers[1]?.closed).toBe(false);
    } finally {
      watcher.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("ignores a late error from a watcher that was already replaced", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-root-late-error-"));
    const watchers: FakeWatcher[] = [];

    const watcher = await createExtensionRootWatcher({
      listExtensionRoots: async () => [{ path: join(root, "extensions"), sync: async () => {} }],
      onError: () => {},
      watch: (_path, listener, onError) => {
        const fake = new FakeWatcher(listener, onError);
        watchers.push(fake);
        return fake;
      },
    });

    try {
      watchers[0]?.onError?.(new Error("first failure"));
      await watcher.refresh();
      watchers[0]?.onError?.(new Error("late failure from the closed watcher"));

      expect(watchers[1]?.closed).toBe(false);
    } finally {
      watcher.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
