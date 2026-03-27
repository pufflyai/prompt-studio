import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { createAttemptStatusHandler, createAttemptStatusRoute } from "./endpoints/create-attempt-status";
import { listAttemptStatusesHandler, listAttemptStatusesRoute } from "./endpoints/list-attempt-statuses";

export const createAttemptStatusRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(createAttemptStatusRoute, createAttemptStatusHandler(deps));
  routes.openapi(listAttemptStatusesRoute, listAttemptStatusesHandler(deps));

  return routes;
};
