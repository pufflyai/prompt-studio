import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { copyExtensionTemplateHandler, copyExtensionTemplateRoute } from "./endpoints/copy-extension-template";
import { createTemplateHandler, createTemplateRoute } from "./endpoints/create-template";
import { deleteTemplateHandler, deleteTemplateRoute } from "./endpoints/delete-template";
import {
  getExtensionTemplateContentHandler,
  getExtensionTemplateContentRoute,
} from "./endpoints/get-extension-template-content";
import { getTemplateHandler, getTemplateRoute } from "./endpoints/get-template";
import { listTemplatesHandler, listTemplatesRoute } from "./endpoints/list-templates";
import {
  setExtensionTemplatePreferenceHandler,
  setExtensionTemplatePreferenceRoute,
} from "./endpoints/set-extension-template-preference";
import { updateTemplateHandler, updateTemplateRoute } from "./endpoints/update-template";

export const createTemplateRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  // Extension-default action routes register before /templates/{name} so the
  // literal path segments win over the `:name` placeholder.
  routes.openapi(getExtensionTemplateContentRoute, getExtensionTemplateContentHandler(deps));
  routes.openapi(setExtensionTemplatePreferenceRoute, setExtensionTemplatePreferenceHandler(deps));
  routes.openapi(copyExtensionTemplateRoute, copyExtensionTemplateHandler(deps));

  routes.openapi(listTemplatesRoute, listTemplatesHandler(deps));
  routes.openapi(createTemplateRoute, createTemplateHandler(deps));
  routes.openapi(getTemplateRoute, getTemplateHandler(deps));
  routes.openapi(updateTemplateRoute, updateTemplateHandler(deps));
  routes.openapi(deleteTemplateRoute, deleteTemplateHandler(deps));

  return routes;
};
