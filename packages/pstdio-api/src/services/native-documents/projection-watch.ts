import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import type { createNativeProjectionQueue } from "./projection-queue";

/** A committed canonical revision owns projection work even when there is no editor room. */
export const watchNativeProjections = (
  storage: ExtensionsRouteDeps["extensionStorageService"],
  request: ReturnType<typeof createNativeProjectionQueue>["request"],
  admit: (action: () => Promise<void>) => Promise<void>,
  catalog?: ExtensionsRouteDeps["extensionRuntimeCatalog"],
) => {
  const stopStorage = storage.watch(({ documentId: name, ...owner }) => {
    if (!name?.startsWith('["native-markdown",')) return;
    const documentKey = (JSON.parse(name) as string[])[1];
    void admit(async () => {
      const address = { owner, documentKey };
      if (await storage.nativeRooms.source(address)) await request(address);
    }).catch(() => {});
  });
  const projects = new Set<string | undefined>();
  let scanning = false;
  let closed = false;
  const stopCatalog = catalog?.subscribeInvalidation(({ projectId, reason }) => {
    if (reason === "webviews_built" || reason === "runtime_refresh") return;
    projects.add(projectId);
    if (scanning) return;
    scanning = true;
    void admit(async () => {
      try {
        while (projects.size && !closed) {
          const project = projects.values().next().value;
          projects.delete(project);
          // This reads only dirty projection addresses, in bounded metadata pages.
          for await (const address of storage.nativeFileProjections.pending(project)) {
            if (closed) return;
            await request(address).catch(() => {});
          }
        }
      } finally {
        scanning = false;
      }
    }).catch(() => {});
  });
  return () => {
    closed = true;
    projects.clear();
    stopStorage();
    stopCatalog?.();
  };
};
