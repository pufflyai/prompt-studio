import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { FilesystemRouteDeps } from "./deps";
import { createDirectoryHandler, createDirectoryRoute } from "./endpoints/create-directory";
import { listDirectoryHandler, listDirectoryRoute } from "./endpoints/list-directory";

export const createFilesystemRoutes = (deps: FilesystemRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(listDirectoryRoute, listDirectoryHandler(deps));
  routes.openapi(createDirectoryRoute, createDirectoryHandler);

  return routes;
};
