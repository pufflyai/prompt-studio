import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { createStatusHandler, createStatusRoute } from "./endpoints/create-status";
import { deleteStatusHandler, deleteStatusRoute } from "./endpoints/delete-status";
import { listStatusesHandler, listStatusesRoute } from "./endpoints/list-statuses";
import { setDefaultStatusHandler, setDefaultStatusRoute } from "./endpoints/set-default-status";
import { updateStatusColorHandler, updateStatusColorRoute } from "./endpoints/update-status-color";

export const createStatusRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(listStatusesRoute, listStatusesHandler(deps));
  routes.openapi(createStatusRoute, createStatusHandler(deps));
  routes.openapi(setDefaultStatusRoute, setDefaultStatusHandler(deps));
  routes.openapi(updateStatusColorRoute, updateStatusColorHandler(deps));
  routes.openapi(deleteStatusRoute, deleteStatusHandler(deps));

  return routes;
};
