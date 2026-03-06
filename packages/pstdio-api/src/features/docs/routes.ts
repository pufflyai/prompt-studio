import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { getDocsContentHandler, getDocsContentRoute } from "./endpoints/get-docs-content";
import { getDocsIndexHandler, getDocsIndexRoute } from "./endpoints/get-docs-index";

export const createDocsRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(getDocsIndexRoute, getDocsIndexHandler(deps));
  routes.openapi(getDocsContentRoute, getDocsContentHandler(deps));

  return routes;
};
