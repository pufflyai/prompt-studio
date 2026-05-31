import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { AttemptStatusesRouteDeps } from "./deps";
import { createAttemptStatusHandler, createAttemptStatusRoute } from "./endpoints/create-attempt-status";
import { deleteAttemptStatusHandler, deleteAttemptStatusRoute } from "./endpoints/delete-attempt-status";
import { listAttemptStatusesHandler, listAttemptStatusesRoute } from "./endpoints/list-attempt-statuses";
import {
  updateAttemptStatusDefinitionHandler,
  updateAttemptStatusDefinitionRoute,
} from "./endpoints/update-attempt-status-definition";

/** @deprecated Legacy core ticket attempt status routes. Workspace status automation is extension-owned. */
export const createAttemptStatusRoutes = (deps: AttemptStatusesRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(createAttemptStatusRoute, createAttemptStatusHandler(deps));
  routes.openapi(listAttemptStatusesRoute, listAttemptStatusesHandler(deps));
  routes.openapi(updateAttemptStatusDefinitionRoute, updateAttemptStatusDefinitionHandler(deps));
  routes.openapi(deleteAttemptStatusRoute, deleteAttemptStatusHandler(deps));

  return routes;
};
