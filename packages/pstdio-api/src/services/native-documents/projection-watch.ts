import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import type { createNativeProjectionQueue } from "./projection-queue";

/** A committed canonical revision owns projection work even when there is no editor room. */
export const watchNativeProjections = (
  storage: ExtensionsRouteDeps["extensionStorageService"],
  request: ReturnType<typeof createNativeProjectionQueue>["request"],
  admit: (action: () => Promise<void>) => Promise<void>,
) =>
  storage.watch((owner, name) => {
    if (!name?.startsWith('["native-markdown",')) return;
    const documentKey = (JSON.parse(name) as string[])[1];
    void admit(async () => {
      const address = { owner, documentKey };
      if (await storage.nativeRooms.source(address)) await request(address);
    }).catch(() => {});
  });
