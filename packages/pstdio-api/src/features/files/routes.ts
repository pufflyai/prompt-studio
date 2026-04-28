import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { getFileContentHandler, getFileContentRoute } from "./endpoints/get-file-content";

export const createFileRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(getFileContentRoute, getFileContentHandler(deps));

  return routes;
};
