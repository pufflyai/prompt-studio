import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { listHarnessInfoHandler, listHarnessInfoRoute } from "./endpoints/list-harness-info";
import { listHarnessModelsHandler, listHarnessModelsRoute } from "./endpoints/list-harness-models";
import { listHarnessesHandler, listHarnessesRoute } from "./endpoints/list-harnesses";
import { removeHarnessHandler, removeHarnessRoute } from "./endpoints/remove-harness";
import { sendHarnessSessionHandler, sendHarnessSessionRoute } from "./endpoints/send-harness-session";
import { setupAvailableHarnessesHandler, setupAvailableHarnessesRoute } from "./endpoints/setup-available-harnesses";
import { setupHarnessHandler, setupHarnessRoute } from "./endpoints/setup-harness";
import { startHarnessSessionHandler, startHarnessSessionRoute } from "./endpoints/start-harness-session";
import { stopHarnessSessionHandler, stopHarnessSessionRoute } from "./endpoints/stop-harness-session";
import { updateHarnessHandler, updateHarnessRoute } from "./endpoints/update-harness";

export const createHarnessRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(listHarnessInfoRoute, listHarnessInfoHandler(deps));
  routes.openapi(listHarnessModelsRoute, listHarnessModelsHandler(deps));
  routes.openapi(listHarnessesRoute, listHarnessesHandler(deps));
  routes.openapi(setupHarnessRoute, setupHarnessHandler(deps));
  routes.openapi(setupAvailableHarnessesRoute, setupAvailableHarnessesHandler(deps));
  routes.openapi(updateHarnessRoute, updateHarnessHandler(deps));
  routes.openapi(removeHarnessRoute, removeHarnessHandler(deps));
  routes.openapi(startHarnessSessionRoute, startHarnessSessionHandler(deps));
  routes.openapi(sendHarnessSessionRoute, sendHarnessSessionHandler(deps));
  routes.openapi(stopHarnessSessionRoute, stopHarnessSessionHandler(deps));

  return routes;
};
