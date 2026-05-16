import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { SettingsRouteDeps } from "./deps";
import { getSettingsHandler, getSettingsRoute } from "./endpoints/get-settings";
import { updateSettingsHandler, updateSettingsRoute } from "./endpoints/update-settings";

export const createSettingsRoutes = (deps: SettingsRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(getSettingsRoute, getSettingsHandler(deps));
  routes.openapi(updateSettingsRoute, updateSettingsHandler(deps));

  return routes;
};
