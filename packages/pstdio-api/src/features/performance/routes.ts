import { Hono } from "hono";
import { readRuntimeImportCount } from "pstdio-extensions";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";

// This authenticated, explicit read has no timer, writer or retained snapshot.
// Metadata is read at the owners; message payloads never enter diagnostics.
export const createPerformanceRoutes = (deps: Pick<RouteDeps, "sessionService">) => {
  const routes = new Hono<AppBindings>();
  routes.get("/diagnostics/performance", async (c) => {
    const sessions = await deps.sessionService.store.diagnostics();
    const memory = process.memoryUsage();
    return c.json({
      pid: process.pid,
      heapUsedBytes: memory.heapUsed,
      externalBytes: memory.external,
      counters: { ...sessions, extensionImports: readRuntimeImportCount() },
    });
  });
  return routes;
};
