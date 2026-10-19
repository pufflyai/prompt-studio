import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionsRouteDeps } from "./deps";
import { packageRevision, preparePublishedExtension } from "./publication/prepare";

type Owner = ExtensionsRouteDeps["extensionStorageService"];
type Prepared = Awaited<ReturnType<typeof preparePublishedExtension>>;
const caches = new WeakMap<Owner, Map<string, Promise<Prepared>>>();

export const loadPublishedHandlers = (owner: Owner, input: { revision: string; extensionId: string; bytes: Blob }) => {
  let cache = caches.get(owner);
  if (!cache) {
    cache = new Map();
    caches.set(owner, cache);
  }
  const key = JSON.stringify([input.extensionId, input.revision]);
  const previous = cache.get(key);
  if (previous) return previous;
  const prepare = async () => {
    if ((await packageRevision(input.bytes)) !== input.revision) throw new Error("Published package hash mismatch");
    return preparePublishedExtension({
      bytes: input.bytes,
      root: join(tmpdir(), "pstdio-conflict-handlers"),
      extensionId: input.extensionId,
    });
  };
  const loaded = prepare().catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, loaded);
  return loaded;
};

export const disposePublishedHandlers = async (owner: Owner) => {
  const cache = caches.get(owner);
  caches.delete(owner);
  const entries = await Promise.allSettled(cache?.values() ?? []);
  await Promise.all(
    entries.map((entry) =>
      entry.status === "fulfilled" ? rm(entry.value.path, { recursive: true, force: true }) : undefined,
    ),
  );
};

export const closePublishedHandlerHost = async (owner: Owner, closeStorage: () => Promise<void>) => {
  try {
    await disposePublishedHandlers(owner);
  } finally {
    await closeStorage();
  }
};
