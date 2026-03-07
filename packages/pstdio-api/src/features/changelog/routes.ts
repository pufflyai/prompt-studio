import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { getChangelogHandler, getChangelogRoute } from "./endpoints/get-changelog";

export const createChangelogRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(getChangelogRoute, getChangelogHandler(deps));

  return routes;
};
