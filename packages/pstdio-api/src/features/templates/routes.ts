import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { copyTemplateHandler, copyTemplateRoute } from "./endpoints/copy-template";
import { createTemplateHandler, createTemplateRoute } from "./endpoints/create-template";
import { deleteTemplateHandler, deleteTemplateRoute } from "./endpoints/delete-template";
import { getTemplateHandler, getTemplateRoute } from "./endpoints/get-template";
import { listTemplatesHandler, listTemplatesRoute } from "./endpoints/list-templates";
import {
  disableTemplateDefaultHandler,
  disableTemplateDefaultRoute,
  enableTemplateDefaultHandler,
  enableTemplateDefaultRoute,
} from "./endpoints/set-template-default-enabled";
import { updateTemplateHandler, updateTemplateRoute } from "./endpoints/update-template";

export const createTemplateRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(listTemplatesRoute, listTemplatesHandler(deps));
  routes.openapi(createTemplateRoute, createTemplateHandler(deps));
  routes.openapi(copyTemplateRoute, copyTemplateHandler(deps));
  routes.openapi(disableTemplateDefaultRoute, disableTemplateDefaultHandler(deps));
  routes.openapi(enableTemplateDefaultRoute, enableTemplateDefaultHandler(deps));
  routes.openapi(getTemplateRoute, getTemplateHandler(deps));
  routes.openapi(updateTemplateRoute, updateTemplateHandler(deps));
  routes.openapi(deleteTemplateRoute, deleteTemplateHandler(deps));

  return routes;
};
