import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { getApiClient } from "@/lib/api";

export const registerSessionResourceRetention = (ctx: WorkbenchModuleContext) => {
  const retained = new Map<string, { close(): void }>();
  let disposed = false;
  let scheduled = false;
  const refresh = () => {
    if (scheduled || disposed) return;
    scheduled = true;
    // Layout persistence is updated by the same navigation transaction. Read its
    // completed state, including the inactive page and mode caches.
    queueMicrotask(() => {
      scheduled = false;
      if (disposed) return;
      const open = new Set(
        ctx
          .getOpenResources()
          .filter((resource) => resource.type === "session")
          .map((resource) => resource.id),
      );
      for (const id of open) {
        if (!retained.has(id)) retained.set(id, getApiClient().sessions.retainResources(id));
      }
      for (const [id, connection] of retained) {
        if (open.has(id)) continue;
        connection.close();
        retained.delete(id);
      }
    });
  };
  const listeners = [
    ctx.layout.store.subscribe(refresh),
    ctx.pages.store.subscribe(refresh),
    ctx.modes.store.subscribe(refresh),
  ];
  refresh();
  return () => {
    disposed = true;
    for (const stop of listeners) stop();
    for (const connection of retained.values()) connection.close();
    retained.clear();
  };
};
