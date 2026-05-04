import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { TemplatesRouteDeps } from "./deps";
import { createTemplateHandler, createTemplateRoute } from "./endpoints/create-template";
import { deleteTemplateHandler, deleteTemplateRoute } from "./endpoints/delete-template";
import { getTemplateHandler, getTemplateRoute } from "./endpoints/get-template";
import { listTemplatesHandler, listTemplatesRoute } from "./endpoints/list-templates";
import { updateTemplateHandler, updateTemplateRoute } from "./endpoints/update-template";

export const createTemplateRoutes = (deps: TemplatesRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(listTemplatesRoute, listTemplatesHandler(deps));
  routes.openapi(createTemplateRoute, createTemplateHandler(deps));
  routes.openapi(getTemplateRoute, getTemplateHandler(deps));
  routes.openapi(updateTemplateRoute, updateTemplateHandler(deps));
  routes.openapi(deleteTemplateRoute, deleteTemplateHandler(deps));

  return routes;
};
