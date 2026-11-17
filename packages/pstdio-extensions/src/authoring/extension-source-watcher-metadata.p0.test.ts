import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionSourceWatcher } from "./extension-source-watcher";

test.each([
  "metadata",
  "named-child",
  "dangling-child",
  "dependency",
  "mixed",
] as const)("source watching distinguishes %s notifications before lending live edit priority", async (scenario) => {
  const root = mkdtempSync(join(tmpdir(), "source-watch-metadata-"));
  const source = join(root, "watched");
  mkdirSync(join(source, "node_modules"), { recursive: true });
  writeFileSync(join(source, "entry.ts"), "export default {};");
  if (scenario === "named-child") writeFileSync(join(source, "watched"), "real source input");
  if (scenario === "dangling-child") symlinkSync(join(root, "missing"), join(source, "watched"), "junction");
  let notify: ((eventType: string, filename: string | Buffer | null) => void) | undefined;
  const observed = Promise.withResolvers<unknown>();
  const watcher = await createExtensionSourceWatcher({
    debounceMs: 5,
    listInstalledSources: async () => [{ install_name: "watched", source_path: source }],
    onSourceChanged: async (_path, change) => {
      observed.resolve(change);
    },
    watch: (path, listener) => {
      if (path === source) notify = listener;
      return { close: () => {} };
    },
  });
  try {
    if (scenario !== "dependency") notify!("change", "watched");
    if (scenario === "dependency" || scenario === "mixed") {
      mkdirSync(join(source, "node_modules", "new-package"));
      notify!("rename", "node_modules/new-package");
    }
    expect(await observed.promise).toEqual({ kind: scenario === "metadata" ? "metadata" : "source" });
  } finally {
    watcher.dispose();
    rmSync(root, { recursive: true, force: true });
  }
});

test.each([false, true])("keeps source priority received during a running check that rejects: %s", async (reject) => {
  const root = mkdtempSync(join(tmpdir(), "source-watch-running-"));
  const source = join(root, "watched");
  mkdirSync(source);
  writeFileSync(join(source, "entry.ts"), "export default {};");
  let notify: ((eventType: string, filename: string | Buffer | null) => void) | undefined;
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const followed = Promise.withResolvers<unknown>();
  const metadataFollowed = Promise.withResolvers<unknown>();
  const observed: unknown[] = [];
  const errors: unknown[] = [];
  const watcher = await createExtensionSourceWatcher({
    debounceMs: 5,
    listInstalledSources: async () => [{ install_name: "watched", source_path: source }],
    onError: (error) => errors.push(error),
    onSourceChanged: async (_path, change) => {
      observed.push(change);
      if (observed.length === 1) {
        entered.resolve();
        await release.promise;
        if (reject) throw new Error("first check failed");
      } else if (observed.length === 2) followed.resolve(change);
      else metadataFollowed.resolve(change);
    },
    watch: (path, listener) => {
      if (path === source) notify = listener;
      return { close: () => {} };
    },
  });
  try {
    notify!("change", "watched");
    await entered.promise;
    notify!("change", "entry.ts");
    notify!("change", "watched");
    await Bun.sleep(15);
    expect(observed).toEqual([{ kind: "metadata" }]);
    release.resolve();
    expect(await followed.promise).toEqual({ kind: "source" });
    notify!("change", "watched");
    expect(await metadataFollowed.promise).toEqual({ kind: "metadata" });
    expect(errors).toHaveLength(reject ? 1 : 0);
  } finally {
    release.resolve();
    watcher.dispose();
    rmSync(root, { recursive: true, force: true });
  }
});
