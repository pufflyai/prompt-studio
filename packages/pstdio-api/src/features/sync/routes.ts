import { Hono } from "hono";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { streamHandler } from "./stream";

export const createSyncRoutes = (deps: RouteDeps) => {
  const routes = new Hono<AppBindings>();

  routes.get("/sync/stream", streamHandler({ eventBus: deps.eventBus, syncService: deps.syncService }));

  return routes;
};
