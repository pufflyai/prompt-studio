import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { deleteHookHandler, deleteHookRoute } from "./endpoints/delete-hook";
import { listHooksHandler, listHooksRoute } from "./endpoints/list-hooks";
import { setHookHandler, setHookRoute } from "./endpoints/set-hook";

export const createHookRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(listHooksRoute, listHooksHandler(deps));
  routes.openapi(setHookRoute, setHookHandler(deps));
  routes.openapi(deleteHookRoute, deleteHookHandler(deps));

  return routes;
};
