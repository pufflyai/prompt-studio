import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { HealthRouteDeps } from "./deps";
import { getHealthzHandler, getHealthzRoute } from "./endpoints/get-healthz";
import { getReadyzHandler, getReadyzRoute } from "./endpoints/get-readyz";
import { postShutdownHandler, postShutdownRoute } from "./endpoints/post-shutdown";

export const createHealthRoutes = (deps: HealthRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(getHealthzRoute, getHealthzHandler);
  routes.openapi(getReadyzRoute, getReadyzHandler(deps));
  routes.openapi(postShutdownRoute, postShutdownHandler({ shutdown: deps.shutdown }));

  routes.get("/ping", (c) => c.json({ ok: true }, 200));

  return routes;
};
